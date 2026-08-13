import type { LockstepFrame } from "./lockstepSession";
import type {
  FriendSummary,
  MatchDescriptor,
  MatchService,
  MatchmakingStatus,
} from "./matchTypes";

const FRIENDS_STORAGE_KEY = "warcrest.friends.v1";

/**
 * `MatchService` backed by the relay in `tools/relay/relayServer.ts`.
 *
 * The relay pairs players, picks the seed and assigns sides, then forwards
 * opaque frames. Both of those choices are the server's rather than a client's:
 * a client that picked its own seed or side could shop for a favourable start.
 */
export class RelayMatchService implements MatchService {
  private socket: WebSocket | null = null;
  private listeners = new Set<(status: MatchmakingStatus) => void>();
  private frameListeners = new Set<(frame: LockstepFrame) => void>();
  private pending: { resolve: (m: MatchDescriptor) => void; reject: (e: Error) => void } | null = null;
  private opponentLeft: ((reason: string) => void) | null = null;

  constructor(
    private readonly url: string,
    private readonly storage: Storage | null = safeLocalStorage(),
  ) {}

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      const failed = () => reject(new Error("대전 서버에 연결하지 못했습니다"));
      socket.addEventListener("open", () => {
        this.socket = socket;
        socket.removeEventListener("error", failed);
        resolve();
      }, { once: true });
      socket.addEventListener("error", failed, { once: true });
      socket.addEventListener("message", (event) => this.receive(String(event.data)));
      socket.addEventListener("close", () => {
        this.socket = null;
        // A drop mid-search must settle the caller rather than hang it.
        this.pending?.reject(new Error("대전 서버와의 연결이 끊어졌습니다"));
        this.pending = null;
      });
    });
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async getFriends(): Promise<FriendSummary[]> {
    return readFriends(this.storage);
  }

  async addFriend(name: string): Promise<FriendSummary> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("친구 이름을 입력하십시오");
    const friends = readFriends(this.storage);
    if (friends.some((friend) => friend.name === trimmed)) throw new Error("이미 등록된 친구입니다");
    const friend: FriendSummary = { id: `friend-${Date.now()}-${friends.length}`, name: trimmed, online: false };
    writeFriends(this.storage, [...friends, friend]);
    return friend;
  }

  async removeFriend(id: string): Promise<void> {
    writeFriends(this.storage, readFriends(this.storage).filter((friend) => friend.id !== id));
  }

  async findAutoMatch(): Promise<MatchDescriptor> {
    await this.connect();
    this.emit({ state: "searching", sinceMs: Date.now() });
    this.send({ type: "find-match" });
    return new Promise<MatchDescriptor>((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }

  async inviteFriend(friendId: string): Promise<MatchDescriptor> {
    const friend = readFriends(this.storage).find((entry) => entry.id === friendId);
    if (!friend) throw new Error("친구를 찾을 수 없습니다");
    // Direct invites need presence and an account model; until then this falls
    // back to the auto queue rather than pretending to reach a specific person.
    this.emit({ state: "inviting", friend });
    return this.findAutoMatch();
  }

  cancel(): void {
    this.send({ type: "cancel" });
    this.pending?.reject(new Error("취소되었습니다"));
    this.pending = null;
    this.emit({ state: "idle" });
  }

  onStatusChange(listener: (status: MatchmakingStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Frames from the opponent, delivered to the lockstep loop. */
  onFrame(listener: (frame: LockstepFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onOpponentLeft(listener: (reason: string) => void): void {
    this.opponentLeft = listener;
  }

  sendFrame(frame: LockstepFrame): void {
    this.send({ type: "frame", frame });
  }

  private receive(raw: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (message.type === "matched") {
      const match: MatchDescriptor = {
        mode: "pvp",
        seed: String(message.seed),
        opponentName: String(message.opponentName),
        localTeam: message.localTeam === "enemy" ? "enemy" : "player",
        matchKind: "auto",
      };
      this.emit({ state: "matched", match });
      this.pending?.resolve(match);
      this.pending = null;
      return;
    }
    if (message.type === "frame") {
      const frame = message.frame as LockstepFrame | undefined;
      if (frame) this.frameListeners.forEach((listener) => listener(frame));
      return;
    }
    if (message.type === "opponent-left") {
      this.opponentLeft?.(String(message.reason ?? "상대가 대전을 떠났습니다"));
    }
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  private emit(status: MatchmakingStatus): void {
    this.listeners.forEach((listener) => listener(status));
  }
}

function readFriends(storage: Storage | null): FriendSummary[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(FRIENDS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is FriendSummary => {
      if (typeof value !== "object" || value === null) return false;
      const entry = value as Record<string, unknown>;
      return typeof entry.id === "string" && typeof entry.name === "string" && typeof entry.online === "boolean";
    });
  } catch {
    return [];
  }
}

function writeFriends(storage: Storage | null, friends: FriendSummary[]): void {
  if (!storage) return;
  try {
    storage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
  } catch {
    // Quota or private-browsing failures are not worth failing an add over.
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

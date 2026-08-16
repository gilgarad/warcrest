import type { LockstepFrame } from "./lockstepSession";
import type {
  FriendSummary,
  MatchDescriptor,
  MatchService,
  MatchmakingStatus,
} from "./matchTypes";

const FRIENDS_STORAGE_KEY = "warcrest.friends.v1";
const PLAYER_ID_STORAGE_KEY = "warcrest.playerId.v1";

/**
 * How the opponent's connection is doing, for the parts of the UI that have to
 * say something about it.
 *
 * `waiting` is recoverable and `left` is not, and the difference matters to the
 * player: one asks them to hold on, the other ends the match.
 */
export type OpponentPresence =
  | { state: "waiting"; reason: string; graceSec: number }
  | { state: "returned"; opponentName: string };

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
  /**
   * Frames that arrived before anything was listening.
   *
   * Both peers are told they matched at the same instant, then each builds its
   * battle scene — and whichever finishes first starts ticking and sending
   * frames while the other is still loading. Without this buffer those early
   * frames are dropped, the slower client never gets the opponent commands for
   * its first gated tick, and both sides sit at "waiting for opponent" forever.
   */
  private bufferedFrames: LockstepFrame[] = [];
  private pending: { resolve: (m: MatchDescriptor) => void; reject: (e: Error) => void } | null = null;
  private opponentLeft: ((reason: string) => void) | null = null;
  private opponentPresence: ((presence: OpponentPresence) => void) | null = null;

  constructor(
    private readonly url: string,
    private readonly storage: Storage | null = safeLocalStorage(),
  ) {}

  /**
   * Stands in for a real account.
   *
   * The relay holds a player's seat across a reconnect, which needs a name for
   * that seat that outlives the socket. There are no accounts yet, so this is a
   * random id kept in local storage and asserted by the client — enough to get
   * back into your own match, and deliberately not enough to be trusted. See
   * `docs/dev-wiki/pvp-reconnect.md`.
   */
  private localPlayerId(): string {
    const existing = this.storage?.getItem(PLAYER_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    try {
      this.storage?.setItem(PLAYER_ID_STORAGE_KEY, generated);
    } catch {
      // Without storage the id lasts one session; reconnect stops working, but
      // nothing else does.
    }
    return generated;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      const failed = () => reject(new Error("대전 서버에 연결하지 못했습니다"));
      socket.addEventListener("open", () => {
        this.socket = socket;
        socket.removeEventListener("error", failed);
        // Sent before anything else: it is what lets the relay recognise a
        // returning player and put them back in the seat they left.
        this.send({ type: "identify", playerId: this.localPlayerId() });
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
    if (this.bufferedFrames.length > 0) {
      const queued = this.bufferedFrames;
      this.bufferedFrames = [];
      for (const frame of queued) listener(frame);
    }
    return () => this.frameListeners.delete(listener);
  }

  onOpponentLeft(listener: (reason: string) => void): void {
    this.opponentLeft = listener;
  }

  /** Recoverable connection trouble on the opponent's side, distinct from a leave. */
  onOpponentPresence(listener: (presence: OpponentPresence) => void): void {
    this.opponentPresence = listener;
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
      // Never carry frames across matches.
      this.bufferedFrames = [];
      this.emit({ state: "matched", match });
      this.pending?.resolve(match);
      this.pending = null;
      return;
    }
    if (message.type === "frame") {
      const frame = message.frame as LockstepFrame | undefined;
      if (!frame) return;
      if (this.frameListeners.size === 0) this.bufferedFrames.push(frame);
      else this.frameListeners.forEach((listener) => listener(frame));
      return;
    }
    if (message.type === "opponent-disconnected") {
      this.opponentPresence?.({
        state: "waiting",
        reason: String(message.reason ?? "상대의 연결이 끊겼습니다"),
        graceSec: typeof message.graceSec === "number" ? message.graceSec : 0,
      });
      return;
    }
    if (message.type === "opponent-returned") {
      this.opponentPresence?.({ state: "returned", opponentName: String(message.opponentName ?? "상대") });
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

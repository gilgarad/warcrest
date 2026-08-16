import type {
  FriendSummary,
  MatchDescriptor,
  MatchService,
  MatchmakingStatus,
} from "./matchTypes";

const FRIENDS_STORAGE_KEY = "warcrest.friends.v1";

/**
 * Stand-in `MatchService` used until a relay exists.
 *
 * It is honest about what it is: there is no server, so it cannot connect two
 * humans. Auto-match and invites resolve to a *local* opponent after a short
 * delay, which lets the lobby flow, the mode plumbing and the battle handover
 * be built and tested now. The friend list is real, just stored in
 * `localStorage` rather than on an account.
 *
 * Swapping this for a networked implementation should not require touching the
 * lobby UI — that is the point of `MatchService`.
 */
export class LocalMatchService implements MatchService {
  private listeners = new Set<(status: MatchmakingStatus) => void>();
  private pending: ReturnType<typeof setTimeout> | null = null;
  /** Rejector for the in-flight request, so `cancel()` settles it rather than
   * leaving the caller awaiting a promise that can never resolve. */
  private pendingReject: ((reason: Error) => void) | null = null;

  constructor(
    private readonly storage: Storage | null = safeLocalStorage(),
    private readonly delayMs = 1400,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getFriends(): Promise<FriendSummary[]> {
    return this.readFriends();
  }

  async addFriend(name: string): Promise<FriendSummary> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("친구 이름을 입력하십시오");
    const friends = this.readFriends();
    if (friends.some((friend) => friend.name === trimmed)) {
      throw new Error("이미 등록된 친구입니다");
    }
    const friend: FriendSummary = {
      id: `friend-${this.now()}-${friends.length}`,
      name: trimmed,
      // Without a presence service there is nothing truthful to show, so
      // everyone reads as offline rather than pretending to be online.
      online: false,
    };
    this.writeFriends([...friends, friend]);
    return friend;
  }

  async removeFriend(id: string): Promise<void> {
    this.writeFriends(this.readFriends().filter((friend) => friend.id !== id));
  }

  findAutoMatch(): Promise<MatchDescriptor> {
    this.emit({ state: "searching", sinceMs: this.now() });
    return this.settle(() => ({
      mode: "pvp",
      seed: `pvp-${this.now()}`,
      opponentName: "연습 상대",
      localTeam: "player",
      matchKind: "auto",
    }));
  }

  async inviteFriend(friendId: string): Promise<MatchDescriptor> {
    const friend = this.readFriends().find((entry) => entry.id === friendId);
    if (!friend) throw new Error("친구를 찾을 수 없습니다");
    this.emit({ state: "inviting", friend });
    return this.settle(() => ({
      mode: "pvp",
      seed: `pvp-${friend.id}-${this.now()}`,
      opponentName: friend.name,
      localTeam: "player",
      matchKind: "friend",
    }));
  }

  cancel(): void {
    if (this.pending !== null) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    const reject = this.pendingReject;
    this.pendingReject = null;
    this.emit({ state: "idle" });
    reject?.(new Error("취소되었습니다"));
  }

  onStatusChange(listener: (status: MatchmakingStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private settle(build: () => MatchDescriptor): Promise<MatchDescriptor> {
    return new Promise((resolve, reject) => {
      this.pendingReject = reject;
      this.pending = setTimeout(() => {
        this.pending = null;
        this.pendingReject = null;
        const match = build();
        this.emit({ state: "matched", match });
        resolve(match);
      }, this.delayMs);
    });
  }

  private emit(status: MatchmakingStatus): void {
    this.listeners.forEach((listener) => listener(status));
  }

  private readFriends(): FriendSummary[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(FRIENDS_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isFriendSummary);
    } catch {
      // A corrupt or unreadable entry should not take the lobby down with it.
      return [];
    }
  }

  private writeFriends(friends: FriendSummary[]): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
    } catch {
      // Private-browsing quota errors are not worth failing an add over.
    }
  }
}

function isFriendSummary(value: unknown): value is FriendSummary {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string"
    && typeof entry.name === "string"
    && typeof entry.online === "boolean";
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

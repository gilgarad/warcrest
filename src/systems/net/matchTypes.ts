import type { DifficultyId } from "../../data/difficulty";

/**
 * How a battle is being driven.
 *
 * Both modes run the *same* simulation — `LaneBattleScene` does not branch into
 * a separate PvP implementation. The only difference is where the opposing
 * side's commands come from: a local `AiController` in `single`, a remote peer
 * in `pvp`. Anything improved in the simulation therefore applies to both by
 * construction.
 */
export type GameMode = "single" | "pvp";

export type MatchKind = "auto" | "friend";

export interface FriendSummary {
  id: string;
  name: string;
  online: boolean;
}

/** Everything a battle needs to start, whoever the opponent turns out to be. */
export interface MatchDescriptor {
  mode: GameMode;
  /** Shared simulation seed. Both peers must start from the same value. */
  seed: string;
  /** Only meaningful in `single`; PvP has no difficulty setting. */
  difficultyId?: DifficultyId;
  opponentName: string;
  /** Which side this client plays. Decided by the match, not by the client. */
  localTeam: "player" | "enemy";
  matchKind?: MatchKind;
}

export type MatchmakingStatus =
  | { state: "idle" }
  | { state: "searching"; sinceMs: number }
  | { state: "inviting"; friend: FriendSummary }
  | { state: "matched"; match: MatchDescriptor }
  | { state: "failed"; reason: string };

/**
 * The seam the real network layer will implement.
 *
 * Kept deliberately small and transport-agnostic: a WebSocket relay, a
 * server-authoritative host, or a WebRTC peer can all satisfy it without the
 * lobby UI changing.
 */
export interface MatchService {
  /**
   * Establish the connection, if the implementation has one.
   *
   * Called when the lobby opens rather than when a button is pressed: a relay
   * can only recognise a returning player after that player has identified
   * themselves, so the socket has to exist before anyone asks for a match.
   */
  connect(): Promise<void>;
  getFriends(): Promise<FriendSummary[]>;
  addFriend(name: string): Promise<FriendSummary>;
  removeFriend(id: string): Promise<void>;
  /** Begin auto-matchmaking. Resolves when a match is found or fails. */
  findAutoMatch(): Promise<MatchDescriptor>;
  /** Challenge a specific friend. */
  inviteFriend(friendId: string): Promise<MatchDescriptor>;
  /** Abandon whatever request is in flight. */
  cancel(): void;
  onStatusChange(listener: (status: MatchmakingStatus) => void): () => void;
}

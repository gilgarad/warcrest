/**
 * The "waiting for the opponent to come back" line.
 *
 * Kept apart from the scene because it is the only part with any logic in it:
 * the message has to be recomputed every frame so the remaining time actually
 * counts down. The first version baked the number into a string once, which
 * left "(60초)" frozen on screen for the whole minute and gave the player no
 * idea whether anything was still happening.
 */
export interface OpponentWait {
  reason: string;
  /** Scene clock reading, in ms, at which the relay stops holding the seat. */
  deadlineMs: number;
}

/** Whole seconds left, never negative. */
export function remainingGraceSec(wait: OpponentWait, nowMs: number): number {
  return Math.max(0, Math.ceil((wait.deadlineMs - nowMs) / 1000));
}

export function opponentWaitNotice(wait: OpponentWait, nowMs: number): string {
  return `${wait.reason} (${remainingGraceSec(wait, nowMs)}초)`;
}

/**
 * Why a networked match ended, and what that means for the local player.
 *
 * Both endings leave this client as the only one still playing, so both are
 * wins: the opponent either quit outright or failed to come back before the
 * relay gave up holding their seat.
 */
export function disconnectVictorySummary(reason: string): string {
  return `${reason}\n상대의 접속이 끊겨 승리했습니다.`;
}

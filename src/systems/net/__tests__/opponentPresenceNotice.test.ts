import { describe, expect, it } from "vitest";
import {
  disconnectVictorySummary,
  opponentWaitNotice,
  remainingGraceSec,
} from "../opponentPresenceNotice";

const wait = { reason: "상대의 연결이 끊겼습니다", deadlineMs: 60_000 };

describe("opponent wait notice", () => {
  /**
   * The defect this guards: the message was built once, when the drop was
   * reported, so "(60초)" stayed on screen unchanged for the whole minute and
   * looked like the game had frozen rather than like a countdown.
   */
  it("counts down as time passes", () => {
    expect(remainingGraceSec(wait, 0)).toBe(60);
    expect(remainingGraceSec(wait, 15_000)).toBe(45);
    expect(remainingGraceSec(wait, 59_000)).toBe(1);
  });

  it("never shows a negative figure", () => {
    // The relay's timer and the scene's clock are independent, so the deadline
    // can pass before the closing message arrives.
    expect(remainingGraceSec(wait, 60_500)).toBe(0);
    expect(remainingGraceSec(wait, 999_999)).toBe(0);
  });

  it("rounds up, so the last second is not shown as zero early", () => {
    expect(remainingGraceSec(wait, 59_400)).toBe(1);
  });

  it("puts the remaining seconds in the line", () => {
    expect(opponentWaitNotice(wait, 20_000)).toBe("상대의 연결이 끊겼습니다 (40초)");
  });

  it("keeps the relay's reason in the victory summary", () => {
    // The player should be told which of the two endings happened -- a quit and
    // a failure to return are both wins, but they are not the same event.
    expect(disconnectVictorySummary("상대가 돌아오지 않았습니다"))
      .toContain("상대가 돌아오지 않았습니다");
    expect(disconnectVictorySummary("상대가 돌아오지 않았습니다")).toContain("승리");
  });
});

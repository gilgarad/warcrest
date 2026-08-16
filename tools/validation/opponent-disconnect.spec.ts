import { expect, test, type Page } from "@playwright/test";

/**
 * What the remaining player sees when the opponent drops.
 *
 * Driven by feeding the scene the relay messages directly rather than by
 * running a real match and closing one side: the grace period is a minute, and
 * a test that waits that out would not be run. The messages are the relay's
 * actual wire shapes, so the client path under test is the real one.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1";

test.describe.configure({ timeout: 180_000 });

async function openMatch(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 820 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 90_000 });
  await page.waitForTimeout(800);
}

/** The standing network line, or null when nothing is shown. */
const networkLine = (page: Page): Promise<string | null> => page.evaluate(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  const scene = game.scene.getScene("run");
  if (!scene?.scene.isActive()) return null;
  const line = scene.children.list.find((child) => {
    const text = child as Phaser.GameObjects.Text;
    return typeof text.text === "string" && text.visible && text.text.includes("상대");
  }) as Phaser.GameObjects.Text | undefined;
  return line?.text ?? null;
});

/**
 * Feeds the scene a dropout as though it came from the relay.
 *
 * A lockstep session has to be in place for the network line to be drawn at
 * all — it is only reported for networked matches — so this stands one in. The
 * stub answers the handful of calls the frame loop makes on it; without it the
 * scene stays in single-player mode and never renders a status line.
 */
async function reportDrop(page: Page, graceSec: number): Promise<void> {
  await page.evaluate((sec) => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run") as unknown as {
      lockstep: unknown;
      opponentWait: { reason: string; deadlineMs: number } | null;
      time: { now: number };
    };
    scene.lockstep = {
      getDesync: () => null,
      canAdvance: () => true,
      commandsFor: () => [],
      release: () => {},
      shouldHashAt: () => false,
      inputDelayTicks: 3,
    };
    scene.opponentWait = {
      reason: "상대의 연결이 끊겼습니다 — 재접속을 기다립니다",
      deadlineMs: scene.time.now + sec * 1000,
    };
  }, graceSec);
}

test("the wait notice counts down instead of standing still", async ({ page }) => {
  await openMatch(page);
  await reportDrop(page, 60);
  await page.waitForTimeout(300);
  const first = await networkLine(page);
  expect(first, "no waiting line appeared").toContain("초)");

  await page.waitForTimeout(3000);
  const later = await networkLine(page);
  expect(later).toContain("초)");

  const seconds = (line: string | null) => Number(/\((\d+)초\)/.exec(line ?? "")?.[1] ?? -1);
  // Frozen text was the whole complaint, so equality here is the failure.
  expect(seconds(later), `still showing ${later}`).toBeLessThan(seconds(first));
});

test("an opponent who never returns is a win, not a stuck match", async ({ page }) => {
  await openMatch(page);
  await page.evaluate(() => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run") as unknown as {
      endMatchByDisconnect: (reason: string) => void;
    };
    scene.endMatchByDisconnect("상대가 돌아오지 않았습니다");
  });
  await page.waitForTimeout(1200);

  const result = await page.evaluate(() => (window as unknown as {
    __gameDebug?: { phase: string; win: boolean };
  }).__gameDebug);
  expect(result?.phase, "the match did not end").toBe("gameover");
  expect(result?.win, "a disconnect left the remaining player with a loss").toBe(true);
});

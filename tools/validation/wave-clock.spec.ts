import { expect, test } from "@playwright/test";

/**
 * Both sides must get waves regardless of who is playing them.
 *
 * The wave clock used to be advanced in two places: the scene ticked the left
 * team's, and the AI controller ticked the right team's. That reads as a
 * harmless split for as long as every right-hand side is an AI — and PvP turns
 * the AI off, which stopped that side's clock dead. No waves ever spawned for
 * the right-hand player, and the instant-wave button, whose cooldown is
 * measured by the same clock, never left cooldown.
 *
 * Driving the simulation directly rather than waiting on real time: forty
 * seconds of wall clock per assertion would make this unusable, and the whole
 * point of the fixed timestep is that stepping by hand is equivalent.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1&seed=wave-clock";

test.describe.configure({ timeout: 180_000 });

test("both teams' wave clocks advance and both spawn units", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 820 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 90_000 });

  const report = await page.evaluate(() => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run") as unknown as {
      simulation: { step: () => void };
      player: { nextWaveInSec: number; lastWaveElapsedSec: number };
      enemy: { nextWaveInSec: number; lastWaveElapsedSec: number };
      units: { team: string }[];
    };
    const before = {
      player: scene.player.nextWaveInSec,
      enemy: scene.enemy.nextWaveInSec,
    };
    // 1500 ticks at 1/30s is fifty simulated seconds — comfortably past the
    // first wave for both sides.
    for (let i = 0; i < 1500; i += 1) scene.simulation.step();
    return {
      before,
      playerElapsed: scene.player.lastWaveElapsedSec,
      enemyElapsed: scene.enemy.lastWaveElapsedSec,
      playerUnits: scene.units.filter((unit) => unit.team === "player").length,
      enemyUnits: scene.units.filter((unit) => unit.team === "enemy").length,
    };
  });

  // A clock that never ticks leaves this at its starting value.
  expect(report.playerElapsed, "left team's wave clock did not advance").toBeGreaterThan(0);
  expect(report.enemyElapsed, "right team's wave clock did not advance").toBeGreaterThan(0);

  expect(report.playerUnits, "left team spawned no units").toBeGreaterThan(0);
  expect(report.enemyUnits, "right team spawned no units").toBeGreaterThan(0);
});

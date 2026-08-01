import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __audioDebugControl: {
      unlock: () => Promise<void>;
      playSfx: (id: string) => string;
      setCombatSfxMode: (mode: "off" | "reduced" | "full") => void;
      setVolumes: (master: number, bgm: number, sfx: number) => void;
      getState: () => {
        unlocked: boolean;
        contextState: string;
        focusMuted: boolean;
        recentEvents: Array<{ id: string; result: string }>;
      };
    };
  }
}

async function openBrowser(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/game_project1/tools/audio-browser/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#unlockBtn")).toBeVisible({ timeout: 60_000 });
  await page.bringToFront();
  await page.locator("#unlockBtn").click();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => page.evaluate(() => window.__audioDebugControl.getState().unlocked)).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__audioDebugControl.getState().contextState)).toBe("running");
  await expect.poll(async () => page.evaluate(() => window.__audioDebugControl.getState().focusMuted)).toBe(false);
  await page.evaluate(() => {
    window.__audioDebugControl.setCombatSfxMode("full");
    window.__audioDebugControl.setVolumes(1, 1, 1);
  });
}

async function selectAssetByFileName(
  page: import("@playwright/test").Page,
  fileName: string,
): Promise<void> {
  const clicked = await page.evaluate((nextFileName) => {
    const rows = [...document.querySelectorAll(".file")];
    for (const row of rows) {
      const name = row.querySelector(".file-name")?.textContent?.trim();
      if (name === nextFileName) {
        (row.querySelector("button") as HTMLButtonElement | null)?.click();
        return true;
      }
    }
    return false;
  }, fileName);
  expect(clicked).toBe(true);
}

test("audio browser exposes round-2 combat SFX fixes", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });

  await openBrowser(page);

  await selectAssetByFileName(page, "combat-bowFire.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("bowTwang");
  await selectAssetByFileName(page, "combat-bluntAttack.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("heavyImpact");

  const firstAttack = await page.evaluate(() => window.__audioDebugControl.playSfx("sfx.combat.attackShout"));
  const secondAttack = await page.evaluate(() => window.__audioDebugControl.playSfx("sfx.combat.attackShout"));
  expect(firstAttack).toBe("played");
  expect(secondAttack).toBe("cooldown");
  await expect
    .poll(() => warnings.some((line) => line.includes("SFX sfx.combat.attackShout skipped: cooldown")))
    .toBe(true);

  const recent = await page.evaluate(() => window.__audioDebugControl.getState().recentEvents);
  expect(recent.some((event) => event.id === "sfx.combat.attackShout" && event.result === "played")).toBe(true);
  expect(recent.some((event) => event.id === "sfx.combat.attackShout" && event.result === "cooldown")).toBe(true);
});

import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/audio-signal";
const PHASE = process.env.AUDIO_CAPTURE_PHASE === "before" ? "before" : "after";

interface SignalMeasurement {
  rms: number;
  peak: number;
  frameRms: number[];
  waveform: number[];
  contextState: string;
}

function waveformSvg(measurements: Record<string, SignalMeasurement>): string {
  const width = 960;
  const rowHeight = 180;
  const rows = Object.entries(measurements);
  const paths = rows.map(([label, measurement], row) => {
    const center = row * rowHeight + 92;
    const points = measurement.waveform.map((value, index) => {
      const x = 24 + index * (width - 48) / Math.max(1, measurement.waveform.length - 1);
      const y = center - value * 380;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<text x="24" y="${row * rowHeight + 28}" fill="#dbe9ff" font-size="18">${label} RMS ${measurement.rms.toFixed(5)} peak ${measurement.peak.toFixed(5)}</text><line x1="24" y1="${center}" x2="936" y2="${center}" stroke="#31455f"/><polyline points="${points}" fill="none" stroke="#69b7ff" stroke-width="2"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rows.length * rowHeight}" viewBox="0 0 ${width} ${rows.length * rowHeight}"><rect width="100%" height="100%" fill="#0b1420"/>${paths}</svg>`;
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openAudioLab(page: Page): Promise<void> {
  await page.goto("/warcrest/tools/audio-lab/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#unlockBtn")).toBeVisible({ timeout: 60_000 });
}

test(`captures ${PHASE} actual output-bus energy`, async ({ page }) => {
  await openAudioLab(page);
  await page.locator("#unlockBtn").click();
  await page.locator("#resetSettingsBtn").click();
  await expect(page.locator("#unlockStatus")).toContainText("활성화됨");

  const measure = (): Promise<SignalMeasurement> => page.evaluate(() => (
    (window as unknown as {
      __audioDebugControl: { measureOutputSignal: (durationMs: number) => Promise<SignalMeasurement> };
    }).__audioDebugControl.measureOutputSignal(1200)
  ));
  const measurements: Record<string, SignalMeasurement> = {};
  for (const id of ["bgm.menu", "bgm.preparation"] as const) {
    await page.locator(`[data-asset-id="${id}"]`).click();
    await page.waitForTimeout(1400);
    measurements[id] = await measure();
  }
  for (const id of ["bgm.battle.low", "bgm.battle.high"] as const) {
    await page.locator(`[data-asset-id="${id}"]`).click();
    await page.waitForTimeout(900);
    measurements[id] = await measure();
    await page.waitForTimeout(3300);
    measurements[`${id}.sustain`] = await measure();
    await page.waitForTimeout(3600);
    measurements[`${id}.escalation`] = await measure();
  }
  await page.locator("#muteCheck").check();
  await page.waitForTimeout(700);
  measurements.muted = await measure();

  expect(measurements["bgm.battle.low"].contextState).toBe("running");
  expect(measurements["bgm.battle.high"].contextState).toBe("running");
  expect(measurements["bgm.menu"].rms).toBeGreaterThan(0.001);
  expect(measurements["bgm.preparation"].rms).toBeGreaterThan(0.001);
  expect(measurements.muted.rms).toBeLessThan(0.0001);
  if (PHASE === "after") {
    expect(measurements["bgm.battle.low"].rms).toBeGreaterThan(0.0035);
    expect(measurements["bgm.battle.high"].rms).toBeGreaterThan(0.0055);
    expect(measurements["bgm.battle.high"].rms).toBeGreaterThan(measurements["bgm.battle.low"].rms);
    expect(measurements["bgm.battle.low.escalation"].rms).toBeGreaterThan(measurements["bgm.battle.low"].rms * 0.9);
    expect(measurements["bgm.battle.high.escalation"].peak).toBeGreaterThan(0.04);
  }

  writeFileSync(`${ARTIFACT_DIR}/${PHASE}-signal.json`, JSON.stringify(measurements, null, 2));
  writeFileSync(`${ARTIFACT_DIR}/${PHASE}-waveform.svg`, waveformSvg(measurements));
});

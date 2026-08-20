import { test } from "@playwright/test";
test.describe.configure({ timeout: 400_000 });
test("overlaps", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/warcrest/?autostart=1");
  await page.waitForFunction(() => Boolean((window as any).__warcrestGame?.scene.getScene("run")?.scene.isActive()), undefined, { timeout: 300_000 });
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = (window as any).__warcrestGame;
    const s: any = g.scene.getScene("run");
    const items: any[] = [];
    for (const c of s.children.list) {
      const o: any = c;
      if (!o.visible || o.scrollFactorX !== 0 || !o.getBounds) continue;
      if (typeof o.text !== "string" || !o.text.trim()) continue;
      const b = o.getBounds();
      if (b.left < -500) continue;
      items.push({ t: o.text.slice(0, 14).replace(/\n/g, "/"), l: Math.round(b.left), r: Math.round(b.right), tp: Math.round(b.top), bt: Math.round(b.bottom) });
    }
    const hits: string[] = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.l < b.r && b.l < a.r && a.tp < b.bt && b.tp < a.bt) hits.push(`"${a.t}"[${a.l}-${a.r}] ↔ "${b.t}"[${b.l}-${b.r}]`);
    }
    return { count: items.length, hits: hits.slice(0, 12) };
  });
  console.log(`텍스트 ${out.count}개, 겹침 ${out.hits.length}건`);
  out.hits.forEach((h: string) => console.log("  " + h));
});

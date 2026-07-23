import Phaser from "phaser";

export interface ChibiPalette {
  skin: number;
  outfit: number;
  accent: number;
  outline?: number;
}

const DEFAULT_OUTLINE = 0x1a1a24;
const BASE_W = 40;
const BASE_H = 52;

export function shade(color: number, amount: number): number {
  // amount > 0 lightens toward white, < 0 darkens toward black
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/**
 * Procedurally draws a cute big-head-small-body ("가분수") character with
 * simple pseudo-3D shading (a highlight + shadow pass and a dark outline,
 * rather than flat single-color fills) onto a generated texture. No image
 * assets involved — this stands in for real AI-generated art (no
 * image-generation tool is available in this environment). Everything is
 * expressed as a fraction of `BASE_W`/`BASE_H` scaled by `s`, so requesting
 * a different `width`/`height` stays proportional instead of just cropping.
 */
export function drawChibiTexture(
  scene: Phaser.Scene,
  key: string,
  palette: ChibiPalette,
  opts: { width?: number; height?: number } = {}
): string {
  if (scene.textures.exists(key)) return key;

  const w = opts.width ?? BASE_W;
  const h = opts.height ?? BASE_H;
  const s = w / BASE_W;
  const outline = palette.outline ?? DEFAULT_OUTLINE;
  const outfitDark = shade(palette.outfit, -0.35);
  const outfitLight = shade(palette.outfit, 0.25);
  const skinShadow = shade(palette.skin, -0.18);
  const accentDark = shade(palette.accent, -0.3);

  const g = scene.add.graphics();
  const cx = w / 2;

  // ground shadow
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(cx, h - 3 * s, w * 0.55, 6 * s);

  // legs (shadowed inner leg, lit outer leg for a rounded look)
  g.fillStyle(outfitDark, 1);
  g.fillRoundedRect(cx - 9 * s, h - 19 * s, 7 * s, 15 * s, 3 * s);
  g.fillStyle(palette.outfit, 1);
  g.fillRoundedRect(cx + 2 * s, h - 19 * s, 7 * s, 15 * s, 3 * s);

  // body: base fill + a lighter top-left facet and darker bottom-right facet
  g.fillStyle(palette.outfit, 1);
  g.fillRoundedRect(cx - 12 * s, h - 33 * s, 24 * s, 18 * s, 7 * s);
  g.fillStyle(outfitLight, 0.5);
  g.fillRoundedRect(cx - 12 * s, h - 33 * s, 14 * s, 9 * s, 5 * s);
  g.fillStyle(outfitDark, 0.35);
  g.fillRoundedRect(cx - 2 * s, h - 20 * s, 14 * s, 8 * s, 5 * s);
  g.lineStyle(Math.max(1, 1.2 * s), outline, 0.5);
  g.strokeRoundedRect(cx - 12 * s, h - 33 * s, 24 * s, 18 * s, 7 * s);

  // arms
  g.fillStyle(skinShadow, 1);
  g.fillRoundedRect(cx - 17 * s, h - 31 * s, 6 * s, 13 * s, 3 * s);
  g.fillStyle(palette.skin, 1);
  g.fillRoundedRect(cx + 11 * s, h - 31 * s, 6 * s, 13 * s, 3 * s);

  // head — oversized relative to the body on purpose (chibi proportions)
  const headR = w * 0.4;
  const headCy = headR + 3 * s;
  g.fillStyle(palette.skin, 1);
  g.fillCircle(cx, headCy, headR);
  // spherical shading: soft shadow lower-right, soft highlight upper-left
  g.fillStyle(skinShadow, 0.4);
  g.fillEllipse(cx + headR * 0.32, headCy + headR * 0.35, headR * 1.1, headR * 0.9);
  g.fillStyle(0xffffff, 0.22);
  g.fillEllipse(cx - headR * 0.35, headCy - headR * 0.4, headR * 0.75, headR * 0.55);

  // cap: a colored ellipse sitting on the upper head, with a brim strip
  g.fillStyle(palette.accent, 1);
  g.fillEllipse(cx, headCy - headR * 0.55, headR * 1.35, headR * 0.85);
  g.fillStyle(0xffffff, 0.2);
  g.fillEllipse(cx - headR * 0.25, headCy - headR * 0.75, headR * 0.6, headR * 0.3);
  g.fillStyle(palette.skin, 1);
  g.fillEllipse(cx, headCy - headR * 0.05, headR * 1.05, headR * 0.6);
  g.fillStyle(palette.accent, 1);
  g.fillRoundedRect(cx - headR * 0.95, headCy - headR * 0.2, headR * 1.9, headR * 0.3, 3 * s);
  g.fillStyle(accentDark, 0.5);
  g.fillRoundedRect(cx - headR * 0.95, headCy - headR * 0.06, headR * 1.9, headR * 0.16, 2 * s);

  // head outline for a cleaner silhouette against textured floors
  g.lineStyle(Math.max(1, 1.2 * s), outline, 0.55);
  g.strokeCircle(cx, headCy, headR);

  // blush
  g.fillStyle(0xff9bab, 0.55);
  g.fillCircle(cx - headR * 0.5, headCy + headR * 0.25, 3 * s);
  g.fillCircle(cx + headR * 0.5, headCy + headR * 0.25, 3 * s);

  // eyes (with a small highlight for sparkle)
  const eyeY = headCy + headR * 0.1;
  g.fillStyle(outline, 1);
  g.fillCircle(cx - headR * 0.32, eyeY, 2.6 * s);
  g.fillCircle(cx + headR * 0.32, eyeY, 2.6 * s);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - headR * 0.32 + 0.9 * s, eyeY - 0.9 * s, 0.9 * s);
  g.fillCircle(cx + headR * 0.32 + 0.9 * s, eyeY - 0.9 * s, 0.9 * s);

  // smile
  g.fillStyle(outline, 0.7);
  g.fillRoundedRect(cx - 2.5 * s, headCy + headR * 0.42, 5 * s, 1.6 * s, 0.8 * s);

  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

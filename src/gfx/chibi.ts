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
 * Procedurally draws a chunky, bright, big-head-small-body character —
 * styled after mobile "toy soldier" games (Clash of Clans/Royale) rather
 * than a flat sprite: saturated colors, thick rounded shapes, a bold dark
 * outline, and a strong glossy highlight to fake toon-shaded 3D lighting.
 * No image assets involved — this stands in for real 3D-rendered art (no
 * image-generation/3D tool is available in this environment). Everything is
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
  const lw = Math.max(1.2, 1.8 * s);
  const outfitDark = shade(palette.outfit, -0.4);
  const skinShadow = shade(palette.skin, -0.16);
  const accentDark = shade(palette.accent, -0.35);

  const g = scene.add.graphics();
  const cx = w / 2;

  // ground shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, h - 2 * s, w * 0.6, 6 * s);

  // legs — thick and rounded
  g.fillStyle(outfitDark, 1);
  g.fillRoundedRect(cx - 10 * s, h - 18 * s, 8 * s, 15 * s, 4 * s);
  g.fillStyle(palette.outfit, 1);
  g.fillRoundedRect(cx + 2 * s, h - 18 * s, 8 * s, 15 * s, 4 * s);

  // body — big rounded blob, strong top-left gloss highlight
  g.fillStyle(palette.outfit, 1);
  g.fillRoundedRect(cx - 14 * s, h - 34 * s, 28 * s, 20 * s, 10 * s);
  g.fillStyle(0xffffff, 0.32);
  g.fillEllipse(cx - 4 * s, h - 28 * s, 14 * s, 9 * s);
  g.fillStyle(outfitDark, 0.3);
  g.fillRoundedRect(cx - 2 * s, h - 20 * s, 15 * s, 6 * s, 5 * s);
  g.lineStyle(lw, outline, 0.9);
  g.strokeRoundedRect(cx - 14 * s, h - 34 * s, 28 * s, 20 * s, 10 * s);

  // arms — thick, rounded ends
  g.fillStyle(skinShadow, 1);
  g.fillRoundedRect(cx - 19 * s, h - 31 * s, 7 * s, 14 * s, 3.5 * s);
  g.fillStyle(palette.skin, 1);
  g.fillRoundedRect(cx + 12 * s, h - 31 * s, 7 * s, 14 * s, 3.5 * s);

  // head — big, round, chibi-oversized
  const headR = w * 0.42;
  const headCy = headR + 2 * s;
  g.fillStyle(palette.skin, 1);
  g.fillCircle(cx, headCy, headR);
  // spherical shading: soft shadow lower-right, strong glossy highlight upper-left
  g.fillStyle(skinShadow, 0.35);
  g.fillEllipse(cx + headR * 0.3, headCy + headR * 0.4, headR * 1.05, headR * 0.85);
  g.fillStyle(0xffffff, 0.4);
  g.fillEllipse(cx - headR * 0.38, headCy - headR * 0.42, headR * 0.7, headR * 0.5);

  // cap: a colored ellipse sitting on the upper head, with a bold brim strip
  g.fillStyle(palette.accent, 1);
  g.fillEllipse(cx, headCy - headR * 0.55, headR * 1.4, headR * 0.9);
  g.fillStyle(0xffffff, 0.3);
  g.fillEllipse(cx - headR * 0.28, headCy - headR * 0.78, headR * 0.55, headR * 0.28);
  g.fillStyle(palette.skin, 1);
  g.fillEllipse(cx, headCy - headR * 0.05, headR * 1.05, headR * 0.6);
  g.fillStyle(palette.accent, 1);
  g.fillRoundedRect(cx - headR * 0.98, headCy - headR * 0.22, headR * 1.96, headR * 0.32, 3 * s);
  g.fillStyle(accentDark, 0.55);
  g.fillRoundedRect(cx - headR * 0.98, headCy - headR * 0.06, headR * 1.96, headR * 0.16, 2 * s);

  // bold head outline for a clean silhouette (CoC/toy-figure look)
  g.lineStyle(lw, outline, 0.9);
  g.strokeCircle(cx, headCy, headR);

  // blush
  g.fillStyle(0xff8fa3, 0.6);
  g.fillCircle(cx - headR * 0.52, headCy + headR * 0.27, 3.2 * s);
  g.fillCircle(cx + headR * 0.52, headCy + headR * 0.27, 3.2 * s);

  // big expressive eyes with sparkle highlight
  const eyeY = headCy + headR * 0.1;
  g.fillStyle(outline, 1);
  g.fillCircle(cx - headR * 0.33, eyeY, 3.1 * s);
  g.fillCircle(cx + headR * 0.33, eyeY, 3.1 * s);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - headR * 0.33 + 1 * s, eyeY - 1 * s, 1.1 * s);
  g.fillCircle(cx + headR * 0.33 + 1 * s, eyeY - 1 * s, 1.1 * s);

  // smile
  g.fillStyle(outline, 0.75);
  g.fillRoundedRect(cx - 2.8 * s, headCy + headR * 0.44, 5.6 * s, 1.8 * s, 0.9 * s);

  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

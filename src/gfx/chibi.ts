import Phaser from "phaser";

export interface ChibiPalette {
  skin: number;
  outfit: number;
  accent: number;
  outline?: number;
}

const DEFAULT_OUTLINE = 0x2b2b3a;

/**
 * Procedurally draws a cute big-head-small-body ("가분수") character onto a
 * generated texture and returns its key. No image assets involved — this is
 * a placeholder art pipeline standing in for real AI-generated pixel art
 * (no image-generation tool is available in this environment). Anything
 * that consumes the returned key (a plain texture key) doesn't care how the
 * pixels were produced, so swapping in real sprite sheets later only means
 * changing this function, not its callers.
 */
export function drawChibiTexture(
  scene: Phaser.Scene,
  key: string,
  palette: ChibiPalette,
  opts: { width?: number; height?: number } = {}
): string {
  if (scene.textures.exists(key)) return key;

  const w = opts.width ?? 40;
  const h = opts.height ?? 52;
  const outline = palette.outline ?? DEFAULT_OUTLINE;
  const g = scene.add.graphics();
  const cx = w / 2;

  // ground shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, h - 3, w * 0.55, 6);

  // legs
  g.fillStyle(palette.outfit, 1);
  g.fillRoundedRect(cx - 9, h - 19, 7, 15, 3);
  g.fillRoundedRect(cx + 2, h - 19, 7, 15, 3);

  // body
  g.fillRoundedRect(cx - 12, h - 33, 24, 18, 7);

  // arms
  g.fillStyle(palette.skin, 1);
  g.fillRoundedRect(cx - 17, h - 31, 6, 13, 3);
  g.fillRoundedRect(cx + 11, h - 31, 6, 13, 3);

  // head — oversized relative to the body on purpose (chibi proportions)
  const headR = w * 0.4;
  const headCy = headR + 3;
  g.fillStyle(palette.skin, 1);
  g.fillCircle(cx, headCy, headR);

  // cap: a colored ellipse sitting on the upper head, with a brim strip
  g.fillStyle(palette.accent, 1);
  g.fillEllipse(cx, headCy - headR * 0.55, headR * 1.35, headR * 0.85);
  g.fillStyle(palette.skin, 1);
  g.fillEllipse(cx, headCy - headR * 0.05, headR * 1.05, headR * 0.6);
  g.fillStyle(palette.accent, 1);
  g.fillRoundedRect(cx - headR * 0.95, headCy - headR * 0.2, headR * 1.9, headR * 0.3, 3);

  // blush
  g.fillStyle(0xff9bab, 0.55);
  g.fillCircle(cx - headR * 0.5, headCy + headR * 0.25, 3);
  g.fillCircle(cx + headR * 0.5, headCy + headR * 0.25, 3);

  // eyes (with a small highlight for sparkle)
  const eyeY = headCy + headR * 0.1;
  g.fillStyle(outline, 1);
  g.fillCircle(cx - headR * 0.32, eyeY, 2.6);
  g.fillCircle(cx + headR * 0.32, eyeY, 2.6);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - headR * 0.32 + 0.9, eyeY - 0.9, 0.9);
  g.fillCircle(cx + headR * 0.32 + 0.9, eyeY - 0.9, 0.9);

  // smile
  g.fillStyle(outline, 0.7);
  g.fillRoundedRect(cx - 2.5, headCy + headR * 0.42, 5, 1.6, 0.8);

  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

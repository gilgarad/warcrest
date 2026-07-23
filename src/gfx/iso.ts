import Phaser from "phaser";
import { shade } from "./chibi";

/**
 * Isometric (2:1 dimetric) projection helpers. Game *logic* (movement,
 * collision, fog radius, minimap) stays entirely in orthogonal tile space —
 * only drawing positions go through this projection. See
 * `docs/patterns/README.md` for why the logic/visual split exists.
 */
export const ISO_TILE_W = 28;
export const ISO_TILE_H = 14;
export const WALL_HEIGHT = 16;
const WALL_PAD = 2;

export function wallBlockTextureSize(): { w: number; h: number } {
  return { w: ISO_TILE_W + WALL_PAD * 2, h: ISO_TILE_H + WALL_HEIGHT + WALL_PAD * 2 };
}

/** Origin fraction so placing the Image at a tile's iso point aligns the diamond's center, not the texture's bounding box. */
export function wallBlockOrigin(): { x: number; y: number } {
  const { h } = wallBlockTextureSize();
  return { x: 0.5, y: (WALL_PAD + ISO_TILE_H / 2) / h };
}

export interface IsoPoint {
  x: number;
  y: number;
}

/** Projects a (possibly fractional) tile coordinate to iso screen space. */
export function isoProject(tx: number, ty: number, originX: number, originY: number): IsoPoint {
  return {
    x: originX + (tx - ty) * (ISO_TILE_W / 2),
    y: originY + (tx + ty) * (ISO_TILE_H / 2),
  };
}

/** Sort key so painter's-algorithm depth matches iso draw order. */
export function isoDepth(tx: number, ty: number): number {
  return (tx + ty) * 10;
}

/** Draws a flat iso floor diamond at (isoX, isoY) — the diamond's center. */
export function drawFloorDiamond(g: Phaser.GameObjects.Graphics, isoX: number, isoY: number, color: number): void {
  const w = ISO_TILE_W / 2;
  const h = ISO_TILE_H / 2;
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(isoX, isoY - h);
  g.lineTo(isoX + w, isoY);
  g.lineTo(isoX, isoY + h);
  g.lineTo(isoX - w, isoY);
  g.closePath();
  g.fillPath();
}

/**
 * Bakes a single "wall block" texture (top diamond + two shaded side faces)
 * used for every visible wall tile. One shared texture, reused via Image —
 * only the floor gets baked per-map since it never needs per-tile depth
 * sorting.
 */
export function drawWallBlockTexture(scene: Phaser.Scene, key: string, topColor: number): string {
  if (scene.textures.exists(key)) return key;
  const w = ISO_TILE_W;
  const h = ISO_TILE_H;
  const { w: texW, h: texH } = wallBlockTextureSize();
  const cx = texW / 2;
  const cy = WALL_PAD + h / 2;

  const g = scene.add.graphics();
  const leftColor = shade(topColor, -0.32);
  const rightColor = shade(topColor, -0.5);

  // left face
  g.fillStyle(leftColor, 1);
  g.beginPath();
  g.moveTo(cx - w / 2, cy);
  g.lineTo(cx, cy + h / 2);
  g.lineTo(cx, cy + h / 2 + WALL_HEIGHT);
  g.lineTo(cx - w / 2, cy + WALL_HEIGHT);
  g.closePath();
  g.fillPath();

  // right face
  g.fillStyle(rightColor, 1);
  g.beginPath();
  g.moveTo(cx, cy + h / 2);
  g.lineTo(cx + w / 2, cy);
  g.lineTo(cx + w / 2, cy + WALL_HEIGHT);
  g.lineTo(cx, cy + h / 2 + WALL_HEIGHT);
  g.closePath();
  g.fillPath();

  // top face
  g.fillStyle(topColor, 1);
  g.beginPath();
  g.moveTo(cx, cy - h / 2);
  g.lineTo(cx + w / 2, cy);
  g.lineTo(cx, cy + h / 2);
  g.lineTo(cx - w / 2, cy);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, shade(topColor, 0.3), 0.6);
  g.strokePath();

  g.generateTexture(key, texW, texH);
  g.destroy();
  return key;
}

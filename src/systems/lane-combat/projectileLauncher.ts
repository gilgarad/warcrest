import Phaser from "phaser";

export interface ProjectileLaunchOptions {
  scene: Phaser.Scene;
  start: Phaser.Math.Vector2;
  end: Phaser.Math.Vector2;
  textureKey: string;
  depth: number;
  durationScale?: number;
  displaySize?: { width: number; height: number };
  onCreated?: (projectile: Phaser.GameObjects.Image) => void;
  onDestroyed?: (projectile: Phaser.GameObjects.Image) => void;
  onHit: () => void;
}

interface ProjectileTravelData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  travel: number;
}

export function setLaneProjectileProgress(
  projectile: Phaser.GameObjects.Image,
  value: number,
): void {
  const data = projectile.getData("travel") as ProjectileTravelData | undefined;
  if (!data) return;
  const progress = Phaser.Math.Clamp(value, 0, 1);
  projectile.setPosition(
    Phaser.Math.Linear(data.startX, data.endX, progress),
    Phaser.Math.Linear(data.startY, data.endY, progress)
      - Math.sin(progress * Math.PI) * Math.min(42, data.travel * 0.06),
  );
}

export function launchLaneProjectile(options: ProjectileLaunchOptions): Phaser.GameObjects.Image {
  const projectile = options.scene.add.image(options.start.x, options.start.y, options.textureKey)
    .setDepth(options.depth)
    .setScale(options.textureKey === "projectile-shot" ? 0.9 : 1.05)
    .setName(options.textureKey)
    .setRotation(Phaser.Math.Angle.Between(options.start.x, options.start.y, options.end.x, options.end.y));
  if (options.displaySize) projectile.setDisplaySize(options.displaySize.width, options.displaySize.height);
  options.onCreated?.(projectile);

  const travel = Phaser.Math.Distance.Between(options.start.x, options.start.y, options.end.x, options.end.y);
  projectile.setData("travel", {
    startX: options.start.x,
    startY: options.start.y,
    endX: options.end.x,
    endY: options.end.y,
    travel,
  } satisfies ProjectileTravelData);
  const duration = Phaser.Math.Clamp(travel * 1.2 * (options.durationScale ?? 1), 150, 360);
  options.scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    ease: "Quad.Out",
    onUpdate: (tween) => {
      const value = tween.getValue() ?? 0;
      setLaneProjectileProgress(projectile, value);
    },
    onComplete: () => {
      options.onDestroyed?.(projectile);
      projectile.destroy();
      options.onHit();
    },
  });
  return projectile;
}

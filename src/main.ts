import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { DungeonScene } from "./scenes/DungeonScene";
import { GameOverScene } from "./scenes/GameOverScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#111111",
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, DungeonScene, GameOverScene],
});

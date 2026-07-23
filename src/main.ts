import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { RunScene } from "./scenes/RunScene";
import { GameOverScene } from "./scenes/GameOverScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#111111",
  scene: [BootScene, RunScene, GameOverScene],
});

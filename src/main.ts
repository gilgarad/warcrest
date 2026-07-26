import Phaser from "phaser";
import { GAME_TITLE } from "./data/gameMeta";
import { BootScene } from "./scenes/BootScene";
import { LaneBattleScene } from "./scenes/LaneBattleScene";
import { GameOverScene } from "./scenes/GameOverScene";

document.title = GAME_TITLE;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1600,
  height: 900,
  backgroundColor: "#111111",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1600,
    height: 900,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, LaneBattleScene, GameOverScene],
});

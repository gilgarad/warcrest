import Phaser from "phaser";
import { GAME_TITLE } from "./data/gameMeta";
import { BootScene } from "./scenes/BootScene";
import { LaneBattleScene } from "./scenes/LaneBattleScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GoldenReferenceScene } from "./scenes/GoldenReferenceScene";
import { UnitSandboxScene } from "./scenes/UnitSandboxScene";
import { AudioLabScene } from "./scenes/AudioLabScene";
import { destroySharedAudioSystem } from "./systems/audio";
import { installFullscreenOnFirstGesture } from "./config/mobileShell";

document.title = GAME_TITLE;

const existingGame = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
if (existingGame) {
  existingGame.destroy(true);
  destroySharedAudioSystem();
}

const game = new Phaser.Game({
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
  // Three concurrent pointers: one finger drags the field, and a second is
  // needed before pinch-to-zoom can exist at all. Phaser tracks one by default,
  // which silently drops the second finger.
  input: {
    activePointers: 3,
  },
  scene: [BootScene, LaneBattleScene, GameOverScene, GoldenReferenceScene, UnitSandboxScene, AudioLabScene],
});

(window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame = game;

// Fullscreen has to be asked for from inside a user gesture, and only once.
installFullscreenOnFirstGesture();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
    destroySharedAudioSystem();
    delete (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    document.getElementById("game")?.replaceChildren();
  });
}

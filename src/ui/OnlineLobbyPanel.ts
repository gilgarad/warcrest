import Phaser from "phaser";
import type {
  FriendSummary,
  MatchDescriptor,
  MatchService,
} from "../systems/net/matchTypes";

interface LobbyCallbacks {
  onMatchReady: (match: MatchDescriptor) => void;
  onClose: () => void;
}

const PANEL_W = 720;
const PANEL_H = 470;
const ROW_H = 40;
const VISIBLE_ROWS = 5;

/**
 * "온라인 대전" lobby: auto-matchmaking on the left, a friend list with
 * challenge buttons on the right.
 *
 * It talks only to `MatchService`, so replacing the local stand-in with a real
 * relay does not change anything here.
 */
export class OnlineLobbyPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly friendRows: {
    bg: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.Text;
    invite: Phaser.GameObjects.Text;
    remove: Phaser.GameObjects.Text;
  }[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private autoButton!: Phaser.GameObjects.Rectangle;
  private autoLabel!: Phaser.GameObjects.Text;
  private friends: FriendSummary[] = [];
  private scrollOffset = 0;
  private busy = false;
  private open = false;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly service: MatchService,
    private readonly callbacks: LobbyCallbacks,
    private readonly depth = 4000,
  ) {}

  isOpen(): boolean {
    return this.open;
  }

  async show(): Promise<void> {
    if (this.open) return;
    this.open = true;
    this.build();
    this.unsubscribe = this.service.onStatusChange((status) => {
      if (status.state === "searching") this.setStatus("상대를 찾는 중...");
      if (status.state === "inviting") this.setStatus(`${status.friend.name} 님에게 대결을 신청했습니다...`);
    });
    await this.reloadFriends();
    // Connect on open rather than waiting for a button.
    //
    // The relay can only recognise a returning player once that player has
    // identified themselves, which needs a socket. Connecting lazily meant a
    // reconnect went unnoticed until "상대 찾기" was pressed -- and pressing it
    // asks to be matched with someone new, which is the opposite of resuming.
    // It also means a dead relay is reported here instead of on the button.
    try {
      await this.service.connect();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "대전 서버에 연결하지 못했습니다");
    }
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.service.cancel();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.objects.forEach((object) => object.destroy());
    this.objects.length = 0;
    this.friendRows.length = 0;
    this.busy = false;
    this.scrollOffset = 0;
  }

  private build(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Full-screen scrim: also swallows clicks so the title screen behind the
    // popup cannot be interacted with while it is open.
    const scrim = this.scene.add
      .rectangle(cx, cy, width, height, 0x04070c, 0.72)
      .setDepth(this.depth)
      .setInteractive();
    scrim.on("pointerdown", () => { /* modal: absorb */ });
    this.track(scrim);

    this.track(this.scene.add
      .rectangle(cx, cy, PANEL_W, PANEL_H, 0x0d1522, 0.98)
      .setStrokeStyle(2, 0xd39f3f, 0.7)
      .setDepth(this.depth + 1));

    const left = cx - PANEL_W / 2;
    const top = cy - PANEL_H / 2;

    this.track(this.scene.add
      .text(cx, top + 30, "온라인 대전", {
        fontFamily: "Georgia, serif", fontSize: "26px", color: "#f4e6c5",
      }).setOrigin(0.5).setDepth(this.depth + 2));

    this.statusText = this.scene.add
      .text(cx, top + 64, "자동 매칭을 시작하거나 친구에게 대결을 신청하십시오", {
        fontFamily: "sans-serif", fontSize: "13px", color: "#8fa3c2",
      }).setOrigin(0.5).setDepth(this.depth + 2);
    this.track(this.statusText);

    this.buildAutoMatchColumn(left + 40, top + 110);
    this.buildFriendColumn(left + 330, top + 110);
    this.buildCloseButton(cx, top + PANEL_H - 38);
  }

  private buildAutoMatchColumn(x: number, y: number): void {
    this.track(this.scene.add
      .text(x, y, "자동 매칭", {
        fontFamily: "Georgia, serif", fontSize: "18px", color: "#f1e4c3",
      }).setDepth(this.depth + 2));

    this.autoButton = this.scene.add
      .rectangle(x + 115, y + 62, 230, 56, 0x1d2d47, 0.95)
      .setStrokeStyle(2, 0xd6b979, 0.65)
      .setDepth(this.depth + 2)
      .setInteractive({ useHandCursor: true });
    this.track(this.autoButton);

    this.autoLabel = this.scene.add
      .text(x + 115, y + 62, "상대 찾기", {
        fontFamily: "sans-serif", fontSize: "17px", color: "#f3f7fb",
      }).setOrigin(0.5).setDepth(this.depth + 3);
    this.track(this.autoLabel);

    this.autoButton.on("pointerover", () => { if (!this.busy) this.autoButton.setFillStyle(0x274165, 0.98); });
    this.autoButton.on("pointerout", () => this.autoButton.setFillStyle(this.busy ? 0x24303f : 0x1d2d47, 0.95));
    this.autoButton.on("pointerdown", () => void this.runAutoMatch());

    this.track(this.scene.add
      .text(x, y + 108, "비슷한 실력의 상대를 찾아\n바로 대결을 시작합니다.", {
        fontFamily: "sans-serif", fontSize: "12px", color: "#8fa3c2", lineSpacing: 5,
      }).setDepth(this.depth + 2));
  }

  private buildFriendColumn(x: number, y: number): void {
    this.track(this.scene.add
      .text(x, y, "친구 목록", {
        fontFamily: "Georgia, serif", fontSize: "18px", color: "#f1e4c3",
      }).setDepth(this.depth + 2));

    const addButton = this.scene.add
      .text(x + 268, y + 3, "+ 친구 추가", {
        fontFamily: "sans-serif", fontSize: "13px", color: "#8fd2ff",
      }).setOrigin(1, 0).setDepth(this.depth + 3).setInteractive({ useHandCursor: true });
    addButton.on("pointerdown", () => void this.promptAddFriend());
    this.track(addButton);

    for (let row = 0; row < VISIBLE_ROWS; row += 1) {
      const rowY = y + 40 + row * ROW_H;
      const bg = this.scene.add
        .rectangle(x + 134, rowY, 268, ROW_H - 6, 0x111b2a, 0.9)
        .setStrokeStyle(1, 0x2b3d55, 0.9)
        .setDepth(this.depth + 2)
        .setVisible(false);
      const name = this.scene.add
        .text(x + 12, rowY, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#d8e7f6" })
        .setOrigin(0, 0.5).setDepth(this.depth + 3).setVisible(false);
      const invite = this.scene.add
        .text(x + 205, rowY, "대결 신청", { fontFamily: "sans-serif", fontSize: "13px", color: "#8fd2ff" })
        .setOrigin(0.5).setDepth(this.depth + 3).setVisible(false)
        .setInteractive({ useHandCursor: true });
      const remove = this.scene.add
        .text(x + 254, rowY, "삭제", { fontFamily: "sans-serif", fontSize: "12px", color: "#ff9d9d" })
        .setOrigin(0.5).setDepth(this.depth + 3).setVisible(false)
        .setInteractive({ useHandCursor: true });
      this.track(bg); this.track(name); this.track(invite); this.track(remove);
      this.friendRows.push({ bg, name, invite, remove });
    }

    this.track(this.scene.add
      .text(x, y + 40 + VISIBLE_ROWS * ROW_H + 6, "친구는 이 브라우저에만 저장됩니다.", {
        fontFamily: "sans-serif", fontSize: "11px", color: "#6f819c",
      }).setDepth(this.depth + 2));
  }

  private buildCloseButton(cx: number, y: number): void {
    const rect = this.scene.add
      .rectangle(cx, y, 150, 40, 0x1a2331, 0.95)
      .setStrokeStyle(2, 0x8697ad, 0.6)
      .setDepth(this.depth + 2)
      .setInteractive({ useHandCursor: true });
    const label = this.scene.add
      .text(cx, y, "닫기", { fontFamily: "sans-serif", fontSize: "15px", color: "#d8e7f6" })
      .setOrigin(0.5).setDepth(this.depth + 3);
    rect.on("pointerover", () => rect.setFillStyle(0x27364a, 0.98));
    rect.on("pointerout", () => rect.setFillStyle(0x1a2331, 0.95));
    rect.on("pointerdown", () => { this.hide(); this.callbacks.onClose(); });
    this.track(rect); this.track(label);
  }

  private async reloadFriends(): Promise<void> {
    this.friends = await this.service.getFriends();
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, this.friends.length - VISIBLE_ROWS));
    this.renderFriends();
  }

  private renderFriends(): void {
    this.friendRows.forEach((row, index) => {
      const friend = this.friends[this.scrollOffset + index];
      const visible = Boolean(friend);
      row.bg.setVisible(visible);
      row.name.setVisible(visible);
      row.invite.setVisible(visible);
      row.remove.setVisible(visible);
      if (!friend) return;
      row.name.setText(friend.name);
      row.invite.removeAllListeners("pointerdown");
      row.invite.on("pointerdown", () => void this.runInvite(friend));
      row.remove.removeAllListeners("pointerdown");
      row.remove.on("pointerdown", () => void this.runRemove(friend));
    });
    if (this.friends.length === 0) {
      this.friendRows[0].bg.setVisible(true);
      this.friendRows[0].name.setVisible(true).setText("등록된 친구가 없습니다");
    }
  }

  private async promptAddFriend(): Promise<void> {
    if (this.busy) return;
    const name = window.prompt("추가할 친구의 이름을 입력하십시오");
    if (name === null) return;
    try {
      await this.service.addFriend(name);
      await this.reloadFriends();
      this.setStatus(`${name.trim()} 님을 친구로 추가했습니다`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "친구를 추가하지 못했습니다");
    }
  }

  private async runRemove(friend: FriendSummary): Promise<void> {
    if (this.busy) return;
    await this.service.removeFriend(friend.id);
    await this.reloadFriends();
    this.setStatus(`${friend.name} 님을 목록에서 삭제했습니다`);
  }

  private async runAutoMatch(): Promise<void> {
    if (this.busy) return;
    this.setBusy(true, "검색 취소");
    try {
      this.callbacks.onMatchReady(await this.service.findAutoMatch());
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "매칭에 실패했습니다");
      this.setBusy(false, "상대 찾기");
    }
  }

  private async runInvite(friend: FriendSummary): Promise<void> {
    if (this.busy) return;
    this.setBusy(true, "신청 취소");
    try {
      this.callbacks.onMatchReady(await this.service.inviteFriend(friend.id));
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "대결 신청에 실패했습니다");
      this.setBusy(false, "상대 찾기");
    }
  }

  /**
   * While a request is in flight the primary button becomes the cancel button,
   * so there is always a way out of a search that is going nowhere.
   */
  private setBusy(busy: boolean, label: string): void {
    this.busy = busy;
    this.autoLabel.setText(label);
    this.autoButton.setFillStyle(busy ? 0x24303f : 0x1d2d47, 0.95);
    this.autoButton.removeAllListeners("pointerdown");
    this.autoButton.on("pointerdown", () => {
      if (this.busy) {
        this.service.cancel();
        this.setBusy(false, "상대 찾기");
        this.setStatus("취소되었습니다");
        return;
      }
      void this.runAutoMatch();
    });
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private track(object: Phaser.GameObjects.GameObject): void {
    this.objects.push(object);
  }
}

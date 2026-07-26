type MusicMode = "boot" | "battle" | "gameover";

class MusicController {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private mode: MusicMode = "boot";

  setMode(mode: MusicMode): void {
    this.mode = mode;
    if (this.master) {
      const target = mode === "battle" ? 0.15 : mode === "gameover" ? 0.09 : 0.12;
      this.master.gain.cancelScheduledValues(this.ctx!.currentTime);
      this.master.gain.linearRampToValueAtTime(target, this.ctx!.currentTime + 0.35);
    }
  }

  async unlockAndStart(mode: MusicMode): Promise<void> {
    this.setMode(mode);
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.ctx.destination);
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
    if (this.schedulerId !== null) return;
    this.master!.gain.linearRampToValueAtTime(mode === "battle" ? 0.15 : 0.12, this.ctx.currentTime + 0.45);
    this.schedulerId = window.setInterval(() => this.scheduleAhead(), 120);
  }

  stop(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
    }
  }

  private scheduleAhead(): void {
    if (!this.ctx || !this.master) return;
    const horizon = this.ctx.currentTime + 0.7;
    while (this.nextNoteTime < horizon) {
      this.scheduleStep(this.nextNoteTime, this.step);
      this.nextNoteTime += 0.32;
      this.step += 1;
    }
  }

  private scheduleStep(time: number, step: number): void {
    if (!this.ctx || !this.master) return;
    const root = this.mode === "battle" ? 110 : this.mode === "gameover" ? 98 : 123.47;
    const bassPattern = [0, 0, 3, 5, 0, 7, 5, 3];
    const leadPattern = this.mode === "battle"
      ? [12, 10, 12, 15, 17, 15, 12, 10]
      : this.mode === "gameover"
        ? [7, 5, 3, 2, 0, 2, 3, 5]
        : [12, 14, 15, 19, 17, 15, 14, 12];

    this.playPad(root * this.intervalToRatio(bassPattern[step % bassPattern.length]), time, 0.62);
    if (step % 2 === 0) {
      this.playPluck(root * this.intervalToRatio(leadPattern[step % leadPattern.length]), time + 0.02, this.mode === "battle" ? 0.18 : 0.14);
    }
    if (this.mode === "battle" && step % 4 === 2) {
      this.playPulse(root * this.intervalToRatio(24), time + 0.06, 0.08);
    }
  }

  private playPad(freq: number, time: number, gainValue: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(920, time);
    filter.Q.value = 0.4;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq / 2, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue * 0.09, time + 0.08);
    gain.gain.linearRampToValueAtTime(gainValue * 0.05, time + 0.28);
    gain.gain.linearRampToValueAtTime(0.0001, time + 0.66);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(time);
    sub.start(time);
    osc.stop(time + 0.7);
    sub.stop(time + 0.7);
  }

  private playPluck(freq: number, time: number, gainValue: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(freq * 0.995, time + 0.25);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.36);
  }

  private playPulse(freq: number, time: number, gainValue: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  private intervalToRatio(semitones: number): number {
    return 2 ** (semitones / 12);
  }
}

const sharedMusicController = new MusicController();

export function getMusicController(): MusicController {
  return sharedMusicController;
}

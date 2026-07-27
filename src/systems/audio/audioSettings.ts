import type { AudioSettingsData } from "./types";

const STORAGE_KEY = "warcrest.audioSettings";
const CURRENT_VERSION = 1;

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsData = {
  version: CURRENT_VERSION,
  masterVolume: 0.8,
  bgmVolume: 0.8,
  sfxVolume: 0.9,
  mute: false,
  muteWhenUnfocused: true,
  reducedAudio: false,
  crossfadeDurationMs: 1200,
};

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/** Structural validation — never trust parsed JSON blindly, especially from localStorage. */
function isValidSettingsShape(data: unknown): data is AudioSettingsData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    isFiniteInRange(d.masterVolume, 0, 1) &&
    isFiniteInRange(d.bgmVolume, 0, 1) &&
    isFiniteInRange(d.sfxVolume, 0, 1) &&
    typeof d.mute === "boolean" &&
    typeof d.muteWhenUnfocused === "boolean" &&
    typeof d.reducedAudio === "boolean" &&
    isFiniteInRange(d.crossfadeDurationMs, 0, 5000)
  );
}

/** Forward-migrates older saved shapes. Add a case per bump of CURRENT_VERSION. */
function migrate(data: Record<string, unknown>): AudioSettingsData | null {
  const version = typeof data.version === "number" ? data.version : 0;
  if (version === CURRENT_VERSION && isValidSettingsShape(data)) {
    return { ...data, version: CURRENT_VERSION } as AudioSettingsData;
  }
  // No prior versions exist yet (this is v1) — nothing to migrate from.
  return null;
}

export class AudioSettings {
  private data: AudioSettingsData;
  private listeners = new Set<(data: AudioSettingsData) => void>();

  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> = safeLocalStorage()) {
    this.data = this.load();
  }

  get(): Readonly<AudioSettingsData> {
    return this.data;
  }

  update(partial: Partial<Omit<AudioSettingsData, "version">>): void {
    this.data = { ...this.data, ...partial, version: CURRENT_VERSION };
    this.persist();
    this.listeners.forEach((fn) => fn(this.data));
  }

  reset(): void {
    this.data = { ...DEFAULT_AUDIO_SETTINGS };
    this.persist();
    this.listeners.forEach((fn) => fn(this.data));
  }

  onChange(fn: (data: AudioSettingsData) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private load(): AudioSettingsData {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
      const parsed = JSON.parse(raw);
      const migrated = migrate(parsed);
      return migrated ?? { ...DEFAULT_AUDIO_SETTINGS };
    } catch {
      // Corrupt JSON, quota errors while reading (shouldn't happen), etc. —
      // always fall back to a safe default rather than throwing at startup.
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full/unavailable (private browsing, etc.) — settings just
      // won't persist across reloads; not fatal for this session.
    }
  }
}

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // Accessing localStorage can throw in some sandboxed/privacy contexts.
  }
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  };
}

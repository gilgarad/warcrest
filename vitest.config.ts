import { defineConfig } from "vitest/config";

/**
 * Minimal vitest config, added specifically for the audio system prototype's
 * unit tests (src/systems/audio/__tests__). No existing test runner was
 * configured before this — see docs/dev-wiki/audio-system-prototype.md.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});

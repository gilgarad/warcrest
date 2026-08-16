import { defineConfig } from "vitest/config";

/**
 * Minimal vitest config, added specifically for the audio system prototype's
 * unit tests (src/systems/audio/__tests__). No existing test runner was
 * configured before this — see docs/dev-wiki/audio-system-prototype.md.
 */
export default defineConfig({
  test: {
    environment: "node",
    // `tools/` is included because the relay lives there and is real runtime
    // code: it is what production runs, so it needs tests like anything else.
    include: ["src/**/__tests__/**/*.test.ts", "tools/**/__tests__/**/*.test.ts"],
  },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tools/validation",
  // A cold visit downloads ~500 battle assets before the scene can start,
  // which alone can take 30s+. At the old 45s budget a spec could time out
  // during loading and report a failure that had nothing to do with the
  // behaviour under test.
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  reporter: "line",
  outputDir: "artifacts/audio-integration/test-results",
  use: {
    baseURL: "http://127.0.0.1:5176",
    headless: true,
    launchOptions: { executablePath: "/usr/bin/chromium-browser" },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5176",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

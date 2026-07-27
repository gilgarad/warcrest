import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tools/validation",
  timeout: 45_000,
  expect: { timeout: 10_000 },
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

import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const evidenceRoot = path.resolve(process.env.PLAYWRIGHT_EVIDENCE_DIR ?? path.join(os.homedir(), ".dsh", "workai", "life-level-v7", "evidence", "browser"));
const runDirectory = path.join(evidenceRoot, process.env.PLAYWRIGHT_RUN_ID ?? `run-${Date.now()}`);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/v7-smoke.spec.ts", "**/wall-insert-csg.spec.ts", "**/wall-drawing.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: path.join(runDirectory, "artifacts"),
  reporter: [["list"], ["html", { outputFolder: path.join(runDirectory, "report"), open: "never" }], ["json", { outputFile: path.join(runDirectory, "results.json") }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    colorScheme: "dark",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});

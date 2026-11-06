import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const evidenceRoot = path.resolve(process.env.PLAYWRIGHT_EVIDENCE_DIR ?? path.join(os.tmpdir(), "lifelevel-playwright-evidence"));
// Persist the generated ID before Playwright starts worker processes. Without
// this, a reloaded config could put worker screenshots in a different run dir.
const runId = (process.env.PLAYWRIGHT_RUN_ID ||= `run-${Date.now()}-${randomUUID()}`).replace(/[^a-zA-Z0-9_.-]/g, "_");
const runDirectory = path.join(evidenceRoot, runId);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const base = new URL(baseURL);

if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || !base.port) {
  throw new Error("Playwright must use an isolated loopback test server, never a deployed application.");
}

const port = Number(base.port);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PLAYWRIGHT_BASE_URL port.");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: path.join(runDirectory, "artifacts"),
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(runDirectory, "report"), open: "never" }],
    ["json", { outputFile: path.join(runDirectory, "results.json") }],
  ],
  use: {
    baseURL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    colorScheme: "dark",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: process.env.PLAYWRIGHT_CAPTURE_ALL === "1" ? "on" : "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "node tools/start-playwright-server.mjs",
    url: `${base.origin}/api/health/live`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      LIFELEVEL_BUILD_DIR: ".next-playwright",
      PLAYWRIGHT_PORT: String(port),
      PLAYWRIGHT_LOCAL_DATA_DIR: path.join(os.tmpdir(), `lifelevel-playwright-data-${runId}-${randomUUID()}`),
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createIsolatedNextRoot } from "./create-isolated-next-root.mjs";

const root = process.cwd();
const port = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PLAYWRIGHT_PORT.");

const tempRoot = path.resolve(os.tmpdir());
const dataDir = path.resolve(process.env.PLAYWRIGHT_LOCAL_DATA_DIR ?? mkdtempSync(path.join(tempRoot, "lifelevel-playwright-data-")));
const projectDir = createIsolatedNextRoot(root);
const relativeDataDir = path.relative(tempRoot, dataDir);
if (!relativeDataDir || relativeDataDir.startsWith("..") || path.isAbsolute(relativeDataDir)) {
  throw new Error("Playwright data must be stored in a dedicated directory under the operating-system temp folder.");
}
mkdirSync(dataDir, { recursive: true });

const inheritedKeys = process.platform === "win32"
  ? ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA"]
  : ["PATH", "HOME", "TMPDIR"];
const env = Object.fromEntries(inheritedKeys.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
Object.assign(env, {
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  LOCAL_DEV_MODE: "true",
  LOCAL_DEV_MOCK_MODE: "false",
  LOCAL_DATA_DIR: dataDir,
  AI_PROVIDER: "disabled",
  LIFELEVEL_BUILD_DIR: ".next-playwright",
});

const nextCli = path.join(projectDir, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextCli, "dev", projectDir, "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: projectDir,
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.once("error", error => {
  console.error("Unable to start isolated Playwright server:", error.message);
  process.exitCode = 1;
});
server.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

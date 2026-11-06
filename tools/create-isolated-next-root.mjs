import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

/**
 * Give Next.js a clean project root so its documented .env* loader cannot see
 * developer credentials in the checkout. Source, public assets and small
 * non-secret config files are copied into the temporary root. Dependencies
 * are installed from the committed npm lockfile there.
 */
export function createIsolatedNextRoot(projectRoot = process.cwd()) {
  const sourceRoot = realpathSync(projectRoot);
  const tempRoot = realpathSync(os.tmpdir());
  const isolatedRoot = mkdtempSync(path.join(tempRoot, "lifelevel-next-isolated-"));

  for (const file of ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) {
    const source = path.join(sourceRoot, file);
    if (existsSync(source)) copyFileSync(source, path.join(isolatedRoot, file));
  }

  // Turbopack rejects project symlinks that escape its root; copy the source
  // and the public assets instead of linking back into the checkout.
  cpSync(path.join(sourceRoot, "src"), path.join(isolatedRoot, "src"), { recursive: true });
  cpSync(path.join(sourceRoot, "public"), path.join(isolatedRoot, "public"), { recursive: true });
  const assetManifest = path.join(sourceRoot, "assets", "apartment", "registry-v18.json");
  if (existsSync(assetManifest)) {
    const isolatedManifest = path.join(isolatedRoot, "assets", "apartment", "registry-v18.json");
    mkdirSync(path.dirname(isolatedManifest), { recursive: true });
    copyFileSync(assetManifest, isolatedManifest);
  }

  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli)) throw new Error("Run isolated browser tests through npm so the locked npm CLI is available.");
  const emptyUserNpmConfig = path.join(isolatedRoot, ".npmrc-user-empty");
  const emptyGlobalNpmConfig = path.join(isolatedRoot, ".npmrc-global-empty");
  const safeEnvironmentKeys = process.platform === "win32"
    ? ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA"]
    : ["PATH", "HOME", "TMPDIR"];
  const installEnvironment = Object.fromEntries(safeEnvironmentKeys.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
  Object.assign(installEnvironment, {
    NODE_ENV: "development",
    npm_config_registry: "https://registry.npmjs.org/",
    npm_config_userconfig: emptyUserNpmConfig,
    npm_config_globalconfig: emptyGlobalNpmConfig,
    npm_config_cache: path.join(tempRoot, "lifelevel-isolated-npm-cache"),
    npm_config_audit: "false",
    npm_config_fund: "false",
  });
  writeFileSync(emptyUserNpmConfig, "", "utf8");
  writeFileSync(emptyGlobalNpmConfig, "", "utf8");
  const install = spawnSync(process.execPath, [npmCli, "ci", "--no-audit", "--no-fund"], {
    cwd: isolatedRoot,
    stdio: "inherit",
    env: installEnvironment,
  });
  if (install.error) throw install.error;
  if (install.status !== 0) throw new Error(`Isolated npm ci failed with exit code ${install.status ?? "unknown"}.`);

  const resolvedRoot = realpathSync(isolatedRoot);
  const relative = path.relative(tempRoot, resolvedRoot);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Isolated Next.js project escaped the operating-system temp folder.");
  }
  if (existsSync(path.join(isolatedRoot, ".env.local"))) {
    throw new Error("Isolated Next.js project unexpectedly contains .env.local.");
  }

  return isolatedRoot;
}

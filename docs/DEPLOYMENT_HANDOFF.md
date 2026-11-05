# LIFE//LEVEL deployment handoff for Grok Bot

**Status:** preparation for a Linux deployment, not a record of one. The project was edited and tested on Windows. No Grok Linux shell, persistent database, tunnel, or service-policy approval has been verified by this handoff. Do not expose the application or run migrations against existing production data without the owner's explicit authorization and a verified backup.

## Local implementation verification (Windows, 2026-10-26)

- Git rollback baseline: local commit `286e53f` before implementation. No remote was used.
- `npm run typecheck`: passed. `npm run build`: passed, including Next.js production routes and bundled worker. Scoped ESLint for changed server, API, client and worker files: 0 errors; nonblocking ConstructionEditor warnings remain.
- Focused Vitest run covering account, guest claim, ownership, game/finance intents, construction, portraits, jobs, AI and backup: **295 passed / 0 failed** across 24 files. Electron security tests: **3 passed / 0 failed**.
- Full `npm test`: **4,688 passed / 55 failed** across 135 files. Before implementation, the baseline run was **4,608 passed / 87 failed**. The current failures are concentrated in catalog, 3D geometry, visual and construction localization expectations; the baseline also failed broadly, but a one-to-one classification of every current failure was not completed. An all-green suite is not established.
- The Windows worker bundle starts and exits fatally when `DATABASE_URL` is absent, as expected; this is not a PostgreSQL recovery test. Database migrations, session sharing on two devices, lease recovery after crash, backup restore and public HTTPS/Electron integration have **not** been tested on a live Grok Linux host.

## Runtime contract

- **Node.js:** Node 22 LTS, minimum **22.12.0**; check with `node --version`. Use the npm bundled with that Node installation. Node 22 is the repository's Linux CI target. Do not use `next export`: this app needs the Node API server.
- **Database:** PostgreSQL on the Grok Linux host, listening on loopback/Unix socket only. `DATABASE_URL` is server-side. Do not expose port 5432 to the Internet.
- **Web:** one `next start` process bound to `127.0.0.1:3000`. A named outbound tunnel may connect to that loopback address only after approval. The Windows `.exe` loads the approved public HTTPS origin.
- **Worker:** a separate `npm run worker` process uses the same PostgreSQL database. It handles durable AI proposal jobs and accepted command intents. The queue and worker require an actual database and must be tested across process termination and restart.
- **Supervisor:** `deploy/systemd/*.service` are templates, usable only if systemd is PID 1 and the environment permits long-lived services. Adjust the `node`/`npm` paths and service account to the actual host. These templates have not been installed or run.
- **Health scope:** `/api/health/live` checks the web process and `/api/health/ready` executes a database `select 1`. Neither endpoint checks whether the separate worker is alive or whether queued work is advancing.

## Before accepting a package

1. Establish that Grok Bot's cloud computer permits public hosting and long-lived processes under the applicable service policy. Verify that the machine, storage and processes survive a closed app, idle period and restart. A marketing description of a persistent computer is not an uptime SLA.
2. Confirm `cat /proc/1/comm`, `node --version`, `npm --version`, `psql --version`, `pg_isready`, `systemctl is-system-running`, outbound HTTPS and tunnel edge connectivity. Record outputs. Do not assume `sudo` proves service persistence.
3. Receive the package by an owner-approved method. Compare the accompanying SHA-256 sidecar with `sha256sum -c life-level-server-*.tar.gz.sha256` in the same directory. List its contents with `tar -tzf PACKAGE.tar.gz`; the package must contain no `.env`, private key, local data or database dump.
4. Keep the existing deployed release and a tested, full PostgreSQL backup. Migrations are additive but still need review against the actual database before execution. The in-app JSON export contains game state, finance state and AI proposals only; it excludes server-stored portraits, construction drafts, accounts, sessions and job/intent records. It cannot replace a PostgreSQL backup or restore test.

The Windows source machine can create a package with `powershell -File deploy/package-server.ps1`. This selects source/runtime files explicitly, excludes `.env` and local data by construction, checks filenames and symlinks, and writes a `.tar.gz` plus `.sha256`. A successful archive is not a substitute for a human review of its contents. The script does not upload it.

## Install and build on Grok Linux, after preflight approval

Run from the extracted package directory as the dedicated service user. The examples do not contain credential values.

```sh
node --version
npm --version
npm ci --include=dev
npm run typecheck
npm run build
```

`npm ci` installs the locked versions; `--include=dev` keeps the build tools. `npm run build` creates both the Next.js build and `dist-worker/index.cjs`. The worker build script uses `worker/server-only-shim.ts` as an esbuild alias for Next's `server-only` guard; it does not weaken the web application's client/server boundary. Check that `worker/index.ts` and this shim are present in the package. Do not use `npm install` to rewrite the lockfile on the server. Provide environment variables through a root-owned file outside the release tree (for example `/etc/life-level/life-level.env`, mode 0600) or another approved secret store. Do not copy Windows `.env.local` or place secrets in the deployment archive.

The current `npm run worker` command resolves its runtime libraries from the release's `node_modules`. Do not prune dev dependencies until the worker and web runtime have been tested after pruning on the target Linux distribution.

### Required environment variable names

| Name | Purpose |
| --- | --- |
| `NODE_ENV` | `production` for both web and worker processes. |
| `DATABASE_URL` | Server-side connection to the local PostgreSQL database; never expose it to the client or logs. |
| `APP_ORIGIN` | Canonical public HTTPS origin (scheme + hostname, no path). Required for production mutation Origin/CSRF checks; must match the named tunnel hostname and desktop URL. |
| `LOCAL_DEV_MODE` | Must be absent or false in production; otherwise the old shared local-player mode may be selected. |
| `PREVIEW_LOCAL_SAVE` | Must be absent or false in production. |
| `LOCAL_DEV_MOCK_MODE` | Must be absent or false in production. |
| `AI_PROVIDER` | Keep disabled until an approved real provider/API is available and tested. SuperGrok subscription alone does not establish API access. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Only if a legitimate compatible AI provider is enabled; these stay server-side. |
| `LOCAL_DATA_DIR` | Optional local-development data directory; leave absent in production. |
| `VERCEL` | Hosting-provider runtime flag; leave absent on self-hosted Grok Linux. |

The account session is generated server-side and stored as a hash in PostgreSQL; current source does not require a static session secret. Do not invent one or set `NEXT_PUBLIC_` secrets. `LIFE_LEVEL_SERVER_URL` is used **only when building the Windows client** to embed its public HTTPS origin; it is not a database credential. `LIFE_LEVEL_ALLOW_LOCAL_HTTP` is for unpackaged desktop development only and must never be used for a packaged release.

## Database migration and process commands

After backing up the actual database, testing restore to an isolated database, and reviewing each migration SQL file:

```sh
npm run db:migrate
```

`DATABASE_URL` must already be available in the migration process environment. `drizzle-kit` does not automatically load Next's `.env.local`. Never use `drizzle-kit push` against production.

Migration `0001` adds accounts and hashed sessions; `0002` adds server-owned artifacts and durable jobs; `0003` adds accepted command intents for retry after a client disconnect. Review and apply all three in order before enabling the new routes and worker. Secure cookies require the public HTTPS origin. The auth attempt brake inside the Next process is not distributed; configure a shared limit at the approved reverse proxy/tunnel edge before allowing open registration/login at scale.

At the public edge, rate-limit guest creation, registration/login, portrait uploads and AI requests across source IPs and accounts. The application has a per-process password-hash concurrency cap, per-owner portrait quota and production AI proposals require an account; these do not replace a shared edge policy. Test the policy before exposing the tunnel. `command_intents`, game command receipts and finance idempotency receipts are retained for replay safety and currently have no archival schedule. Monitor their growth and define a tested retention policy before sustained 24/7 use; do not delete receipts casually because old client retries must remain safe.

**Public exposure gate:** configure shared edge/IP limits for guest reads, registration, login, mutations, downloads, and AI requests before starting the tunnel. A guest `GET /api/game` can create a database row; rotating account emails can bypass per-email in-process limits and consume expensive password hashing work. Set a registration budget/invite policy and monitor database growth. Production AI requests require an authenticated account and a legitimate configured provider. Do not treat the in-process throttle as an Internet-facing abuse control.

Start locally for a controlled smoke test (separate terminals or systemd units):

```sh
npm run start
npm run worker
```

The production `start` script must bind to loopback. Confirm with `ss -lnt` that only `127.0.0.1:3000` is listening for the application and PostgreSQL is not public. Configure the example systemd services only if `systemd` is confirmed; check `systemctl status life-level-web life-level-worker` and `journalctl -u life-level-web -u life-level-worker` without logging secrets. Start/enable them only with owner authorization for the host.

## Health, functional and recovery checks

```sh
curl -fsS http://127.0.0.1:3000/api/health/live
curl -fsS http://127.0.0.1:3000/api/health/ready
pg_isready -h 127.0.0.1 -p 5432
```

`/live` checks web-process availability; `/ready` checks database availability without disclosing connection strings or user data. **A 200 response from `/ready` does not establish worker liveness or queue progress.** Where systemd is in use, check `systemctl is-active life-level-worker` and `systemctl status life-level-worker`, then inspect `journalctl -u life-level-worker --since "15 minutes ago" --no-pager` for starts, fatal exits and retries. Query `background_jobs` and `command_intents` for ready queued rows, expired running leases and the age of the oldest ready row. For example, in a `psql` session connected through approved local credentials:

```sql
SELECT 'background_jobs' AS source,
       count(*) FILTER (WHERE status = 'queued' AND run_at <= now()) AS ready,
       count(*) FILTER (WHERE status = 'running' AND lease_until <= now()) AS expired_lease,
       max(now() - created_at) FILTER (WHERE status = 'queued' AND run_at <= now()) AS oldest_ready_age
FROM background_jobs
UNION ALL
SELECT 'command_intents',
       count(*) FILTER (WHERE status = 'queued' AND run_at <= now()),
       count(*) FILTER (WHERE status = 'running' AND lease_until <= now()),
       max(now() - created_at) FILTER (WHERE status = 'queued' AND run_at <= now())
FROM command_intents;
```

An idle queue is expected when no work was submitted; acceptance requires submitting known test work, observing it advance, stopping and restarting the worker, and verifying lease recovery and a single result. Also test an authenticated API request, two accounts' data isolation, two devices on one account, guest-save claim, idempotent game/finance retries, accepted command-intent recovery, AI queue survival after the client closes, and worker recovery after a process kill.

## Public HTTPS connection

Because Grok Cloud is behind NAT, direct inbound traffic is unavailable. `deploy/cloudflared/config.yml.example` and `deploy/systemd/life-level-tunnel.service.example` are templates for a **named** Cloudflare Tunnel with a stable approved hostname. Quick Tunnel URLs are temporary. The Linux host must permit the outbound connection; the owner must control the domain and authorize public exposure. Set `APP_ORIGIN` to that hostname's `https://` origin and build Electron with the same `LIFE_LEVEL_SERVER_URL`; a mismatch should fail mutation Origin checks. Do not package tunnel credentials. The service template assumes a dedicated `cloudflared` user and `/usr/local/bin/cloudflared`; verify those paths on Grok. Test HTTPS certificate, forwarded Host/Origin behavior, secure cookies, rate limits and long-lived connection behavior before releasing the desktop installer. If a named tunnel or policy is unavailable, do not claim Internet accessibility.

## Rollback

1. Keep immutable versioned release directories and a `current` pointer. Preserve the previous release until the new web, worker, database and client tests pass.
2. On application failure, stop the new web/worker services and point `current` back to the previous **compatible** release, then restart and run health plus authenticated smoke tests. For example, after verifying the exact previous release path: `sudo systemctl stop life-level-web life-level-worker`; prepare a symlink to that release and atomically rename it over `/opt/life-level/current`; `sudo systemctl start life-level-web life-level-worker`. This does not delete data. Review all target paths first.
3. Do not automatically reverse a schema migration or overwrite the database. If the old release is incompatible with the new schema, use a reviewed forward fix or restore a validated pre-migration backup to an isolated database first. Plan for writes made after the backup before any in-place recovery.
4. Keep tunnel and database private while investigating; do not expose a partially migrated service.

## Windows client

`desktop/README.md` documents the Electron 45 shell. Build the installer on Windows using `npm --prefix desktop ci`, set the approved public `LIFE_LEVEL_SERVER_URL`, and run `npm --prefix desktop run build:win`. Record its SHA-256. The installer contains a public server origin but no database credentials. Windows WebGL, cookie persistence, downloads and API access must be verified on a real packaged installer before distribution. The JSON download tested in Electron is only the partial application export described above. A full recovery requires a PostgreSQL backup of all application tables, stored outside the host through an owner-approved secure channel, and a successful isolated restore. No automatic update or code-signing infrastructure is configured yet.

The local packaging smoke test used `https://life-level.invalid` as a deliberately unreachable placeholder. Its `.exe` proves the packaging pipeline only and is **not a release for users**. After Grok deployment and tunnel validation, rebuild with the real hostname, retest, and record a new checksum.

## Work Grok Bot must perform and report

1. Return the read-only environment diagnostics and policy/lifecycle evidence before installation.
2. Provision local PostgreSQL and an unprivileged app account only after approval; keep database access private.
3. Verify archive checksum and contents; install locked dependencies and build.
4. Back up, review and apply migrations only after explicit authorization for the target database.
5. Start web and worker under a supported supervisor; capture service and health output.
6. Test authentication, ownership, guest migration, file sync, job recovery, backups and restore.
7. Establish a named public tunnel only after owner approval and policy confirmation, then run HTTPS/Electron acceptance checks.

Report each command, exit status and evidence. Do not mark any unperformed Grok-specific check as passed.

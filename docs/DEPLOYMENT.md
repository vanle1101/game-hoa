# LIFE//LEVEL deployment guide

This document describes preparation only. No Neon database, Vercel project, or production deployment was created by this implementation. Local verification does not verify production database credentials, migration execution, or real GPU performance. Google login was removed at the user's request.

## Runtime and local development

Use Node.js 22 LTS and npm. The repository contains a lockfile; use `npm ci`. Windows development was performed with Node 25.8.1, so the Linux/Node 22 CI job is the separate compatibility gate.

1. Copy `.env.example` to `.env.local` without committing it.
2. For isolated local development only, set `LOCAL_DEV_MODE=true` and run `npm run dev`.
3. This enables a local identity and file persistence in ignored `.local-data/`. It is explicitly disabled under production and Vercel. Local test data is not a production authentication mechanism.
4. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

Never copy a different project's entire environment file, browser cookies, local Chrome profile, or secrets into this repository.

## Neon Postgres and migration gate

Create or select a Neon project only with the account owner's authorization. Use a separate branch/database for development and staging. Set a server-side `DATABASE_URL` using the Neon Postgres connection string and SSL. The application uses Drizzle with postgres.js transactions, row locks, `prepare:false`, and a small connection pool. A pooled Neon URL is appropriate for application traffic; follow Neon guidance for migration connections.

`drizzle.config.ts` points at `src/server/schema.ts` and writes migrations into `drizzle/`. If that directory has no reviewed migrations, deployment is blocked until they have been generated and reviewed:

```text
npm run db:generate
npm run db:migrate
```

`DATABASE_URL` must be set in the migration shell. Drizzle CLI does not automatically use Next.js `.env.local` loading. Use a trusted environment loader or inject the variable through the hosting/CI secret store; do not paste credentials into shared logs. Never run `drizzle-kit push` blindly against production. Review generated SQL, constraints and data retention effects, test against a separate Neon branch, back up production, then explicitly authorize production migration execution. Do not drop tables or user data to fix migration failures.

The current persistence model stores one game aggregate per user, a separate finance aggregate, idempotency records and AI proposals. Game aggregate row locks serialize transactions. Database migration and concurrent-transaction behavior on a real Neon instance still require verification with configured credentials.

## Browser guest sessions

The game opens without sign-in. Outside explicit local development, the server creates a random 32-byte session token in a `lifelevel-session` cookie and hashes that token into the storage owner id. The cookie is HttpOnly, SameSite=Lax, scoped to `/`, Secure in production, and lasts one year. Existing valid tokens retain the same save; missing or malformed tokens create a new guest save. No Google client, Auth.js secret, email allowlist, or OAuth callback configuration is required.

Data belongs to this browser session. Another browser/device has a separate save. Clearing cookies or using a private window creates a new identity; there is currently no account recovery or cross-device linking. Backup export preserves a copy of the data but is not an implemented recovery/login mechanism. Avoid shared browser profiles for private finance data, and keep the guest token private.

Verify cookie creation, repeated visits, two-browser separation, same-origin writes and foreign-origin rejection over the actual deployment's HTTPS origin. Explicit local development uses the fixed `local-player` save instead of browser isolation.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only Postgres URL with SSL |
| `LOCAL_DEV_MODE` | Must be `false` or absent on Vercel |
| `AI_PROVIDER` | `disabled`, local `demo`, or `openai-compatible` |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Approved server-side remote AI provider configuration |
| `CRON_SECRET` | Reserved scheduler secret; configure scheduling only after an authenticated route is available and tested |

No secrets may use `NEXT_PUBLIC_`. The local Muse integration audit is in `docs/AI_PROVIDER_AUDIT.md`. Browser-session/local-Chrome integrations are not a deployable remote API. Keep AI disabled until a legitimate compatible remote endpoint is configured and tested. Demo mode is not a production AI integration. Finance data must not be added to AI context.

## Vercel preparation

Import the repository as a Next.js project; select Node 22; use `npm ci` and `npm run build`. Add secrets separately to staging and production environments. Do not place secrets in source or `vercel.json`. Select a function region near Neon and confirm transaction latency. Large future GLB assets belong in a configured object store/CDN; the Vercel filesystem is not persistent storage.

Create a preview only after the account owner authorizes external project changes. Complete guest-session and API smoke tests, all cross-system gameplay tests, backup verification, mobile/desktop visual QA, and real WebGL performance measurements there. A successful build does not prove gameplay, session isolation, database, or GPU performance. Production publication remains a separate explicit step; this repository has not been deployed by the agent.

## PWA and offline behavior

`/manifest.webmanifest` provides app metadata and SVG icons. Browser installation support varies; platform-specific raster icons may be needed for older iOS versions. `/sw.js` is registered by the game client. It uses the network first and caches only explicitly public icons, the static offline shell, and `/_next/static/` assets. It never caches API responses, React Server Component payloads, private finance data, or navigation HTML. Failed navigation serves `/offline.html`.

The offline page can show the existing local game snapshot with `textContent`, without mutation controls, rewards, finance, or AI data. The user can clear that snapshot. This local snapshot is device storage; clear local snapshots on shared devices. Clearing the session cookie also loses access to the guest save. Service worker updates activate when old tabs release the previous worker; increment the cache version when changing the shell contract. Verify installed mode and update behavior in target browsers over HTTPS or localhost.

## Backup and recovery

Authenticated `GET /api/backup` downloads a versioned JSON envelope containing game, finance and proposals. Responses are `private, no-store`. The format validates owner identity, safe numeric values, key references, duplicate IDs and finance ledger reconciliation. A game revision check rejects export if gameplay changed while exporting. Game, finance and proposals are read separately; this is not a single cross-domain database snapshot. Export while idle for a consistent user workflow.

Store exports securely: they contain private financial and task information. The export does not contain environment secrets or authentication credentials. The pure `restoreIsolated` utility validates and clones a backup into a `test-*` in-memory namespace only. Tests verify round trips, corruption rejection, identity boundaries and copy isolation. It never writes to the current account or database. There is intentionally no production restore API or user-facing restore flow yet. A production restore needs a reviewed migration/rollback procedure, authenticated owner confirmation and end-to-end testing on an isolated Neon branch first.

## Verification and blockers

The GitHub workflow runs clean install, strict typecheck, ESLint, tests, production dependency audit and Next.js build without production credentials. It does not deploy and does not claim E2E or database verification. Development-tool dependency audit findings should be tracked independently; do not force downgrade core tooling just to hide findings.

Before production: review migrations; exercise Neon transactions and retry races; validate guest-session isolation and lifecycle; test full gameplay, finance import and AI approval flows; inspect all target viewport sizes; measure FPS on actual devices; verify PWA offline/update privacy; verify backup export against populated data; and document remaining feature gaps in the feature matrix. Accountless public access also needs a distributed abuse limiter and operational storage controls before enabling paid AI.

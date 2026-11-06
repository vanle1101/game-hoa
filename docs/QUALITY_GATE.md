# LIFE//LEVEL quality gate

This is the release acceptance contract. A successful subset, an old report, a fixture, or a green diagnostic step is not a whole-product PASS.

## Runtime and install contract

- Node.js 22.23.4 is pinned in `.nvmrc`; npm 10.9.9 is pinned in `package.json` and CI.
- npm is the only repository package manager. Root and Electron packages each have their own committed `package-lock.json`; root pnpm lock/workspace files are not part of the supported install path.
- Every CI install starts with `npm ci` from the committed lock. Root and Electron lockfiles are installed independently. `npm install` and generated lock edits are prohibited in release jobs.
- Linux and Windows clean installs must both pass. Dependency versions must remain unchanged unless the task justifies a dependency upgrade.

## Blocking severity

| Priority | Examples | Required gate |
| --- | --- | --- |
| P0 | Cross-owner data access; game economy mutation through finance; duplicate rewards/debits; invalid restore or destructive migration; server credentials shipped to the client; CSRF/auth bypass | Release blocked until fixed and regression-tested against the affected boundary |
| P1 | Race/owner-revision overwrite; guest claim split/loss; retry that double-applies; worker crash loses accepted work; broken safe backup; production mutation without origin protection; production exposure without shared abuse limits | Release blocked until fixed and tested; live database-dependent cases stay BLOCKED when no disposable PostgreSQL is available |
| P2 | Missing screen behavior, layout, visual, accessibility or performance coverage without a data/security impact | Track separately; do not relabel as PASS |

## Required checks

| Gate | Command / environment | Acceptance |
| --- | --- | --- |
| Clean install | `npm ci` and `npm ci --prefix desktop` on `ubuntu-latest` and `windows-latest`, Node 22.23.4 / npm 10.9.9 | Both exit 0 without regenerating locks |
| Static checks | `npm run typecheck`; `npm run lint` | Exit 0; warnings are reported and triaged, not hidden |
| Unit/integration suite | `npm test -- --reporter=dot` | Exit 0; every failure and skip is classified |
| Production dependency audit | `npm audit --omit=dev` | Exit 0; production vulnerabilities block release |
| Production build | `npm run build` | Exit 0 on the tested source and lock |
| Desktop security | `node --test desktop/*.test.cjs` | Exit 0 on Linux and Windows clean-install runners |
| Browser smoke | `npm run test:e2e:smoke -- --forbid-only` | Real local Next server, loopback only, temp save, JSON and screenshots uploaded |
| Full browser suite | Four required `e2e-full` shards in `.github/workflows/ci.yml`, each running `npm run test:e2e:full -- --forbid-only --shard=N/4` | All `tests/e2e/**/*.spec.ts` on desktop and mobile projects; report and screenshots uploaded; no unexpected skips, failure, flaky or unclassified case |
| Full browser audit | Same four-shard command in `.github/workflows/full-audit.yml` | Diagnostic jobs collect all shards; final summary fails if install, browser, report, skip, or test gate fails |
| PostgreSQL/migrations | Disposable isolated PostgreSQL, apply migrations twice, run the database concurrency/ownership suite | Never target a developer or production database; production migrations require a separate reviewed backup/restore approval |
| Production recovery/exposure | Owner-approved PostgreSQL backup/restore and shared edge rate-limit validation | BLOCKED until a real isolated database and approved edge are available; local JSON or E2E fixtures cannot satisfy this gate |

## Known browser skips

The full Playwright report allows at most nine known skips across the two projects: three V9 apartment contract `fixme` cases, one real-WebGL/GPU-gated observation, and the mobile project of the desktop mouse-drag case. Each full-audit shard validates the same allowlist and maximum counts; any unknown skip or exceeded cap fails. These skips remain acceptance gaps; they are not passed tests.

Vitest currently has no declared `.skip`, `.todo` or `.only` markers. Playwright uses `--forbid-only` in CI.

## Release workflow behavior

`.github/workflows/ci.yml` is fail-fast and contains no `continue-on-error`. `.github/workflows/full-audit.yml` may continue individual diagnostic commands to collect all outputs, but its final summary step fails if any required command, report, or skip check fails. Neither workflow deploys. Branch protection required-check settings are repository administration and must be verified separately.

## Data and trust boundaries

- Local/E2E data must be in a unique OS temporary directory. The test server allowlists environment variables and does not inherit `DATABASE_URL`, AI credentials, or arbitrary environment values.
- Browser fixtures demonstrate UI behavior only. Simulated PostgreSQL query builders demonstrate application intent only. Neither proves a real PostgreSQL lock, migration, backup, worker lease, or owner-isolation result.
- Finance VND state stays separate from Gold/XP. AI input/context must not include finance records.
- Backups and restores are separate gates. An export validation or isolated in-memory roundtrip is not an owner-confirmed database restore.

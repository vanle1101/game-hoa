# LIFE//LEVEL reproducible baseline handoff

Updated: 2026-11-06 (Asia/Saigon)

## Checkpoint and scope

- Source checkpoint: `89390d744c8630eb94034f8755d49cf8c4ff3ae3` (`origin/master`). Working branch: `codex/baseline-repro-20261106`.
- This work has not been committed or pushed yet. No reset, rebase, force-push, deployment, or migration was run. `.tmp/` contains ignored local evidence and is not to be staged.
- A pre-existing one-line `src/components/combat/BossArena.tsx` JSX edit was present before this audit work; preserve it during staging/review.
- Next.js 16.4.1 is installed. The repository instruction requires consulting its bundled docs before changing Next APIs; no application Next API was changed here.

## Repository map recorded

- Next.js App Router; 17 API route handlers. Client UI/state is centered on `src/components/game/GameApp.tsx` and Zustand/query hooks.
- Separate server-only domain/API layer in `src/domain`, `src/server`, and `src/app/api`; separate lease-based AI worker in `worker/`; Electron shell and security tests in `desktop/`.
- Drizzle/PostgreSQL schema has 11 tables and four SQL migrations under `drizzle/`. No disposable PostgreSQL, `psql`, Docker, or WSL Linux distribution is available on this host.
- Feature matrix: 26 acceptance screens (24 navigation screens plus Welcome and Character Creation overlays). Construction acceptance: 61 cases, 34 PARTIAL and 27 PENDING in the checked-in matrix; none are relabeled PASS by this audit.
- Current source catalogs: 129 furniture, 121 cosmetics (97 paid / 24 starter), 74 gear.

## Changes in this checkpoint

- Selected npm as the single package manager; pinned Node `22.23.4` in `.nvmrc` and npm `10.9.9` in `package.json`/CI. Root pnpm lock/workspace files are removed; desktop remains independently locked with npm.
- Repaired only missing root lock entries for `esbuild@0.28.2` and its platform-optional packages. No dependency versions were intentionally upgraded.
- CI uses `npm ci` for root and desktop clean Linux and Windows installs. Release CI is fail-fast, contains no `continue-on-error`, and now includes all four full-E2E shards plus smoke. A separate diagnostic audit collects gate results but its final job fails if any gate or E2E shard fails.
- Playwright now discovers all `tests/e2e/**/*.spec.ts` (306 tests in 19 files), with a distinct one-project smoke config. Test Next servers run on loopback, use an OS-temp save directory and an allowlisted environment that excludes database/AI secrets. JSON/HTML reports, screenshots, and traces are kept under the OS temp evidence directory.
- Added `docs/QUALITY_GATE.md` with P0/P1/P2 thresholds, required checks, skip allowlist and production-evidence boundaries.
- Updated `tests/e2e/construction-v7.spec.ts` after a real-browser trace showed the fixture returned 503 for its own draft API, creating a spurious second error notice. It now models that draft API in memory with owner/revision checks. Locator updates target the displayed one-bedroom label and the matching validation notice; business assertions for saved state, owner, Gold, revision, and mutation count remain intact. This fixture is explicitly not database evidence.

## External CI audit

- GitHub Actions master run `42158573379` failed at `npm ci` because the committed lock omitted `esbuild@0.28.2` and optional platform packages; later steps were skipped.
- Audit/full-suite run `42160404277` reported install repair, typecheck, lint, unit, audit, build and desktop steps successful, then was cancelled while full E2E was running. Its install step used a generated lock repair, so it does not prove the current committed-lock install. Artifact logs were not downloadable (HTTP 403); API step outcomes were available.
- Neither historical run tested this branch's final lock/workflows. The new GitHub Linux runner has not been triggered; no remote workflow push was made.
- Branch protection required-check settings cannot be verified from this local checkout and remain an external repository setting.

## Verification results on Windows, Node 22.23.4 / npm 10.9.9

| Gate | Result | Evidence |
| --- | --- | --- |
| Clean `npm ci`, root | PASS, exit 0 | Fresh temp checkout, 522 packages |
| Clean `npm ci`, desktop | PASS, exit 0 | Fresh temp install, 283 packages |
| `npm run typecheck` | PASS, exit 0 | Re-run after E2E fixture and selector edits: exit 0 |
| `npm run lint` | PASS, exit 0 | Re-run after selector edit: 10 warnings, 0 errors (unused Construction locals/Bookmark, hook dependency warning, and one `<img>` warning) |
| `npm test -- --reporter=dot` | FAIL, 4,711 passed / 72 failed of 4,783 | 23 files fail; failures are not hidden or rebaselined |
| `npm audit --omit=dev` | PASS, exit 0 | 0 production vulnerabilities |
| `npm run build` | PASS, exit 0 | Node 22.23.4; Next production build and worker bundle |
| `node --test desktop/*.test.cjs` | PASS, 3/3 | Node 22.23.4 |
| Playwright smoke | PASS, 1/1 | Real isolated Next server; screenshot/JSON under `%TEMP%\lifelevel-playwright-evidence\run-1793955293653-a0dd75cc-38e4-456d-b5cc-cf28a2f4985a` |
| Full Playwright discovery | PASS, exit 0 | `npm run test:e2e:full -- --list --forbid-only`: 306 tests / 19 files |
| CI workflow validation | PASS, exit 0 | Node 22 / npm 10; both workflow YAML files parse and release CI has no `continue-on-error` |
| Full Playwright execution | NOT PASS / incomplete | Previous 6-case Construction run: 1 passed, 5 failed (4 fixture/selector issues and 1 stale layout label). Focused rerun of `real radius/angle/height controls reprice, commit once and survive reload` still failed at `#curve-angle` after editing radius; error snapshot shows the spinbutton, but Playwright could not resolve the locator before the 120s test timeout. The snapshot's render status showed 1 FPS; local headless/software-WebGL load is a possible factor but not confirmed. Evidence: `%TEMP%\\lifelevel-playwright-evidence\\run-1793956894278-f25d1b51-db47-4dbc-a676-bb2c767fd126`. No assertion or timeout was weakened. The other tests have not completed locally. |
| Linux clean install / Linux build | BLOCKED | No WSL distribution or local Linux/container runner; CI has not been triggered for this branch. |
| PostgreSQL migration/concurrency/recovery | BLOCKED | No isolated PostgreSQL service/client. No production DB was used. |

Vitest failures by file (counts from the unfiltered run):

| Count | File | Observed mismatch |
| ---: | --- | --- |
| 1 | `src/furniture/catalog.test.ts` | Test expects `ceiling-neon` to lack a procedural recipe; source now defines one. |
| 5 | `tests/client/construction-localization.test.ts` | Several expected legacy copy/structure strings are absent from the current localized UI/source. |
| 2 | `tests/client/furniture-shop.test.ts` | Expected catalog size 123 (actual 129) and an older component source shape. |
| 1 | `tests/client/v12-build-ui.test.ts` | Browser-dependent screenshot test times out. |
| 1 | `tests/client/vietnamese-panels.test.ts` | Expected legacy header copy absent. |
| 1 | `tests/construction/curve-customization.test.ts` | One custom collision case did not throw; collision type needs isolated reproduction and source review. |
| 2 | `tests/domain/v7-catalog-economy.test.ts` | Expected older category/ID projections than current source catalog. |
| 9 | `tests/domain/v7-character-housing.test.ts` | Expected one copy of each starter ID; current layout has a second `wide_window_cyber` placement. Verify intended layout semantics before changing either source or test. |
| 2 | `tests/housing/v12-repair.test.ts` | Reconcile adds versioned starter reward/task suggestions once to legacy states; assertions compare the whole legacy state and fail on those additions. Separate this additive migration from duplicate-grant/idempotency claims. |
| 10 | `tests/world/avatar-surface.test.ts` | Geometry differs from frozen sub-micro tolerances; several cases also time out. Treat as unresolved geometry, not automatically stale. |
| 1 | `tests/world/boss-visual.test.ts` | Source-shape assertion expects an older R3F component wrapper. |
| 1 | `tests/world/developed-showcase.test.ts` | Expected starter furniture placements differ from current source. |
| 1 | `tests/world/fashion-accessory-v7.test.ts` | Geometry stress test times out. |
| 20 | `tests/world/furniture-interactions.test.ts` | Test walks an older scene tree and cannot find expected `onClick`/active props; actual interaction path remains unverified by these tests. |
| 2 | `tests/world/furniture-projection.test.ts` | Catalog count is 129 vs 123; temporary-geometry disposal count is 1,939 vs expected 1,944 and needs source review. |
| 3 | `tests/world/furniture-v7-integration.test.ts` | Catalog count/collection totals differ (129 vs 123; 42 vs 36). |
| 4 | `tests/world/premium-catalog.test.ts` | Expected shared apartment GLB URLs differ from actual catalog model URLs. |
| 1 | `tests/world/preview-framing.test.ts` | Expected 123 furniture models; current set has 129. |
| 1 | `tests/world/terminal-screen-contact.test.ts` | Catalog digest differs from frozen digest. |
| 1 | `tests/world/v12-architecture.test.ts` | Expected `#070b14`; source returns `#050711`. |
| 1 | `tests/world/v12-furniture.test.ts` | Assertion expects a component function; current R3F tree returns a `group`. |
| 1 | `tests/world/v12-panorama-integration.test.tsx` | Expected panorama selection callback was not observed. |
| 1 | `tests/world/v16-building-envelope.test.ts` | Residential skyline sector coverage requirement fails. |

Counts sum to 72. Catalog/layout/source-shape mismatches are not declared harmless until product contracts are resolved; collision, callback, disposal, and geometry failures remain untriaged product risks. Assertions and tolerances were not changed.

## Data/security audit boundaries

- Source-level review/tests show owner-bound game commands, row locking/revision checks, stable command receipts, strict origin checks on mutations, finance separation from Gold/XP and AI context, and job lease/retry logic. API/unit tests use local files or a transactional Postgres double; this is not proof of real PostgreSQL locking, migrations, cross-owner concurrency, or worker recovery.
- **P1 release blocker:** authentication throttling is per process and per normalized email. The source explicitly requires a shared proxy/edge limiter; guest creation can bypass per-owner limits. Do not expose production until shared aggregate abuse limits are verified.
- Backup endpoint is export-only. It returns game/finance/proposal data with revision checks, but there is no restore endpoint; exports omit accounts, sessions, portraits, drafts, jobs and command receipts. Safe preview/validate/confirmed restore is BLOCKED pending a disposable database and reviewed rollback strategy. No destructive restore API was added.
- CSRF relies on same-origin `Origin` validation; production proxy/canonical-origin behavior is unverified. VND finance is separate from Gold/XP by source and tests.
- PWA offline behavior, two-owner PostgreSQL races (retry/claim/buy/craft/reward/AI), migration-twice behavior, and real worker crash/retry remain BLOCKED pending isolated infrastructure.

## Next checkpoint

1. The focused Construction browser rerun completed but failed at the `#curve-angle` lookup after the radius edit; inspect its trace if continuing this browser issue. Full E2E remains incomplete and must not be reported PASS.
2. Review the 72 Vitest failures against source owners; fix only proven source defects or correct stale selectors/contracts without weakening expected behavior.
3. `git diff --check` is clean. Restore generated `next-env.d.ts` to the checkpoint version, stage only reviewed files, keep the pre-existing `BossArena.tsx` JSX edit unstaged, and keep `.tmp/` out of Git.
4. Commit the baseline on `codex/baseline-repro-20261106`. A commit is a reproducible checkpoint, not release acceptance: Vitest, full E2E, shared rate limiting and PostgreSQL gates remain red/BLOCKED until independently resolved.

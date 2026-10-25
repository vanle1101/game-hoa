# Test report

Updated: 2026-10-15. Report scoped evidence only; the codebase is changing in parallel.

Latest integrating-lead evidence: **245 tests passed and production build passed** before the request-size follow-up below. The lead also directly exercised the desktop browser at **1087×836**: entered Build Mode, added an adjacent **3×4 room using coordinate controls**, observed **2 derived rooms / 28 floor tiles / 26 walls**, a **320 Gold** estimate, and **Save disabled with 0 Gold**. A palette overlap with undo controls was found and corrected. This verifies those interactions only: pointer-drag construction, a funded commit/reload, doors, mobile controls and FPS targets are not established by this observation.

| Run | Result | Scope / limitation |
| --- | --- | --- |
| Latest `npx vitest run tests/api.integration.test.ts tests/construction/store.integration.test.ts` | 69 passed across 2 files | 52 guest-session/API/schema tests and 17 real isolated construction store/schema/API tests; includes >64 KB three-floor commit through a bounded 1 MB game route |
| `npx eslint src/app/api/game/route.ts tests/api.integration.test.ts tests/construction/store.integration.test.ts` | Passed | Latest payload-bound and guest-session test changes |
| `npx vitest run tests/api.integration.test.ts tests/ai tests/server-store` | 109 passed across 6 files | 50 API/auth/schema tests, 44 AI tests, 15 store tests; provider/auth and Postgres are mocked where appropriate |
| `npx eslint src/server/store.ts tests/server-store` | Passed | Store changes and focused tests |
| Earlier focused AI/API typecheck | Passed | Before concurrent 3D construction/navigation changes |
| Whole-repository production build (lead run) | Passed | Integration build; live credentials, database behavior and gameplay acceptance remain separate |
| Construction acceptance 1–61 | Partial | See individual evidence in `CONSTRUCTION_ACCEPTANCE.md`; unit counts do not establish full browser acceptance |
| Earlier construction QA topology + store tests | 20 passed across 2 files | Historical six topology/navigation tests plus fourteen store tests; store suite now has 17 passing tests as recorded above |
| `src/components/construction/draft.test.ts` | 10 passed | Immutable local tools, bounded history, undo/redo branch invalidation, cancel reset, doors/windows and painting |
| `npm run db:generate` | Passed | Four-table initial migration generated and statically reviewed; not executed against a database |
| Live Neon migrations/locks | Not run | Database is not configured |
| Live provider authentication/inference | Not run | No verified remote Muse contract/production provider credentials |
| Desktop browser 1087×836 (lead observation) | Partial functional evidence | Coordinate room construction, topology count/cost preview, insufficient-funds Save gate; mobile/FPS pending |

Store tests use OS temporary directories named `lifelevel-store-test-*`; they assert the cleanup target is inside the OS temp directory and never use the current user's `.local-data`. The Postgres transaction double verifies transaction control flow only, not real SQL locking or infrastructure.

Latest added construction regressions: outer-room legacy migration and duplicate legacy/new-house placement both pass after the domain owner's fixes. The isolated construction store suite now passes **17 tests**, including these two regressions and the full three-floor payload regression.

Construction store tests use separate `lifelevel-construction-test-*` temporary directories. They verify round-trip architectural fields, finance isolation, canonical Gold debit/refund, no net Gold minting, stale revision races, stable save key, atomic insufficient-funds rejection, schema tampering, locked/support constraints and preservation of legacy fields. A real route → local store → domain → reload test also verifies same-key retry and cross-key stale revision rejection with one stored charge; another tests origin rejection. The three-floor fixture saves 768 floor cells with disjoint stair landings, ceilings and roof; its body exceeds 64 KB and is below 1 MB. This is domain/store/draft evidence, not browser acceptance.

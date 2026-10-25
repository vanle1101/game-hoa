# Implementation plan

This plan tracks the complete supplied specification. Initial audit: empty target directory. Status is deliberately separated from acceptance; an agent report or successful build does not automatically complete a phase.

## Ownership and dependencies

The lead owns architecture, shared contracts, integration, production permissions and final validation. The foundation agent owns app scaffolding and the initial UI/3D shell. The domain agent owns deterministic gameplay logic and domain tests. The audit agent owns the initial audit, provider audit and coverage/decision documents. Shared schemas and package/global-style changes must have one owner at a time.

Dependency order: runtime and contracts → persistence/auth foundation → vertical slice → expansion domains → complete screens → production hardening/QA. AI provider discovery runs independently; live credentials are not a prerequisite to building proposal validation and approval.

## Execution phases and acceptance gates

| Phase | Work | Acceptance evidence required |
| --- | --- | --- |
| 0. Audit | Workspace, runtime, existing code/assets/data and risks | Initial audit saved; no existing data overwritten |
| 1. Muse discovery | Inspect old configuration and actual request transport without leaking secrets | Provider audit records both implementations, live verification limits and deployment blockers |
| 2. Foundation | Next.js App Router, strict TypeScript, UI tokens, routing, schema, auth, database and tests | Typecheck/build; migration review; authenticated route tests; responsive shell inspection |
| 3. Vertical slice | 3D apartment, character, interaction, task completion, XP/Gold, boss damage, loot, inventory, equipment | Persist and reload; integration test of the entire loop; duplicate-action test; browser interaction |
| 4. Quest engine | Recurrence, habits, timezone, deadlines, commitments, penalties, undo and journal | Boundary/timezone tests; idempotent reward/penalty application; safe dependent undo |
| 5. Combat and economy | Boss types/phases, damage/crit/defense, rarity, fixed-once loot, farming, crafting, enhancement | Server-controlled rolls; insufficient-material tests; concurrent purchases/crafting; no free-attack exploit |
| 6. Character | Stats, equipment slots/modifiers, six skill branches, career and achievements | Ownership/slot checks; progression and modifier tests; persisted unlocks |
| 7. Apartment | Room unlocks, furniture shop/ownership, grid/collision/rotation, save/cancel, pets | Purchase → inventory → placement → reload; collision/bounds; pet integration |
| 8. Finance | Accounts, income/expenses/transfers, categories, budgets, savings, bills, import/report/reconciliation | Integer money tests; duplicate CSV preview; account reconciliation; Game Gold and AI isolation |
| 9. AI Butler | Server provider contract, strict proposals, permissions, preview/approval/rejection, logs/history | Valid/invalid response tests; bounded request/retry; no forbidden mutations; live status truthful |
| 10. Screen coverage | All 26 screens and global overlays | Per-screen checklist plus actual interactions and persisted state, not just routes |
| 11. Polish | Quality presets, adaptive DPR, mobile camera, WebGL fallback, motion, accessibility | Screenshots at all required viewports; keyboard/touch checks; measured FPS/memory |
| 12. Final QA | Unit/integration/concurrency/E2E, migrations, backup/restore, security, PWA and deployment | Record exact commands/results; isolated restore; guest-session isolation and ownership failures; offline read-only |
| 13. Handover | Setup/env/deployment instructions, screenshots, feature matrix, issues and reports | Clearly separate verified work, limitations and external blockers; no unauthorized deployment |

## Persistence and transaction gates

The final storage design must give every specification domain a durable home: authentication/profile, character/progression, task occurrences/commitments, campaigns/chapters, encounters/rewards, item instances/materials/recipes, apartment ownership/placements, pets, game ledger, isolated finance, AI proposals/logs, notifications/achievements/journal/settings/backup metadata. Combining tables is acceptable only if ownership, integrity and transactional behavior remain clear.

Enforce: one reward per occurrence; one claim per encounter; no retry loot rerolls; nonnegative Gold/materials; valid ownership and equipment slot; finance isolation; undo without duplication; user verification on every mutation; concurrent consistency. Use unique constraints/idempotency keys with transactions and race-safe updates. Test against the actual persistence implementation; pure functions alone cannot prove database concurrency.

## Required global overlays

Track quest complete, XP gain, level up, damage, critical hit, boss phase/victory, item/legendary drop, equipment comparison/equipped, craft/enhancement, purchase, achievement, room unlock, exhaustion/respawn, penalty details, undo, AI proposal, notifications, loading/error, offline/reconnect, confirmation and onboarding. Each must correspond to real state and accessible dismissal/action behavior.

## Final journey

Exercise login → character creation → apartment → task → XP/Gold → boss defeat/loot → inventory/equip → changed subsequent damage → furniture buy/place/reload → finance transaction with unchanged Gold → AI proposal/approval into calendar/tasks → export → restore in an isolated environment. Record failures and unavailable credentials. Test viewport sizes 390×844, 768×1024, 1440×900 and 1920×1080. Measure FPS rather than estimating it.

## Construction expansion (additive BUILD-0–8 roadmap)

The 2026-10-15 construction specification expands the existing application; it does not replace phases 0–13 or waive the original 26-screen acceptance. Keep task/combat/equipment/finance/AI data and behavior intact. Live, Build and Buy modes must use one committed house model; local drafts do not spend Gold. Store structured topology, not serialized Three.js meshes.

| Phase | Deliverable and dependency | Acceptance gate | Initial status |
| --- | --- | --- | --- |
| BUILD-0 Audit | Existing apartment/assets, placement/economy/store, migration mapping | Reuse/replacement boundaries documented; preserve existing saves | RUNNING |
| BUILD-1 Contracts/grid | Integer x/z/floor coordinates, unique wall edges, floors/openings/rooms, pricing/ownership/revision schema | Unit schema/topology tests; agreed renderer and server contract | RUNNING |
| BUILD-2 Structure slice | Plot → four walls → floor → door/window → cost → commit → reload | Real reconstructed openings and exact persisted architecture; no forged prices | QUEUED on BUILD-1 |
| BUILD-3 Live integration | Navigation from topology, wall/furniture blocking, doors, safe character relocation and mode camera transition | Character routes through doors and safely reports unreachable destinations | QUEUED on BUILD-2 |
| BUILD-4 Buy mode | Distinct catalog/ownership, ghost/footprint, purchase/place/move/rotate/store | Furniture and interactions retain identity after moves/reload; no door blockage | QUEUED on BUILD-1/3 |
| BUILD-5 Advanced building | Rooms/names, painting, nonrectangular regions, ceilings/roofs and level-ready schema | Derived room topology and first-floor completeness; unsupported upper floor operations fail closed | QUEUED |
| BUILD-6 Progression | Authoritative area/material/blueprint unlocks through progression and boss rewards | Task/Gold and boss/unlock paths are testable persisted gameplay | QUEUED |
| BUILD-7 Polish | Cutaway geometry, asset consistency, editor controls, mobile palette, optimized preview | Direct desktop/mobile review and measured FPS; procedural assets labeled | QUEUED |
| BUILD-8 Final QA | 61 acceptance scenarios, regression/security/concurrency/migration/build | Evidence for every scenario; unavailable live database/providers remain explicit | QUEUED |

Ownership: domain agent owns `src/construction` and `construction.commit` domain contract; scaffold agent owns procedural renderer/navigation integration; lead owns editor UI/mode transitions/integration; audit/QA agent owns construction tests, audit tracking and migration review. Six requested BUILD roles are assigned across these four active agents because runtime concurrency is four. Shared domain contracts, schema, global CSS and scene files have a single owner at a time.

Critical invariants: authenticated house owner, current house revision, server-recomputed cost and refund, nonnegative Gold, valid unique topology, valid openings/support/footprints/reachability, atomic state/ledger/journal persistence, stable save key, no duplicate charge/refund, no real-finance changes. Revision conflicts require reload/review, not silent overwrite. Draft undo/redo/cancel never mutate server economy. Preserve legacy furniture ownership and placements during upgrade; never delete a save to fix a schema mismatch.

Full construction acceptance is tracked in `CONSTRUCTION_ACCEPTANCE.md` (61 numbered requirements). A preview request does not approve the visuals, pause implementation, or imply completion.

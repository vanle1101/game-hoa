# Feature and screen acceptance matrix

Baseline created 2026-10-15 from the supplied 26-screen specification. **Pending verification** means acceptance has not been demonstrated by this audit; it does not imply a route has or has not been created concurrently. Update rows only with concrete implementation and test evidence. Partial local/demo behavior must remain distinct from authenticated production persistence.

Every row additionally requires desktop/mobile design; loading, error and empty states; usable navigation; keyboard/touch support where relevant; and durable state where relevant.

| # | Screen | Functional acceptance | Evidence/status |
| --- | --- | --- | --- |
| 01 | Welcome / Start Game | Cinematic preview, Continue, New Game, Settings and Login; resume persisted state | PARTIAL: implemented as `welcome-overlay` in `GameApp`; full acceptance evidence pending |
| 02 | Character Creation | 3D preview; name, appearance/hair/skin/outfit; career/goals; confirm and persist | PARTIAL: implemented as `creating` modal; full appearance/goals persistence evidence pending |
| 03 | Home / My Life | Walk/idle, interactive apartment, stats/Gold/XP/boss HUD, priorities, loot, time, notifications and world navigation | PARTIAL: interactive 3D/HUD exists; animation breadth, HUD state and performance acceptance pending |
| 04 | Quest Journal | Today/priority/overdue/daily/weekly/habits/campaign filters; create/edit/complete, rewards/deadline/difficulty/damage preview | PARTIAL: create/complete/checklist and kind/search filters exist; full edit/priority/overdue filters and damage preview incomplete |
| 05 | Calendar | Day/week/month, timeline, drag/reschedule, flexible/committed behavior, workload, AI suggestions, milestones | PARTIAL: day/week/30-day views, drag/date reschedule exist; timeline, workload, suggestions and milestone views incomplete |
| 06 | Campaign Map | Goal/chapter/milestone/task/boss graph with unlocks, progress and rewards | PARTIAL: campaign create and milestone nodes exist; chapter/unlock graph and reward detail incomplete |
| 07 | Boss Arena | Boss presentation, HP/level/rarity/phase/resistance, power/weapon, linked quests, combat log, damage/victory; no free attacks | PARTIAL: encounter HP/stats and task-based combat exist; complete log/phase/victory presentation incomplete |
| 08 | Boss Hunter Board | Daily/weekly/campaign/elite/legendary encounters, requirements, defeat records, reward previews and encounter selection | PARTIAL: catalog/encounter selection and level gate exist; full defeat records and reward details incomplete |
| 09 | Loot Results | Reveal and rarity effects; XP/Gold/materials/equipment, equip action, inventory link and history; no repeat claim | PARTIAL: earned inventory display and equip exist; complete reveal, material/XP/Gold summary and reward history incomplete |
| 10 | Character Profile | 3D character, level/XP/stats/power, titles, equipment and achievements | PARTIAL: 3D/stat/name display exists; title selection and integrated achievement overview incomplete |
| 11 | Equipment | 3D preview, slots, comparison/details, equip/unequip, ownership and derived power | PARTIAL: slots/equip/unequip exist; item-to-item stat comparison incomplete |
| 12 | Inventory | Grid, category/rarity/sort/filter/search, details, use/equip, materials and collections | PARTIAL: item search/equip and material inventory exist; category/rarity/sort/use/collection controls incomplete |
| 13 | Skill Tree | Six branches, nodes/connectors, requirements, progress, descriptions and rewards | PARTIAL: six branches and unlocks exist; connector visualization and richer node requirements incomplete |
| 14 | Career | Path/profession, XP/rank, specializations, promotion milestones and achievements | PARTIAL: career selection and promotion exist; specialization/milestone/achievement detail incomplete |
| 15 | Apartment | 3D overview, room switching, camera, objects/lighting, unlocks and environment settings | PARTIAL: apartment scene and camera exist; complete room/environment interactions require verification |
| 16 | Build Mode | Grid, owned catalog, ghost/collision preview, rotation, bounds, save/cancel and persisted placement | PARTIAL: owned furniture selection, rotation, ghost, placement/save/cancel exist; collision feedback and full persistence journey pending |
| 17 | Furniture Shop | Categories/previews/prices/owned status, room compatibility, purchase and placement | PARTIAL: furniture/room purchase and placement links exist; category and compatibility filtering incomplete |
| 18 | RPG Item Shop | Weapons/armor/accessories/consumables/materials, stats/rarity, validated purchase into inventory | PARTIAL: equipment catalog and server purchase exist; full consumable/material categories incomplete |
| 19 | Crafting Workshop | Workshop visual, recipes/materials/preview, enhancement/comparison, confirmation and history | PARTIAL: recipe/material checks and enhancement actions exist; confirmation/comparison/history presentation incomplete |
| 20 | Farming Board | Daily/weekly challenges, materials/elite encounters, repeat limits, reward preview and progression | PARTIAL: farming/daily/weekly tasks and material stock exist; dedicated elite challenge/reward progression board incomplete |
| 21 | Pets | Collection, active pet, 3D preview, accessories, interaction, apartment and cosmetics | PARTIAL: adoption, bond care and apartment presence exist; pet selection/accessories/cosmetics/3D preview incomplete |
| 22 | Achievements | Trophies/badges/rarity, unlock progress, hidden achievements and collection milestones | PARTIAL: achievement catalog and earned status exist; hidden/progress/collection milestone presentation incomplete |
| 23 | Personal Finance | Account balances, income/expense/transfers, cashflow/transactions, budgets/savings/reports, CSV preview/duplicates/reconciliation | PARTIAL: accounts, transactions, transfers, budgets, savings, bills, CSV preview and reconciliation exist; browser/report acceptance pending |
| 24 | AI Butler | Chat/planning, structured preview, approve/reject, history, truthful provider status and permission settings | PARTIAL: server proposal/approval and `ButlerPanel` implemented; 94 focused API/security tests pass. Browser and live-provider acceptance pending |
| 25 | Journal | Filter XP, Gold ledger, damage, loot, purchases, crafting, penalties, achievements and AI actions | PARTIAL: journal text filtering and undo exist; type-specific filtering and full event presentation incomplete |
| 26 | Settings | Profile/account/display/graphics/audio/theme/accessibility/PWA/notifications/rules/hardcore/provider/privacy/export/restore | PARTIAL: graphics, reduced motion, hardcore/rest-day and export UI exist; audio/theme/notification/privacy/restore controls incomplete |

## Cross-system acceptance

| Requirement | Required evidence | Status |
| --- | --- | --- |
| Task → rewards → boss damage → loot → equip | Real persisted end-to-end journey including changed damage from equipment | Pending verification |
| Campaign progression | Goals through chapters/milestones and boss victory to unlock | Pending verification |
| Farm → craft → equip | Limits, material consumption, item ownership and combat modifier | Pending verification |
| Shop → apartment | Validated debit, ownership, placement and reload | Pending verification |
| Hardcore | Missed commitment, once-only penalty, exhaustion/recovery, journal, safe undo | Pending verification |
| Finance isolation | Transactions and reports cannot mutate game economy or enter AI context | Pending verification |
| AI planning | Validate → preview → approve/reject → apply/log; forbidden actions rejected | Server validation, approval CAS, retry idempotency and forbidden operations tested; UI/full persisted journey pending |
| Concurrency/idempotency | Double click, two tabs, retry, duplicate claims, parallel purchase/craft, dependent undo | Pending verification |
| Auth/security | Browser guest cookies, ownership, validated server mutation, secret isolation and rate limiting | Guest isolation unit-tested; live deployment lifecycle and distributed rate limiting remain unverified |
| Persistence/migrations | Neon/Drizzle schema, safe migrations, transactions, restart/reload and isolated restore | External configuration and verification required |
| PWA/offline | Installability, icons, read-only snapshot, connection indication and safe reconnect | Pending verification |
| 3D/performance | Presets/fallback, reusable assets/animations, camera/occlusion, measured desktop/mobile FPS | Pending verification |
| Vercel | Supported runtime, successful build, server/client boundary, environment/auth redirects, no persistent filesystem dependency | Build verification and deployment configuration required |
| Production Muse | Verified remote transport, credentials, text/JSON/error handling and server compatibility | BLOCKED: old project exposes local OpenCode CLI and Chrome bridge only; no verified remote contract |

All global overlays in the implementation plan remain subject to behavior and visual verification. A completed navigation map must not be counted as completed feature coverage.

## Additive construction expansion

The new modular house editor expands screens 03, 15, 16 and 17 plus gameplay progression; it does not replace the original 26 screens. Prior furniture-placement behavior is not a completed wall/floor/opening construction system. All 61 required construction scenarios are tracked separately in [CONSTRUCTION_ACCEPTANCE.md](CONSTRUCTION_ACCEPTANCE.md). BUILD-0–8 are integrated into the original implementation plan. Current expansion status: **IN DEVELOPMENT / ACCEPTANCE PENDING**.


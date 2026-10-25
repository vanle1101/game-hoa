# Reference implementation matrix

Baseline audit: 2026-10-16. This maps the PDF's **26 concepts**, whose numbering is different from the original product's 26-screen list in `FEATURE_MATRIX.md`. Some PDF concepts describe shared asset families, not additional navigation routes. All 36 PDF pages were rendered and individually inspected; details and source limitations are in `VISUAL_REFERENCE_AUDIT.md`. Page PNGs and selectable prompt text are under `docs/reference/`.

Statuses below are the source baseline before the current reconstruction wave: **PARTIAL** means an implementation surface exists but does not establish reference parity; **MISSING** means the identified reference behavior/presentation was absent; **UNVERIFIED** means the integrated visual acceptance has not been exercised. Concurrent edits must be reassessed after integration, not marked complete from an agent report.

## All 26 concepts

| Concept / PDF page | Required implementation | Existing file / integration target | Baseline gap and acceptance gate |
| --- | --- | --- | --- |
| 01 Main character / 5 | Shared articulated adult cyberpunk avatar with face and garment detail | `src/components/world/Apartment.tsx` (`Avatar`); shared renderer `src/components/world/CharacterModel.tsx` and `character-shape.ts` | PARTIAL: box/capsule player; require shaped face, consistent proportions and cross-scene identity. |
| 02 Character creator / 6 | Central real 3D preview, left facial categories, right garment/preset controls | `src/components/game/ProgressionExtras.tsx` (`AppearancePanel`), `GameApp.tsx`; creator target `src/components/character/` | PARTIAL: color controls and three hair options; independent facial changes and draft preview missing. |
| 03 NEON HAVEN / 9 | Layered city, transit/signage, atmospheric depth beyond real windows | `src/components/world/Apartment.tsx` (`City`), `src/components/world/ConstructionWorld.tsx` | PARTIAL: repeated tower geometry; art/lighting/scale and low-quality performance unverified. |
| 04 Starter apartment / 10 | Coherent furnished cutaway with bedroom/lounge/workstation/kitchen | `src/components/world/Apartment.tsx`, `src/components/construction/ConstructionWorld.tsx`, `src/construction/migration.ts` | PARTIAL: real geometry and navigation; match room richness and preserve migrated placements. |
| 05 Endgame penthouse / 11 | Multi-room/level property, stairs, garden/display progression | `src/construction/engine.ts`, `src/domain/catalog.ts` (`ROOMS`), both construction renderers | PARTIAL: building supports floors/unlocks; composed endgame property and visuals unverified. |
| 06 Build Mode / 12 | Large grid canvas, room ghost, architectural tools, cost/undo/save | `src/components/construction/ConstructionEditor.tsx`, `construction.css`, `draft.ts` | PARTIAL: tools/domain/store exist; pointer workflows, mobile and reference layout require new screenshots. |
| 07 Building kit / 13 | Consistent modular walls/openings/slabs/stairs/roof/pillars | `src/components/construction/render-geometry.ts`, `src/components/world/geometry.ts`, `src/construction/catalog.ts` | PARTIAL: real cutouts/support rules; asset breadth, trims and consistent one-meter/three-meter proportions must be checked. |
| 08 Doors/windows/materials / 14 | Recognizable opening variants and reusable material catalog | `src/construction/catalog.ts`, `src/components/construction/ConstructionEditor.tsx`, both construction renderers | PARTIAL: materials/openings exist; thumbnails, detailed frames and distinct material responses unverified. |
| 09 Buy Mode / 15 | Real ghost footprint, owned catalog, selected object contextual controls | `src/components/construction/ConstructionEditor.tsx`, `draft.ts`, `src/domain/engine.ts` | PARTIAL: buy/place/rotation/save; add visual thumbnails and verify pointer placement/purchase/reload. |
| 10 Furniture assets / 16 | Distinct modular bedroom/lounge/work/kitchen/display pieces | `src/components/world/Apartment.tsx` (`Furniture`), `src/domain/catalog.ts` (`FURNITURE`) | PARTIAL: procedural recognizable classes but generic fallbacks; catalog-model and scale audit needed. |
| 11 Inventory / 17 | Category rail, dense rarity slots, selected-item hero/details/equip | `src/components/game/GameApp.tsx` inventory branch, `game.css`, `src/domain/catalog.ts` | PARTIAL: search/equip/material cards; selected detail, filters and real item art lack parity. |
| 12 Equipment / 18 | Same full-body avatar, surrounding slots, stats and item comparison | `src/components/game/GameApp.tsx` character/equipment branch, shared avatar | PARTIAL: equipment actions and preview; exact wardrobe synchronization, comparisons and composition unverified. |
| 13 Weapon set / 19 | Eight original tiered technological weapon silhouettes | `src/domain/catalog.ts` (`ITEMS`); shared item-art target `src/components/game/` | MISSING visual asset family: generic sword/category icons are not eight distinct rendered weapons. |
| 14 Item icons / 20 | Consistent five-column icon family and rarity/shape legibility | `src/components/game/GameApp.tsx` item/material displays; shared item-art target | PARTIAL: functional icons; object-specific coherent artwork and small-size recognizability missing. |
| 15 Crafting / 21 | Workshop context, central selected 3D item, recipe/materials/stat deltas | `src/components/game/GameApp.tsx` crafting branch, `src/domain/engine.ts` | PARTIAL: validated craft/enhance; reference workshop/hero preview and before-after interaction missing. |
| 16 Loot / 22 | Earned hero reveal with Gold/XP/material/item summary, equip/history | `src/components/game/GameApp.tsx` loot branch, `src/domain/engine.ts` | PARTIAL: earned item list/equip; event-based reveal/complete summary and visual focus missing. |
| 17 Static Wraith / 23 | Asymmetric armored machine, cyan core/violet energy, consistent views | `src/components/game/GameApp.tsx` boss branch; boss scene target `src/components/world/` | MISSING rendered boss: target icon baseline cannot meet silhouette reference. |
| 18 Boss arena / 24 | Boss/player spatial scene, progress/phase, linked tasks and history | `src/components/game/GameApp.tsx` arena branch; `src/boss/` V5 domain | PARTIAL: old HP/task UI exists; V5 meaningful progress and actual boss/avatar presentation must replace baseline. |
| 19 Quest journal / 25 | Mission list/detail, top priorities, deadlines, difficulty/rewards | `src/components/game/QuestManager.tsx`, `quest-model.ts`, `quest.css`, `src/domain/engine.ts` | PARTIAL: recent quest editor; compare layout and verify linked V5 boss progress/real completion. |
| 20 Skill tree / 26 | Six connected branches, node detail, locked/available/unlocked states | `src/components/game/GameApp.tsx` skills branch, `src/domain/catalog.ts` (`SKILL_NODES`) | PARTIAL: branch cards/unlock actions; connected network and selected-node interaction missing. |
| 21 Campaign / 27 | City district graph for campaign/chapter/milestone/boss | `src/components/game/GameApp.tsx` (`Campaigns`), `src/domain/engine.ts`, `src/boss/` | PARTIAL: campaign/milestone functions; map, chapter gates and V5 required-milestone semantics need acceptance. |
| 22 Home/HUD / 28 | Approx. 75% world view, compact priorities/boss/vitals, collapsible nav | `src/components/game/GameApp.tsx`, `game.css`, construction/live world | PARTIAL: canvas/HUD exist; sidebar/HUD density must be rebuilt and inspected at both sizes. |
| 23 Finance / 29 | Calm readable balances/cashflow/categories/budgets, distinct real money | `src/components/game/FinancePanel.tsx`, `src/finance/`, `src/app/api/finance/route.ts` | PARTIAL: real functionality; visual reference comparison and chart/report UX remain unverified; do not mix Gold. |
| 24 AI butler / 30 | Holographic identity, conversation, structured change proposals/permissions | `src/components/game/ButlerPanel.tsx`, `src/server/ai.ts`, `src/app/api/ai/route.ts` | PARTIAL: safe proposals/approval/history; conversation composition/identity missing, live remote provider unverified. |
| 25 Pets / 31 | Five separate recognizable companion designs and shared home presence | `src/components/world/Apartment.tsx` (`Pet`), `src/components/game/ProgressionExtras.tsx`, `src/domain/catalog.ts` | PARTIAL: care/accessory/selection logic; one generic mesh lacks five reference silhouettes. |
| 26 RPG Store / 32 | Categories, owned states, Gold purchase, selected 3D item showcase | `src/components/game/GameApp.tsx` shop branch, `src/domain/engine.ts`, `src/server/store.ts` | PARTIAL: validated purchases; selected hero/categories/thumbnail composition and wardrobe integration missing. |

## Supplements and added systems

| Addition / page | Exact required scope | Integration files / verification |
| --- | --- | --- |
| Style lock / 3-4 | Exact palette; consistent world/rig/material/typography/HUD; no generic dashboard, blocky or unrelated medieval/cartoony assets | `src/app/globals.css`, shared UI and all 3D components. Tokens already match; visual quality remains UNVERIFIED. |
| Face controls / 7 | 12 hairstyles, 12 hair colors, 6 eye shapes, 8 iris colors, 6 brows, 6 noses, 4 ear shapes, 6 mouth/lip types, 6 face/jaw presets, 12 skin tones, 3 bodies | `src/character/{types,schema,catalog}.ts` contract under active implementation; shared avatar and creator must visibly render every option, not only store it. |
| Creator interactions / 7-8 | Head/full-body framing, orbit, zoom, reset, comparison, Save/Cancel/Reset/Randomize | Creator/shared preview target; exercise controls on desktop/mobile and confirm persisted draft rules. Baseline MISSING. |
| Starter wardrobe / 8 | Street Runner, Neo-Corporate, Night Technician granted once free; suggested 6 tops/4 bottoms/4 shoes/3 outerwear/4 accessories | `src/character/`, `src/domain/engine.ts`, `src/server/store.ts`; test zero debit, no duplicate grants, remix and re-equip after reload. Baseline MISSING. |
| Fashion shop / 33 | Preview without charge; exact Gold/ownership/unlock checks; atomic one-time grant; equip immediately; compare before/after | `src/character/`, server domain/storage, wardrobe/shop UI target; purchase/retry/two-tab tests and live appearance checks required. Baseline MISSING. |
| Wearable slots / 34 | Hair, Headwear, Face/Eyes, Earrings, Top, Outerwear, Bottoms, Shoes, Gloves, Back, Cyberware, optional Full Outfit | Shared catalog/renderer compatibility rules; disclose locked slots, verify clipping and require owned available items. Baseline MISSING. |
| Cross-screen avatar / 4,8,33-34 | Exact same face/hair/garments in creator, wardrobe, home, profile/equipment, arena/relevant overlays | One versioned appearance config and shared `src/components/world/CharacterModel.tsx` renderer. Screenshots and reload evidence required; compilation does not prove identity. |
| Economy isolation / 8,34 | Cosmetics must not accidentally change combat or finance; ownership permanent; server wallet/event/ownership changes atomic | Tests in domain/store plus finance separation. Preserve guest-session ownership boundaries. |
| Boss Rework V5 / user request, not PDF | Habit and project bosses based on meaningful real-world progress, in coordination with explicit current user requirements | `src/boss/{types,schema,progress,engine}.ts` under active implementation. PDF page 24 is visual only; do not mistake legacy HP presentation for V5 semantics. Full V5 text is held by lead. |
| Existing product additions | Welcome, calendar, career, farming, achievements, journal, settings | Retain original `FEATURE_MATRIX.md` screen scope; apply shared art direction without dropping those routes because they lack standalone PDF concepts. |
| Accountless access / latest user decision | Open directly using per-browser guest session; no Google login | Preserve `src/server/identity.ts` and existing guest isolation tests. This overrides old Login references in the original matrix. |
| QA / 34-36 | Eleven fashion scenarios, screen captures, low graphics/reduced motion, clipping, measured FPS and persistence/concurrency | Record concrete results in `TEST_REPORT.md`; all new reference-parity gates initially UNVERIFIED. |

## Eleven explicit fashion acceptance cases (page 34)

1. Change eye, nose, ear and hair independently and visibly inspect each response.
2. Select a starter outfit with zero Gold debit.
3. Reload and verify every face setting and outfit layer.
4. Buy one jacket: exact debit and one permanent grant.
5. Duplicate/retry/concurrent purchase: no duplicate debit or grant.
6. Equip jacket and inspect wardrobe, home and character view.
7. Remove/re-equip original outfit; original items remain owned.
8. Insufficient Gold and locked items do not unlock.
9. Clothing does not change finance balances or combat stats accidentally.
10. Inspect headwear/hair, masks, shoes, arms and animation clipping.
11. Repeat relevant journeys on desktop, mobile, low graphics and reloaded sessions.

No case in this new fashion/reference acceptance list is marked passed by this audit. Reference extraction and source inspection are complete; implementation and runtime visual acceptance remain separate work.

## Reconstruction wave: reference panels implemented, visual acceptance pending

On 2026-10-16, `src/components/game/ReferencePanels.tsx` and `reference-panels.css` added functional replacement exports for inventory, RPG equipment shop, crafting/enhancement, earned loot, connected skills and companion collection. Original SVG artwork now differentiates weapon variants, equipment slots and the three currently available pet definitions. This is vector item/companion art, not a claim of imported 3D assets or full PDF asset breadth.

The panels use existing `GameState` and server `Action` contracts. Inventory supports category/rarity/search, selected-item comparison, equip/unequip and material counts. Shop and crafting show confirmation and real costs. Loot comes from recorded `boss.defeated` / `boss.meaningful.defeated` events and never adds a claim action. Skill nodes use real XP and prerequisite gates. Pets support adoption, selection, daily care and owned accessory controls.

Verification: `npm run typecheck` passed; `npx eslint src/components/game/ReferencePanels.tsx` passed without warnings; the existing `tests/domain/game.test.ts` and `tests/domain/economy-extras.test.ts` suites passed 42 tests. These establish type/domain compatibility only. Root integration, desktop/mobile screenshots, keyboard walkthrough and reference composition acceptance remain pending. No current-row visual status is upgraded to verified by this source implementation.

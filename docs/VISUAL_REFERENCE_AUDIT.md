# Visual reference audit

Audit date: 2026-10-16. Source: `E:/Game hoa cuoc song/LIFE_LEVEL_FINAL_DOWNLOAD.pdf`, 11,952,128 bytes, SHA-256 `dd904f65e3c25a89a2513ca9339b5d0c7ac7be9abc03458b339df3b33c945d93`.

## Extraction and inspection evidence

The PDF has **36 pages**, not 26 pages: 26 original concepts, seven supplementary pages, cover, index and implementation directive. Every page was text-extracted with pypdf, rendered with Poppler at 100 DPI, and individually opened through `view_image`. `reference/manifest.json` records exact page sizes, image dimensions, extraction paths and inspection status. `reference/all-text.txt` contains all selectable text; `reference/page-NN.txt` retains each page separately; `reference/pages/page-NN.png` retains every rendered page. Pages 1-2 are landscape; pages 3-36 are portrait containing mostly landscape/square illustrations.

Poppler emitted `No display font for 'Symbol'`. All 36 outputs were nevertheless produced and visually inspected. Several original illustrations, especially pages 13-32, are visibly enlarged low-resolution crops with adjacent concept fragments. This is a limitation of the source artwork, not evidence that missing pixels can be reconstructed exactly. Use prompt text for real labels and semantics, as page 2 explicitly requests; do not reproduce synthetic text from the artwork. These PNGs are reference artifacts only and must not replace interactive scenes.

## Page-by-page visual inventory

| PDF page | Contents | Observed visual or contractual direction |
| --- | --- | --- |
| 1 | Cover / concept montage | Dark engineering grid, cyan title, 26 concept thumbnail overview; useful overview, not a usable app background. |
| 2 | Use instructions / 26-item index | Images are guidance; implement real geometry, controls, persistence; prompts take priority over image text. |
| 3 | Supplement 1 / style lock | Cool violet/cyan city paired with amber-lit cutaway apartment; exact seven-color palette; rejects blocky characters and generic dashboard composition. |
| 4 | Supplement 2 / visual QA | One rig and scale across scenes, shared HUD controls, screenshots at desktop/mobile, clipping and reduced-motion checks. |
| 5 | Concept 1 / main character | Front, side, rear adult male silhouette, layered black jacket, cargo seams, straps, shaped sneakers and restrained cyan trim; natural face and articulated hands. |
| 6 | Concept 2 / creator | Full-body avatar dominates center; left facial controls, right garment thumbnails; studio pedestal, dark floating panels. |
| 7 | Supplement 3 / face customization | Same character close-up/full-body; explicit minimum counts for independent face, hair, eyes, nose, ears, mouth, skin and body controls. |
| 8 | Supplement 4 / rig and starters | Modular anchors, server appearance save, three free outfits, mix-and-match ownership, cosmetic/combat separation. |
| 9 | Concept 3 / NEON HAVEN | Deep layered skyline, elevated transit, dark tower masses, sparse bright signage, warm balcony foreground and atmospheric dusk. |
| 10 | Concept 4 / starter apartment | Dense but coherent cutaway: bed, lounge, workstation, kitchen, glass enclosure, warm floor pools and city-facing windows. |
| 11 | Concept 5 / penthouse | Multi-level rooms, stairs, balcony, garden/pool accents and trophy displays; coherent scale and circulation. |
| 12 | Concept 6 / Build Mode | Viewport dominates, clear grid, translucent cyan room ghost, bottom asset strip, compact right material swatches and top undo/cost. |
| 13 | Concept 7 / building kit | Distinct reusable walls, corner/half walls, openings, doors, stairs and floor slabs; one-meter grid and three-meter wall height stated. |
| 14 | Concept 8 / openings/materials | Hinged/sliding/glass doors and panoramic windows; wood, concrete, titanium and dark floor swatches. |
| 15 | Concept 9 / Buy Mode | Furnished room remains central; cyan footprint/ghost, bottom thumbnails, compact contextual purchase panel. |
| 16 | Concept 10 / furniture | Separate bed, sofa, chairs, tables, kitchen, shelf and plant silhouettes at consistent three-quarter angle. |
| 17 | Concept 11 / inventory | Dense item slot grid with category rail; large selected weapon preview and detail panel on right. |
| 18 | Concept 12 / equipment | Centered full-body avatar bracketed by slots, right stats/comparison, restrained progress bars. |
| 19 | Concept 13 / weapons | Eight tiered silhouettes required by text; increasingly complex technological blades with controlled rarity accents. |
| 20 | Concept 14 / icons | Equal square slots, common camera/lighting, distinct materials and readable item silhouettes; five-column family. |
| 21 | Concept 15 / crafting | Large central weapon over fabrication pedestal, workshop backdrop, left recipes, right cost/stat delta and action. |
| 22 | Concept 16 / loot | One earned item is focal point, controlled warm/violet reveal, supporting rewards beneath, equip/inventory actions. |
| 23 | Concept 17 / Static Wraith | Heavy asymmetric titanium machine, clawed limbs, cyan core and violet corruption; several views of same design. |
| 24 | Concept 18 / arena | Towering boss on platform with small player in foreground, skyline depth, HP/phase at top, linked real tasks in side HUD. |
| 25 | Concept 19 / quest journal | Compact mission list and selected detail, priority/difficulty/rewards; artwork includes neighbor crop, so use written hierarchy. |
| 26 | Concept 20 / skill tree | Connected hexagonal network, six branches, selected center node, distinct locked/unlockable/unlocked states. |
| 27 | Concept 21 / campaign | Nodes connected over city districts, illuminated completed paths, darker locked regions, meaningful chapter/milestone detail. |
| 28 | Concept 22 / Home HUD | Apartment takes about 75% of screen, small priorities and active-boss widget, top currency, bottom vitals; collapsible navigation. |
| 29 | Concept 23 / finance | Calm financial terminal: balance/cashflow/category charts, legible precise values, real money visually separate from Gold. |
| 30 | Concept 24 / AI butler | Small holographic identity, readable central conversation, right structured proposals and permission/approval indicators. |
| 31 | Concept 25 / pets | Five distinct friendly robotic companion silhouettes; compact cat, dog, floating drone, fox and crystalline technology creature. |
| 32 | Concept 26 / store | Category rail, selected 3D item large on pedestal, product tiles, stats/ownership/Gold panel and clear purchase. |
| 33 | Supplement 5 / wardrobe | Live full-body preview and appearance comparison; unified owned/starter items, preview before charge, server grant then equip. |
| 34 | Supplement 6 / economy QA | Slots, compatibility/priority, idempotent ownership and concurrent transactions; eleven explicit cross-system acceptance tests. |
| 35 | Main implementation directive | Preserve working systems/data, real editable 3D, responsive React navigation, milestone verification, no screenshot substitution. |
| 36 | Supplement 7 / final checkpoint | Supplements clarify ambiguity; real mesh responses, starter outfits, Gold purchases, cross-screen persistence, explicit incomplete/blocked reporting. |

## Art-direction contract for implementation

Use `#080D18` background, `#10192C` deep surface, `#32E6F4` interaction cyan, `#9067FF` violet, `#EE5ACB` magenta accent, `#FFBC62` warm accent and `#EDF4FF` text. Existing `src/app/globals.css` already defines these exact anchors. Matching colors alone does not satisfy the reference. Establish coherent typography, selected states, spacing, icon angle, rarity framing and readable Vietnamese labels across modules.

The apartment is a spatial game world: visible architecture, real window/door openings, recognizable separate furniture, warm interior lighting against a cool skyline, and camera framing that keeps the character and usable floor visible. Use restrained emissive seams instead of illuminating every edge. World and build views must retain a large usable canvas at both viewport sizes.

The character should have an adult silhouette with articulated shoulders/elbows/knees, shaped torso/face and layered garments. Head-focused controls must visibly change their respective mesh, attached component or material, rather than merely change metadata. Reuse the same appearance/rig in creator, profile/equipment, wardrobe, home and arena. A geometric fallback is not final visual parity with page 5.

Inventory/store/crafting require selected-item focus and meaningful asset silhouettes, rather than repeating one generic icon in every card. Skill and campaign views need actual connected progression structures. Boss presentation requires a readable character silhouette and meaningful progress, not an enlarged target icon. The separate Boss V5 user requirement governs the progress model and must not be inferred from the older reference's HP illustration.

## Current integrated-wave update (2026-10-16)

Overall application visual status: **IN PROGRESS**. The source audit itself is **VERIFIED** for all 36 pages. The findings in the baseline section below are retained as history and are not a claim that the old target-icon/card-only UI is still the current implementation.

| Group | Assigned owner | Status | Current / changes | Verification | Problems |
| --- | --- | --- | --- | --- | --- |
| Shared avatar and creator | /root/scaffold + /root | TESTING | CharacterModel/shape and CharacterStudio connected to the character route | Source integration; root typecheck passed | Procedural face/garment quality and all-screen identity not visually accepted |
| Inventory/store/craft/loot | /root/audit_docs + /root | TESTING | ReferencePanels connected; real R3F ItemShowcase/WeaponModel for selected items, SVG thumbnails retained | Source wiring checked; earlier focused lint/42 tests passed | Generic nonweapon shapes remain for some item slots; screenshots and real interactions incomplete |
| Boss arena | /root/scaffold + /root/domain + /root | TESTING | BossArena, CombatWorld and meaningful V5 domain integrated | Lead reports 283 latest tests and passing typecheck | Procedural boss quality, animation/control/reward journeys still require browser inspection |
| Skill/pet presentation | /root/audit_docs | TESTING | Connected skills and distinct three-pet vector art with real actions | Source and domain checks | Five requested pet designs and polished 3D set incomplete; screen composition unverified |
| Finance and NOVA | /root | TESTING | FinanceCharts and R3F NovaHologram integrated | Source wiring checked | Populated chart usability and responsive visuals unverified; live AI remains BLOCKED |
| Actual saved home | /root | FIXING | Lead observes empty actual home | Current direct lead report | Diagnose persistent state/render path without replacing save with a decorative scene |
| Full screen/performance comparison | /root + /root/scaffold | NOT STARTED | Complete new 26-screen desktop/mobile set and FPS report absent | No visual-parity claim | Capture actual application state, inspect reduced-motion/low graphics, measure real device timing |

The six-panel source delivery note in the preserved reference-matrix baseline predates root's R3F integration. Selected-item previews are now real 3D; grid art remains SVG. This distinction does not turn procedural models into finished reference-quality assets. The one earlier localhost-fixed.png screenshot does not establish current full-screen acceptance.

## Baseline gaps observed in source

These findings describe the source inspected at the start of this reconstruction wave; other agents are implementing changes concurrently. They are not claims about the final integrated result.

- `Apartment.tsx` currently builds the player from box limbs/torso, capsule head, three box-based hairstyles and a glowing eye strip. This lacks the facial features, wardrobe layers and adult character detail requested on pages 5-8.
- `ProgressionExtras.tsx` has name, three color pickers and three hairstyle choices. It has no independent face/eye/nose/ear/mouth/body preset controls or live draft avatar preview.
- `GameApp.tsx` arena/boss cards use `Crosshair` icons; inventory/shop/crafting largely use repeated Lucide icons and card grids. This does not reproduce the reference's 3D hero and selected-item composition.
- Skills are branch cards rather than a connected tree; campaign nodes need full district/chapter composition. Home includes a fixed navigation sidebar that competes with the reference's world-dominant layout.
- Furniture and city geometry exist and are interactive, but simple meshes and repeated city blocks do not by themselves establish the architectural detail/material/lighting target. Construction save/navigation tests are useful functional evidence, not visual parity.
- Guest sessions remain the current product design; Google login stays removed. Real finance isolation and server-authoritative Gold must survive all visual changes.

## Required QA evidence after integration

Capture each affected screen at desktop and mobile; compare composition, avatar identity, lighting, scale and controls to the page mapping. Exercise face controls independently, each starter outfit, paid preview/purchase/equip, reload, two-tab retries, undo boundaries and insufficient funds. Inspect hair/headwear, face accessories, sleeves, footwear and joint intersections in idle/walk/action poses. Verify reduced motion and low graphics. Record measured FPS with device/viewport/quality and measurement interval; do not infer performance from compilation. No new application screenshots or FPS measurements were produced by this reference-extraction task.

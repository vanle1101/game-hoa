# Asset catalog — measured source registry

**All 349 registered entries are INTEGRATING; VERIFIED = 0.** Registry inventory is not runtime or visual acceptance. The obsolete 186-entry snapshot is superseded by this source measurement. See [ASSET_COVERAGE_REPORT.md](<ASSET_COVERAGE_REPORT.md>) for category targets and unmet acceptance conditions.

## Current bounded measurement — 1627

Measured **2026-10-16T14:36:44.301Z–2026-10-16T14:36:46.289Z**, direct Node v24.22.0 / installed TypeScript 5.9.3, exit0. Totals remain **349 entries / 335 geometry-bearing / 324 distinct signatures / 0 VERIFIED**; all349 remain INTEGRATING. The unchanged synchronous compatibility harness passed26/26 bounded assertion cases (15 registry +11 verification), **not the Vitest runner**, full tests, typecheck, build or GPU validation.

The new [measurement](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/measurement.json>) and [complete records](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/registry-records.json>) preserve the historical directory untouched. The copied harness is byte-identical, SHA-256 `5bc6cd8ae74acf12ee08329ca3353339f4f4f272a081a7fb50553a2cd724cbe0`. [Before](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/source-before.json>) / [after](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/source-after.json>) manifests cover226 source/test/package/lock/config files; both compact-manifest digests are `6f3ca6a6c890770db5e0ac1de52157ff02dbb914a662fb9411500a28c975739f`, changed paths empty. No source or test drift was observed during this bounded interval; this is not a continuing write lock.

Of19 loaded inputs, only [wearable-shapes.ts](<../src/components/world/wearable-shapes.ts>) differs from the historical measurement: `428dde352f8f81b3a68c8c4c70dbde83a4a285782ea96ef3eabf2b1194ddcbd5` → `6de16a30cfcad63bd2ad304e3a672b71d4bcf921251298c8adeb4cde848fc384`. The other18 loaded hashes, including both assertion files, match the historical table below; all current hashes are retained in the new measurement's `loaded` array. Sleeve/scarf recipe edits therefore did not change the unique-count total. Hair and lamp renderer implementations belong to the broader source snapshot but are not loaded registry-signature inputs: unchanged counts cannot certify renderer behavior or renew old runtime evidence bindings. No per-asset promotion was made.

## Historical snapshot and method — 08:01 UTC

The following snapshot and its later crown/terminal checkpoints are retained history, not the latest product gate; current product static/build status is recorded in [TEST_REPORT](<TEST_REPORT.md>). The new measurement above supersedes only the inventory checkpoint.

Measured 2026-10-16T08:01:01.005Z–2026-10-16T08:01:03.156Z; loaded-input publication check 2026-10-16T08:02:29.049Z. Runtime: Node v24.22.0, existing TypeScript 5.9.3. Pre/post comparison covered 217 files under source/tests plus present package manifests, lockfiles and TypeScript configuration. Both manifest digests: `e28c8c679d910577e20383d74347c40db5a5c7696d6b1b23829e96a71cda21d2` (SHA-256 of compact JSON array of path/hash pairs). The bounded measurement was stable; this is observed equality, **not an enforced write lock**. All 19 loaded measured inputs still matched at the publication check. This does not freeze the whole workspace or establish full-suite/build acceptance.

No product source, dependency, lockfile or runtime evidence was changed for this refresh. Only the bounded in-memory source measurement and its synchronous asset assertions were rerun; no install, build, typecheck, browser, GPU or heavy test run was performed. **Later Lead checkpoints on the crown + terminal source:1230 full Vitest3,868/3,868 PASS across80 files in250.60s;1215 global TypeScript/full ESLint PASS;1228 scoped test-only lint PASS;1223 Next16.4.1 production build PASS (compile5.3s/TypeScript9.3s). These are separate from this source measurement, not asset acceptance.**

Direct Node loaded the real catalogs, `createAssetRegistry()`, `calculateAssetCoverage()` and `assetMetrics()` using the already-installed TypeScript `transpileModule` in memory. It executed the unchanged test bodies in [tests/assets/registry.test.ts](<../tests/assets/registry.test.ts>) and [tests/assets/verification.test.ts](<../tests/assets/verification.test.ts>) through an external synchronous compatibility harness for their used Vitest `describe/it/it.each/expect` APIs, backed by `node:assert/strict`. This was **not the Vitest runner**, not a typecheck, not the complete test suite, and not a global product pass. Unsupported async cases are rejected rather than silently accepted.

Result: **26/26 test invocations passed, 0 failed** (15 registry/coverage cases; 11 verification cases, including expanded parameterized veto cases). Registry metadata issues: 0; coverage issues: 0. These assert source references, counts, signature behavior, malformed/duplicate rejection and verification-contract fixtures—not render quality, artifact existence, real database persistence or per-asset acceptance.

## Inventory metrics

| Family / scope | Entries | Geometry-bearing | Distinct structural signatures | Repeated entries | Additional material variants | Material definitions | Runtime verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ALL | 349 | 335 | 324 | 11 | 11 | 13 | 0 |
| cosmetic | 121 | 121 | 110 | 11 | 11 | 0 | 0 |
| furniture | 120 | 120 | 120 | 0 | 0 | 0 | 0 |
| weapon | 36 | 36 | 36 | 0 | 0 | 0 | 0 |
| armor | 30 | 30 | 30 | 0 | 0 | 0 | 0 |
| equipment-accessory | 8 | 8 | 8 | 0 | 0 | 0 | 0 |
| material | 13 | 0 | 0 | 0 | 0 | 13 | 0 |
| door | 8 | 8 | 8 | 0 | 0 | 0 | 0 |
| straight-glass | 6 | 6 | 6 | 0 | 0 | 0 | 0 |
| construction | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| curved-glass | 6 | 6 | 6 | 0 | 0 | 0 | 0 |
| Paid cosmetics (subset) | 97 | 97 | 97 | 0 | 0 | 0 | 0 |
| Free starter cosmetics (subset) | 24 | 24 | 21 | 3 | 3 | 0 | 0 |

Totals are not obtained by adding the paid/starter subset rows to the family rows. Geometry identity is scoped by family. There are 14 entries without geometry signatures: 13 material definitions and one auxiliary stair catalog entry. These do not add distinct structural geometry. Equipment totals 74 entries: 36 weapons, 30 armor, 8 equipment accessories; accessories are not armor. Construction totals 34: 8 doors, 6 curved glass, 6 straight glass, 13 finishes and one stair.

Furniture totals 120 entries: base 36 + living collection 26 + tech collection 25 + craft collection 13 + home collection 20. All 120 have different normalized structural signatures. Cosmetics total 121: 24 free starter and 97 paid, with 110 signatures across the entire family. Free slot composition is 7 tops, 5 bottoms, 5 shoes, 3 outerwear and 4 accessories.

## Signature interpretation

- Furniture signatures normalize dimensions, round coordinates to six decimals and sort structural part descriptors; shape, rotation, roundness, lean and radial segment information are retained when present. Names/materials/color do not create geometry.
- Wearable/equipment signatures describe geometry and attachment transforms, excluding presentation labels and material colors. Equipment signatures preserve rig-relative dimensions. Signatures are structural recipe comparisons, not visual silhouette judgments or proof that procedural output is valid.
- Doors use actual `getDoorRecipe(id, width = 1, height = 1)` part signatures from [src/components/construction/door-models.tsx](<../src/components/construction/door-models.tsx>), also consumed by `DoorLeafModel`. The registry counts eight distinct normalized door recipes, not door-opening dimensions or eight labels. The signature serializes shape, position, size and rotation in recipe part order; it excludes material and part names.
- Curved glass signatures use radius/angle/thickness/height. They do not hash the rendered frame/material implementation: a curve frame fix can leave these six signature strings unchanged. Straight glass signatures use width/height/sill. Materials have no geometry signature. The auxiliary stair has no registry geometry signature even if another renderer constructs stairs.
- Repeated geometry entries mean geometry-bearing entries minus distinct family/signature keys. Additional material variants count distinct material signatures beyond the first within a structural signature group. Material definitions are a separate unit, not variants and not meshes. This registry has 11 repeats and 11 additional variants; neither expands unique geometry.

## Shared structural geometry

| Shared geometry group (registry IDs) | Repeated entries beyond first |
| --- | --- |
| `wearable.runner.jacket`, `wearable.corporate.top` | 1 |
| `wearable.runner.pants`, `wearable.corporate.pants` | 1 |
| `wearable.corporate.shoes`, `wearable.technician.shoes`, `wearable.neon.boots` | 2 |
| `wearable.technician.top`, `wearable.amber.hoodie` | 1 |
| `wearable.technician.pants`, `wearable.cyber.cargo` | 1 |
| `wearable.wide-leg.pants`, `wearable.graphite.wide-leg` | 1 |
| `wearable.city.high-tops`, `wearable.pulse.high-tops` | 1 |
| `wearable.starter.pleated-pants`, `wearable.silver.pleat` | 1 |
| `wearable.starter.loafers`, `wearable.mono.loafers` | 1 |
| `wearable.starter.cyber-coat`, `wearable.violet.coat` | 1 |

These ten groups account for 11 repeated entries (one group contains three IDs). Within the free starter subset there are three repeats/variants and 21 unique signatures. Paid cosmetics have 97 unique signatures within that subset. Eight signatures overlap between free and paid subsets, so 21 + 97 is not the family unique count of 110. Shared structure does not automatically make an asset invalid, but must not be marketed as additional unique modeling.

## Previously pending source, now registered

[src/furniture/collection-home-v7.ts](<../src/furniture/collection-home-v7.ts>) exists; HOME_V7_CATALOG: 20 items, 20 registered IDs; HOME_V7_RECIPES: 20 keys. This source is now included in registry totals. Runtime and visual acceptance remain pending.

[src/character/fashion-accessory-v7.ts](<../src/character/fashion-accessory-v7.ts>) exists; ACCESSORY_V7_SHAPES: 35 keys; ACCESSORY_V7_COSMETICS: 35 items, 35 registered IDs. This source is now included in registry totals. Runtime and visual acceptance remain pending.

All 20 home and 35 accessory IDs now resolve through the registry. This later measurement supersedes the earlier 100-furniture/86-cosmetic snapshot. Their signatures are included in the structural metrics; registration closes source-entry gaps, not purchase/equip, eligibility, style or browser-acceptance gaps.

## Historical geometry refresh and retained evidence — 08:01 snapshot

This source measurement refreshes 22 structural-signature rows relative to the prior documentation snapshot: 21 furniture entries and `equipment.signal-crown`. The current terminal signature digest is `5cf1d3743110f326`; the crown is `ca59be7792a94774`. Totals and all entry/status targets remain unchanged. The full before/after signature hashes are retained in [refresh-check.json](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-final-frozen/refresh-check.json>).

The [coverage report](<ASSET_COVERAGE_REPORT.md#latest-retained-geometry-evidence--scoped-pass-no-promotion>) records the latest existing curve frame-fix six-test PASS, equipment crown-fix r5 (74 previews across two tests), powered furniture galleries (36 + 84 distinct IDs across two tests), and the single-terminal follow-up. The curve six-test result covers five finishes plus an optical-contract check, not six geometry approvals. The terminal follow-up is not a new all-120 run. No browser or premium visual review was repeated here; complete fashion and premium visual acceptance remain unproven. Lead subsequently confirmed1230 full Vitest3,868/3,868 PASS/80 files/250.60s and1223 current production build PASS5.3s compile/9.3s TypeScript, with1215 global TypeScript/full ESLint PASS and1228 test-only scoped lint PASS; these do not establish visual acceptance. **No runtime evidence bindings or VERIFIED promotions were added.**

## Verification contract

The implemented `hasRuntimeVerification` predicate in [src/assets/coverage.ts](<../src/assets/coverage.ts>) requires status `VERIFIED`, valid asset metadata, a passing **runtime** evidence record and a source binding. The binding must identify the same asset ID and match both `sourceSha256` and `observedSourceSha256` to the asset's valid 64-hex `source.sha256`; it also requires nonempty environment/test-case descriptions and at least one artifact with a reference and a valid SHA-256. **Any failed runtime or visual evidence vetoes verification**, even when another runtime record passes. Visual-only success is not sufficient; a separate passing visual record is not required by this predicate.

This is **pure metadata validation, not filesystem truth**: the function does not open the source or runtime artifacts, verify that referenced paths exist, recompute their hashes, inspect images, or prove that an artifact contains the claimed observation. A trustworthy acceptance process must independently do those checks. Synthetic passing/negative fixtures in unit tests do not verify production assets. Current registry records contain source evidence, not source-bound passing runtime evidence; none is promoted by this documentation.

## Registered entries

Rows below retain the historical08:01 registry, including its per-row signature digests; they are not relabeled as current after sleeve/scarf edits. Current exact signatures are in the [1627 records](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/registry-records.json>); aggregate inventory counts above were remeasured unchanged. Price is the catalog numeric price, not transaction evidence. Historical geometry digests are truncated SHA-256 values for navigation only. A dash means no signature. All rows retain status INTEGRATING.

### cosmetic

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `wearable.v7-wrap-skirt` | bottom / bottom | 145 | `v7-wrap-skirt` | `948405bea6be71e6` |
| `wearable.v7-fan-pleat-skirt` | bottom / bottom | 165 | `v7-fan-pleat-skirt` | `8b11f839103eecde` |
| `wearable.v7-cargo-jogger` | bottom / bottom | 140 | `v7-cargo-jogger` | `182933f0949c5ee8` |
| `wearable.v7-asymmetric-drape` | bottom / bottom | 190 | `v7-asymmetric-drape` | `e5a53d84aa04ee64` |
| `wearable.v7-tech-panel-skirt` | bottom / bottom | 220 | `v7-tech-panel-skirt` | `0a0e5f548c524165` |
| `wearable.v7-split-flare` | bottom / bottom | 155 | `v7-split-flare` | `a7d192108c4edd09` |
| `wearable.v7-riding-breeches` | bottom / bottom | 175 | `v7-riding-breeches` | `b508624f8f5b8186` |
| `wearable.v7-box-culottes` | bottom / bottom | 135 | `v7-box-culottes` | `323e4c74d358f4c8` |
| `wearable.v7-orbit-harness-pants` | bottom / bottom | 185 | `v7-orbit-harness-pants` | `32e9ee9267678046` |
| `wearable.v7-split-runner` | shoe / shoes | 140 | `v7-split-runner` | `7905441b4db6e742` |
| `wearable.v7-buckle-combat-boots` | shoe / shoes | 185 | `v7-buckle-combat-boots` | `f17c747dc9c0ad19` |
| `wearable.v7-chelsea-pull-boots` | shoe / shoes | 125 | `v7-chelsea-pull-boots` | `836d015e910d5a91` |
| `wearable.v7-wingtip-derby` | shoe / shoes | 155 | `v7-wingtip-derby` | `6a247a1f7e659788` |
| `wearable.v7-ridge-platform` | shoe / shoes | 175 | `v7-ridge-platform` | `674680fef8abbcb4` |
| `wearable.v7-tabi-zip` | shoe / shoes | 165 | `v7-tabi-zip` | `bdf7a636662ab67d` |
| `wearable.v7-double-monk` | shoe / shoes | 150 | `v7-double-monk` | `9c7c60dd5702e8a1` |
| `wearable.v7-arch-wedge` | shoe / shoes | 180 | `v7-arch-wedge` | `3c32c316666ae44b` |
| `wearable.v7-armored-greaves` | shoe / shoes | 230 | `v7-armored-greaves` | `879c533cff123176` |
| `wearable.v7-top-wrap` | top / top | 145 | `v7-top-wrap` | `ad5b523ef99bb301` |
| `wearable.v7-top-bolero` | top / top | 155 | `v7-top-bolero` | `1d36c0a35ea35d50` |
| `wearable.v7-top-anorak` | top / top | 165 | `v7-top-anorak` | `53fd3ca772751f1a` |
| `wearable.v7-top-field-vest` | top / top | 140 | `v7-top-field-vest` | `cf432e437d5b5052` |
| `wearable.v7-top-combat-knit` | top / top | 180 | `v7-top-combat-knit` | `cd04fa739a57bb53` |
| `wearable.v7-top-side-tunic` | top / top | 170 | `v7-top-side-tunic` | `0da1bc23e0cf0e13` |
| `wearable.v7-top-racer` | top / top | 135 | `v7-top-racer` | `8d2de75059191944` |
| `wearable.v7-top-kimono` | top / top | 190 | `v7-top-kimono` | `b62746713eadac43` |
| `wearable.v7-top-layered` | top / top | 150 | `v7-top-layered` | `c1cc77a505425193` |
| `wearable.v7-top-quilt-vest` | top / top | 160 | `v7-top-quilt-vest` | `8e52134f4a6da914` |
| `wearable.v7-top-funnel` | top / top | 185 | `v7-top-funnel` | `b11bd12e1109cdb9` |
| `wearable.v7-top-mechanic` | top / top | 155 | `v7-top-mechanic` | `c245a4d0222d9fdc` |
| `wearable.v7-top-cross-rig` | top / top | 175 | `v7-top-cross-rig` | `7ca9de6c2e070595` |
| `wearable.v7-outer-cape` | outer / outerwear | 230 | `v7-outer-cape` | `5fb99ee3128b1717` |
| `wearable.v7-outer-duster` | outer / outerwear | 250 | `v7-outer-duster` | `745f8bd1616b86c4` |
| `wearable.v7-outer-peacoat` | outer / outerwear | 240 | `v7-outer-peacoat` | `79f326767d922455` |
| `wearable.v7-outer-biker` | outer / outerwear | 265 | `v7-outer-biker` | `ceefa8e0d02c4bcd` |
| `wearable.v7-outer-poncho` | outer / outerwear | 220 | `v7-outer-poncho` | `544bcdbd875c3be4` |
| `wearable.v7-outer-fishtail` | outer / outerwear | 255 | `v7-outer-fishtail` | `415b4304da0fd7dd` |
| `wearable.v7-outer-officer` | outer / outerwear | 290 | `v7-outer-officer` | `48c140f0c38e11de` |
| `wearable.v7-outer-expedition` | outer / outerwear | 275 | `v7-outer-expedition` | `13ebc3f776fae5f5` |
| `wearable.v7-outer-long-vest` | outer / outerwear | 235 | `v7-outer-long-vest` | `3517cb0a10dbdd92` |
| `wearable.v7-outer-haori` | outer / outerwear | 280 | `v7-outer-haori` | `64f9977f284fb9c9` |
| `wearable.v7-starter-zip-polo` | top / top | 0 | `v7-starter-zip-polo` | `3a7e2f4d8dc263f4` |
| `wearable.v7-head-patrol` | head / headwear | 140 | `v7-head-patrol` | `280f8dba5dd355e4` |
| `wearable.v7-head-bucket` | head / headwear | 170 | `v7-head-bucket` | `0fed058341e848c5` |
| `wearable.v7-head-beret` | head / headwear | 190 | `v7-head-beret` | `92fd2b63dffa5e8f` |
| `wearable.v7-head-knit` | head / headwear | 155 | `v7-head-knit` | `093d7a1e82b10b09` |
| `wearable.v7-head-flight` | head / headwear | 340 | `v7-head-flight` | `9a77fd3d10dcc48d` |
| `wearable.v7-head-cylinder` | head / headwear | 280 | `v7-head-cylinder` | `581690bc3c0e51c9` |
| `wearable.v7-eye-round` | eyewear / eyewear | 120 | `v7-eye-round` | `848001a4bb726f14` |
| `wearable.v7-eye-rectangle` | eyewear / eyewear | 135 | `v7-eye-rectangle` | `54e2433133d1458e` |
| `wearable.v7-eye-hexagon` | eyewear / eyewear | 180 | `v7-eye-hexagon` | `047a788f13b6cb80` |
| `wearable.v7-eye-aviator` | eyewear / eyewear | 205 | `v7-eye-aviator` | `be12b0f1b5ff1bcb` |
| `wearable.v7-eye-cat` | eyewear / eyewear | 225 | `v7-eye-cat` | `61537db7c1aae2dd` |
| `wearable.v7-eye-brow` | eyewear / eyewear | 165 | `v7-eye-brow` | `74aaf808ae3f1184` |
| `wearable.v7-eye-shield` | eyewear / eyewear | 295 | `v7-eye-shield` | `69a8927753355387` |
| `wearable.v7-eye-asymmetric` | eyewear / eyewear | 310 | `v7-eye-asymmetric` | `7eb44e1f78dfbab2` |
| `wearable.v7-glove-fingerless` | gloves / gloves | 155 | `v7-glove-fingerless` | `850ddd64ec144008` |
| `wearable.v7-glove-gauntlet` | gloves / gloves | 360 | `v7-glove-gauntlet` | `42fb31e4528caf4e` |
| `wearable.v7-glove-laced` | gloves / gloves | 210 | `v7-glove-laced` | `0709f16184edb46f` |
| `wearable.v7-glove-console` | gloves / gloves | 325 | `v7-glove-console` | `13ba5edf9b01c365` |
| `wearable.v7-glove-mitten` | gloves / gloves | 175 | `v7-glove-mitten` | `7277b27b3f4ae60a` |
| `wearable.v7-back-sling` | back / back | 230 | `v7-back-sling` | `2e69d524f2d43648` |
| `wearable.v7-back-hardpack` | back / back | 390 | `v7-back-hardpack` | `7593fb3f7bf8cdb0` |
| `wearable.v7-back-canisters` | back / back | 440 | `v7-back-canisters` | `86cc2dcdc70e2ea9` |
| `wearable.v7-back-folded-fan` | back / back | 580 | `v7-back-folded-fan` | `0bb20391335f5603` |
| `wearable.v7-back-roll` | back / back | 305 | `v7-back-roll` | `1302d0b47079be09` |
| `wearable.v7-jewel-prism` | jewelry / jewelry | 180 | `v7-jewel-prism` | `61a012b41d941458` |
| `wearable.v7-jewel-tags` | jewelry / jewelry | 165 | `v7-jewel-tags` | `03fcc3b134e24b14` |
| `wearable.v7-jewel-crescent` | jewelry / jewelry | 275 | `v7-jewel-crescent` | `1d989f5e591cf61b` |
| `wearable.v7-jewel-orbit` | jewelry / jewelry | 350 | `v7-jewel-orbit` | `9e47fc77b35305b4` |
| `wearable.v7-jewel-ladder` | jewelry / jewelry | 285 | `v7-jewel-ladder` | `7adfe51c156296e8` |
| `wearable.v7-jewel-brooch` | jewelry / jewelry | 320 | `v7-jewel-brooch` | `d13b52fa3f1df077` |
| `wearable.v7-jewel-drop` | jewelry / jewelry | 145 | `v7-jewel-drop` | `8bd281ae92281ede` |
| `wearable.v7-jewel-helix` | jewelry / jewelry | 195 | `v7-jewel-helix` | `7b4c48581a9829f6` |
| `wearable.v7-jewel-tassel` | jewelry / jewelry | 245 | `v7-jewel-tassel` | `8a05e220a9c1c11b` |
| `wearable.v7-jewel-ear-bridge` | jewelry / jewelry | 260 | `v7-jewel-ear-bridge` | `cd91a77d57332354` |
| `wearable.v7-jewel-satellite` | jewelry / jewelry | 335 | `v7-jewel-satellite` | `d700dd5904063772` |
| `wearable.runner.jacket` | top / top | 0 | `runner-jacket` | `1ca1b618d14f2240` |
| `wearable.runner.pants` | bottom / bottom | 0 | `runner-pants` | `2d0bfadc61617bd6` |
| `wearable.runner.shoes` | shoe / shoes | 0 | `runner-shoes` | `6f3dab107516483d` |
| `wearable.corporate.top` | top / top | 0 | `corporate-top` | `1ca1b618d14f2240` |
| `wearable.corporate.pants` | bottom / bottom | 0 | `corporate-pants` | `2d0bfadc61617bd6` |
| `wearable.corporate.shoes` | shoe / shoes | 0 | `corporate-shoes` | `8fc483d5c3321ce8` |
| `wearable.technician.top` | top / top | 0 | `technician-top` | `094370975a8cfb2c` |
| `wearable.technician.pants` | bottom / bottom | 0 | `technician-pants` | `595ea7e63c3fe9e0` |
| `wearable.technician.shoes` | shoe / shoes | 0 | `technician-shoes` | `8fc483d5c3321ce8` |
| `wearable.daily.tee` | top / top | 0 | `daily-tee` | `bf3f30da43382d01` |
| `wearable.signal.turtleneck` | top / top | 0 | `signal-turtleneck` | `d1e8b571bdac99eb` |
| `wearable.utility.vest` | top / top | 0 | `utility-vest` | `df036eda38758835` |
| `wearable.wide-leg.pants` | bottom / bottom | 0 | `wide-leg-pants` | `36d6e4198d8ae11a` |
| `wearable.city.high-tops` | shoe / shoes | 0 | `city-high-tops` | `b56c7f6f763913b3` |
| `wearable.starter.pleated-pants` | bottom / bottom | 0 | `starter-pleated-pants` | `8fb53ac23e85bccb` |
| `wearable.starter.loafers` | shoe / shoes | 0 | `starter-loafers` | `5ebb1ef5657ed7bc` |
| `wearable.starter.cyber-coat` | outer / outerwear | 0 | `starter-cyber-coat` | `86d3c612ac1c8b38` |
| `wearable.starter.bomber` | outer / outerwear | 0 | `starter-bomber` | `5d326cad3355b6b4` |
| `wearable.starter.rain-shell` | outer / outerwear | 0 | `starter-rain-shell` | `3d7be2311d63eca0` |
| `wearable.starter.wrist-device` | accessory / accessory | 0 | `starter-wrist-device` | `60f98ace88b51a3c` |
| `wearable.starter.scarf` | accessory / accessory | 0 | `starter-scarf` | `4a5a15d2890abbbc` |
| `wearable.starter.holo-badge` | accessory / accessory | 0 | `starter-holo-badge` | `320071aebacceb58` |
| `wearable.starter.ear-cuff` | accessory / accessory | 0 | `starter-ear-cuff` | `78b87130052e742b` |
| `wearable.violet.coat` | top / top | 100 | `violet-coat` | `86d3c612ac1c8b38` |
| `wearable.amber.hoodie` | top / top | 80 | `amber-hoodie` | `094370975a8cfb2c` |
| `wearable.cyber.cargo` | bottom / bottom | 65 | `cargo-pants` | `595ea7e63c3fe9e0` |
| `wearable.neon.boots` | shoe / shoes | 75 | `neon-boots` | `8fc483d5c3321ce8` |
| `wearable.street.cap` | head / headwear | 45 | `street-cap` | `f9bcb21a7e4a12ec` |
| `wearable.holo.visor` | accessory / accessory | 90 | `holo-visor` | `c4e6d8ffcecb3801` |
| `wearable.ember.cropped-jacket` | top / top | 115 | `ember-cropped-jacket` | `b342d32a5d69b2ae` |
| `wearable.silk.shell` | top / top | 130 | `silk-shell` | `d3762bc9e599ba7f` |
| `wearable.mesh.overshirt` | top / top | 105 | `mesh-overshirt` | `c885e1acfe696d96` |
| `wearable.carbon.trench` | outer / outerwear | 175 | `carbon-trench` | `019b0079ed25d379` |
| `wearable.aurora.parka` | outer / outerwear | 160 | `aurora-parka` | `8cb344f6ad95b791` |
| `wearable.graphite.wide-leg` | bottom / bottom | 95 | `graphite-wide-leg` | `36d6e4198d8ae11a` |
| `wearable.silver.pleat` | bottom / bottom | 125 | `silver-pleat` | `8fb53ac23e85bccb` |
| `wearable.pulse.high-tops` | shoe / shoes | 120 | `pulse-high-tops` | `b56c7f6f763913b3` |
| `wearable.mono.loafers` | shoe / shoes | 110 | `mono-loafers` | `5ebb1ef5657ed7bc` |
| `wearable.halo.beanie` | head / headwear | 85 | `halo-beanie` | `c9b4e1ee2bcbf0d7` |
| `wearable.holo.scarf` | accessory / accessory | 100 | `holo-scarf` | `af945bbea3ce5683` |
| `wearable.tactical.gloves` | gloves / gloves | 70 | `tactical-gloves` | `d010a9990f1aa77f` |
| `wearable.neon.pack` | back / back | 140 | `neon-pack` | `2b211f1095cb3204` |
| `wearable.half-mask` | face / face | 135 | `half-mask` | `ccd6849d9dcc9910` |
| `wearable.chain-collar` | jewelry / jewelry | 60 | `chain-collar` | `dc0c5a7219daa82c` |

### furniture

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `furniture.cloud-bed` | bed | 220 | `cloud-bed` | `efa930f28bfeac11` |
| `furniture.platform-bed` | bed | 160 | `platform-bed` | `c94153abdb52bdbc` |
| `furniture.bunk-bed` | bed | 390 | `bunk-bed` | `a0eea19fa6a8594a` |
| `furniture.canopy-bed` | bed | 620 | `canopy-bed` | `e9761d7278cb551a` |
| `furniture.haven-sofa` | seating | 120 | `haven-sofa` | `d0b8539a6d709ef8` |
| `furniture.corner-sofa` | seating | 280 | `corner-sofa` | `da76516c56c0d5f5` |
| `furniture.chaise-lounge` | seating | 175 | `chaise-lounge` | `425b900726c24674` |
| `furniture.workstation` | desk | 180 | `workstation` | `c8b95cef701b7fd4` |
| `furniture.writing-desk` | desk | 110 | `writing-desk` | `dde70e63ac245eb8` |
| `furniture.standing-desk` | desk | 260 | `standing-desk` | `08b8cdddab6e1f63` |
| `furniture.architect-desk` | desk | 310 | `architect-desk` | `4a3c9ef2c043088b` |
| `furniture.dining-chair` | chair | 45 | `dining-chair` | `b5c1270ff9781e2f` |
| `furniture.office-chair` | chair | 130 | `office-chair` | `c52151dbf47bd747` |
| `furniture.bar-stool` | chair | 75 | `bar-stool` | `40c84f1c935f2b04` |
| `furniture.bookcase` | storage | 155 | `bookcase` | `71985e89eadfedcc` |
| `furniture.wardrobe` | storage | 230 | `wardrobe` | `b2ceaf86a764f686` |
| `furniture.drawer-chest` | storage | 145 | `drawer-chest` | `7ff012c8afee4c71` |
| `furniture.flat-tv` | electronics | 290 | `flat-tv` | `6bb743e4f73ec6eb` |
| `furniture.arcade-cabinet` | electronics | 340 | `arcade-cabinet` | `aeb4f94b04e47a4f` |
| `furniture.stereo-tower` | electronics | 190 | `stereo-tower` | `5355a987bec9a139` |
| `furniture.neon-floor-lamp` | lights | 65 | `neon-floor-lamp` | `d61af6fcf31063f4` |
| `furniture.tripod-lamp` | lights | 95 | `tripod-lamp` | `0b6b55d8441194e0` |
| `furniture.table-lamp` | lights | 35 | `table-lamp` | `16d3241bc4d2fac6` |
| `furniture.kitchen-island` | kitchen | 210 | `kitchen-island` | `5dc0cb88b9eeab7b` |
| `furniture.refrigerator` | kitchen | 250 | `refrigerator` | `94233330f2ab4f6c` |
| `furniture.range-cooker` | kitchen | 240 | `range-cooker` | `136598d3e3e6401c` |
| `furniture.biolume-plant` | decor | 45 | `biolume-plant` | `dc5380cf63e44499` |
| `furniture.wall-mirror` | decor | 85 | `wall-mirror` | `210742413bc61543` |
| `furniture.aquarium` | decor | 180 | `aquarium` | `415c5e5e566dddad` |
| `furniture.tool-bench` | workshop | 200 | `tool-bench` | `45fab0fb0c268784` |
| `furniture.3d-printer` | workshop | 320 | `3d-printer` | `79e9794525705d3c` |
| `furniture.tool-trolley` | workshop | 140 | `tool-trolley` | `5767acea0ad8ccd1` |
| `furniture.holo-art` | collectible | 95 | `holo-art` | `89f1b7797970203b` |
| `furniture.trophy-cup` | collectible | 170 | `trophy-cup` | `4e5588282ead5777` |
| `furniture.model-rocket` | collectible | 185 | `model-rocket` | `52ba0601708ef575` |
| `furniture.crystal-display` | collectible | 230 | `crystal-display` | `29756854652c422d` |
| `furniture.v7-sleigh-bed` | bed | 360 | `v7-sleigh-bed` | `d6b86f3df2f683fa` |
| `furniture.v7-capsule-bed` | bed | 580 | `v7-capsule-bed` | `212814848ceeb9c9` |
| `furniture.v7-study-loft-bed` | bed | 490 | `v7-study-loft-bed` | `d1a5c44a039a0f3e` |
| `furniture.v7-trundle-bed` | bed | 330 | `v7-trundle-bed` | `657348b3c44b96b7` |
| `furniture.v7-nest-bed` | bed | 610 | `v7-nest-bed` | `50e7e9163131dbc3` |
| `furniture.v7-library-bed` | bed | 430 | `v7-library-bed` | `04421cca6a9fea5b` |
| `furniture.v7-papasan-seat` | seating | 145 | `v7-papasan-seat` | `f229271df6e82064` |
| `furniture.v7-beanbag-seat` | seating | 85 | `v7-beanbag-seat` | `19418bbbb908cbc9` |
| `furniture.v7-rocker-lounge` | seating | 195 | `v7-rocker-lounge` | `a2574306466d8c1b` |
| `furniture.v7-conversation-seat` | seating | 285 | `v7-conversation-seat` | `4dd20d6b9317f625` |
| `furniture.v7-courtyard-sofa` | seating | 540 | `v7-courtyard-sofa` | `107f4245973cd232` |
| `furniture.v7-woven-daybed` | seating | 240 | `v7-woven-daybed` | `4d2ada64f8acb46a` |
| `furniture.v7-cinema-recliner` | seating | 290 | `v7-cinema-recliner` | `18a8f1f95070945a` |
| `furniture.v7-storage-bench` | seating | 155 | `v7-storage-bench` | `5fedfcc6fba41869` |
| `furniture.v7-island-settee` | seating | 470 | `v7-island-settee` | `b9d5684ea54843a8` |
| `furniture.v7-secretary-desk` | desk | 270 | `v7-secretary-desk` | `e1e3aa266a3d5828` |
| `furniture.v7-corner-desk` | desk | 260 | `v7-corner-desk` | `79cac4cbbf7212b9` |
| `furniture.v7-ladder-desk` | desk | 230 | `v7-ladder-desk` | `5967e5b918fb855b` |
| `furniture.v7-easel-desk` | desk | 275 | `v7-easel-desk` | `d0bd838382ecc451` |
| `furniture.v7-library-desk` | desk | 340 | `v7-library-desk` | `c9583939601c6c58` |
| `furniture.v7-music-desk` | desk | 480 | `v7-music-desk` | `c340ee4cbf7f795b` |
| `furniture.v7-cantilever-chair` | chair | 95 | `v7-cantilever-chair` | `ac0e54bb21e0e752` |
| `furniture.v7-folding-chair` | chair | 65 | `v7-folding-chair` | `abe6065c7f906b9b` |
| `furniture.v7-kneeling-chair` | chair | 120 | `v7-kneeling-chair` | `e3817cc68957b059` |
| `furniture.v7-tripod-shell-chair` | chair | 130 | `v7-tripod-shell-chair` | `93f4c74ebdf84431` |
| `furniture.v7-wingback-chair` | chair | 185 | `v7-wingback-chair` | `c2dbae50086c97f8` |
| `furniture.v7-ladder-shelf` | storage | 180 | `v7-ladder-shelf` | `ff3fa39030c1c9f5` |
| `furniture.v7-shoe-cubby` | storage | 165 | `v7-shoe-cubby` | `48d0a44186c9d87e` |
| `furniture.v7-parcel-locker` | storage | 340 | `v7-parcel-locker` | `f23764c143e6096d` |
| `furniture.v7-apothecary` | storage | 290 | `v7-apothecary` | `fc297059b8100fad` |
| `furniture.v7-record-rack` | storage | 220 | `v7-record-rack` | `1a8acabb99c7d2de` |
| `furniture.v7-stepped-shelf` | storage | 240 | `v7-stepped-shelf` | `d35eed241ceb55a5` |
| `furniture.v7-coat-valet` | storage | 135 | `v7-coat-valet` | `1753fe304daf565b` |
| `furniture.v7-desktop-tower` | electronics | 380 | `v7-desktop-tower` | `aa6a8dd953f58096` |
| `furniture.v7-projector-pedestal` | electronics | 360 | `v7-projector-pedestal` | `bd00c905d5faaa16` |
| `furniture.v7-turntable-console` | electronics | 310 | `v7-turntable-console` | `d7493d4bf4717eb0` |
| `furniture.v7-scanner-printer` | electronics | 270 | `v7-scanner-printer` | `25f00b4a4baa4095` |
| `furniture.v7-robot-dock` | electronics | 330 | `v7-robot-dock` | `6c10565389adc960` |
| `furniture.v7-air-purifier` | electronics | 230 | `v7-air-purifier` | `756bb9924db3aa03` |
| `furniture.v7-reel-recorder` | electronics | 320 | `v7-reel-recorder` | `f10cc25c2ff82c10` |
| `furniture.v7-info-terminal` | electronics | 410 | `v7-info-terminal` | `5cf1d3743110f326` |
| `furniture.v7-synthesizer` | electronics | 390 | `v7-synthesizer` | `da32c76fa223bf45` |
| `furniture.v7-paper-lantern` | lights | 85 | `v7-paper-lantern` | `2f2d8ec1ff0897cc` |
| `furniture.v7-cantilever-lamp` | lights | 155 | `v7-cantilever-lamp` | `6a1b9acc5008b181` |
| `furniture.v7-shoji-light` | lights | 195 | `v7-shoji-light` | `902775bd443a27e2` |
| `furniture.v7-uplight-bowl` | lights | 145 | `v7-uplight-bowl` | `71d0e0cf18db8c0c` |
| `furniture.v7-twin-globe` | lights | 175 | `v7-twin-globe` | `2bb6f63a0f6cc8f9` |
| `furniture.v7-task-arm` | lights | 95 | `v7-task-arm` | `7063d2d60f68d98a` |
| `furniture.v7-reading-column` | lights | 140 | `v7-reading-column` | `21aebd725f5cab33` |
| `furniture.v7-candle-cluster` | lights | 75 | `v7-candle-cluster` | `1693386eab60b94d` |
| `furniture.v7-louver-bollard` | lights | 110 | `v7-louver-bollard` | `504b5609d5c020b1` |
| `furniture.v7-drill-press` | workshop | 380 | `v7-drill-press` | `99dbdd34e17eb506` |
| `furniture.v7-wood-lathe` | workshop | 450 | `v7-wood-lathe` | `d7da6f609db26ca5` |
| `furniture.v7-pottery-wheel` | workshop | 250 | `v7-pottery-wheel` | `0ae5c6dac71456ba` |
| `furniture.v7-weaving-loom` | workshop | 330 | `v7-weaving-loom` | `e9bbd7abfce39180` |
| `furniture.v7-sewing-station` | workshop | 310 | `v7-sewing-station` | `75082335bc238ee5` |
| `furniture.v7-blacksmith-anvil` | workshop | 280 | `v7-blacksmith-anvil` | `58dc63399b7239d7` |
| `furniture.v7-jeweler-mill` | workshop | 520 | `v7-jeweler-mill` | `5fd2b3f7f8377f4e` |
| `furniture.v7-sailing-ship` | collectible | 340 | `v7-sailing-ship` | `bff9476a157a1253` |
| `furniture.v7-gramophone` | collectible | 360 | `v7-gramophone` | `fe4571e99e4ad67c` |
| `furniture.v7-meteorite-mount` | collectible | 540 | `v7-meteorite-mount` | `bdb090d240ce26ae` |
| `furniture.v7-skyline-maquette` | collectible | 420 | `v7-skyline-maquette` | `458b08760bd31a0a` |
| `furniture.v7-armored-bust` | collectible | 480 | `v7-armored-bust` | `f31787cd332c4e0a` |
| `furniture.v7-armillary-globe` | collectible | 390 | `v7-armillary-globe` | `8991a2207d2a3ca4` |
| `furniture.v7-espresso-machine` | kitchen | 210 | `v7-espresso-machine` | `2ebd5de1bd13958c` |
| `furniture.v7-stand-mixer` | kitchen | 165 | `v7-stand-mixer` | `c6751bc4d152c82c` |
| `furniture.v7-tea-tray` | kitchen | 70 | `v7-tea-tray` | `a3fc3e8ee313ac0b` |
| `furniture.v7-dish-rack` | kitchen | 65 | `v7-dish-rack` | `bd56e35abf315db7` |
| `furniture.v7-dining-table` | kitchen | 195 | `v7-dining-table` | `caaaf26a19082687` |
| `furniture.v7-breakfast-trolley` | kitchen | 135 | `v7-breakfast-trolley` | `8e4425494acfd5a1` |
| `furniture.v7-extractor-hood` | kitchen | 180 | `v7-extractor-hood` | `e593f48de82d0e1d` |
| `furniture.v7-folding-screen` | decor | 155 | `v7-folding-screen` | `2c15caff0c92d51a` |
| `furniture.v7-pendulum-clock` | decor | 140 | `v7-pendulum-clock` | `f3ea4df84091e55f` |
| `furniture.v7-coat-tree` | decor | 75 | `v7-coat-tree` | `6be4964a59085a77` |
| `furniture.v7-tassel-rug` | decor | 55 | `v7-tassel-rug` | `d3986a846dfc13ba` |
| `furniture.v7-bonsai-tray` | decor | 120 | `v7-bonsai-tray` | `4668d8f0cc3535e3` |
| `furniture.v7-art-easel` | decor | 85 | `v7-art-easel` | `196fc4791b4a3f68` |
| `furniture.v7-vase-cluster` | decor | 90 | `v7-vase-cluster` | `5a261302c721038b` |
| `furniture.v7-globe-stand` | decor | 115 | `v7-globe-stand` | `1780b0c98f7e8911` |
| `furniture.v7-umbrella-stand` | decor | 55 | `v7-umbrella-stand` | `c8eb75163222a854` |
| `furniture.v7-shoe-rack` | decor | 65 | `v7-shoe-rack` | `160d873d0780b0e8` |
| `furniture.v7-textile-rail` | decor | 95 | `v7-textile-rail` | `990b529730b33f98` |
| `furniture.v7-zen-garden` | decor | 60 | `v7-zen-garden` | `24403aa9bb197b5c` |
| `furniture.v7-magazine-sling` | decor | 50 | `v7-magazine-sling` | `344278f541be6e3f` |

### weapon

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `equipment.starter-blade` | tactical / weapon | 0 | `starter-blade` | `61ef20133f03a6c0` |
| `equipment.breach-tanto` | tactical / weapon | 185 | `breach-tanto` | `8113917c0871f183` |
| `equipment.rescue-hook` | tactical / weapon | 300 | `rescue-hook` | `39e79cfc571b2706` |
| `equipment.sawback-machete` | tactical / weapon | 415 | `sawback-machete` | `5c68c3befdb52d5e` |
| `equipment.trench-punch` | tactical / weapon | 530 | `trench-punch` | `c327e0a7f2addde0` |
| `equipment.field-kukri` | tactical / weapon | 645 | `field-kukri` | `576253d0a3617a44` |
| `equipment.cyber-katana` | katana / weapon | 180 | `cyber-katana` | `e7a11e60d2e5ce08` |
| `equipment.moon-nodachi` | katana / weapon | 185 | `moon-nodachi` | `c479fe06e347ed3a` |
| `equipment.storm-wakizashi` | katana / weapon | 300 | `storm-wakizashi` | `2d09de1d4c1eb322` |
| `equipment.split-tsuba` | katana / weapon | 415 | `split-tsuba` | `9cb81ee6880f35b1` |
| `equipment.reed-shikomizue` | katana / weapon | 530 | `reed-shikomizue` | `96d5b953b11db565` |
| `equipment.serpent-odachi` | katana / weapon | 645 | `serpent-odachi` | `5ba417ee809af3ee` |
| `equipment.plasma-sword` | energy / weapon | 450 | `plasma-sword` | `5caaa69b2f3ef524` |
| `equipment.arc-fork` | energy / weapon | 185 | `arc-fork` | `52edfb6e62167229` |
| `equipment.ion-saber` | energy / weapon | 300 | `ion-saber` | `51dddecf1b9798fb` |
| `equipment.photon-halo` | energy / weapon | 415 | `photon-halo` | `9e80231221f3bc35` |
| `equipment.flux-cleaver` | energy / weapon | 530 | `flux-cleaver` | `e28251404da30263` |
| `equipment.tesla-lance` | energy / weapon | 645 | `tesla-lance` | `c1f7da8465f82b6d` |
| `equipment.atlas-hammer` | heavy / weapon | 70 | `atlas-hammer` | `466efe4384e44b7c` |
| `equipment.siege-axe` | heavy / weapon | 185 | `siege-axe` | `4c10e59c9b424308` |
| `equipment.rail-maul` | heavy / weapon | 300 | `rail-maul` | `d0d4da73ddba7349` |
| `equipment.grav-greatsword` | heavy / weapon | 415 | `grav-greatsword` | `ad5551eb335567d1` |
| `equipment.impact-mace` | heavy / weapon | 530 | `impact-mace` | `6655ddf8e704a6a3` |
| `equipment.breaker-pick` | heavy / weapon | 645 | `breaker-pick` | `fcd7ea2759147dff` |
| `equipment.twin-stingers` | dual / weapon | 70 | `twin-stingers` | `6b1597a27ae3d982` |
| `equipment.mirror-sai` | dual / weapon | 185 | `mirror-sai` | `148bc6fef2f11fd5` |
| `equipment.volt-tonfas` | dual / weapon | 300 | `volt-tonfas` | `53a6944ff3c33f16` |
| `equipment.harvest-kamas` | dual / weapon | 415 | `harvest-kamas` | `b38bf3344961f022` |
| `equipment.quantum-edge` | relic / weapon | 1200 | `quantum-edge` | `d3946d80d403bf60` |
| `equipment.sun-scepter` | relic / weapon | 185 | `sun-scepter` | `d9de169df6620abc` |
| `equipment.crescent-scythe` | relic / weapon | 300 | `crescent-scythe` | `ce4bd8a2f1b60161` |
| `equipment.oracle-trident` | relic / weapon | 415 | `oracle-trident` | `8166846b4786ed46` |
| `equipment.void-key` | relic / weapon | 530 | `void-key` | `17c87e843d3de23c` |
| `equipment.runic-fan` | relic / weapon | 645 | `runic-fan` | `b732567facdc40a7` |
| `equipment.meteor-flail` | relic / weapon | 760 | `meteor-flail` | `a1824436c0b491de` |
| `equipment.aether-glaive` | relic / weapon | 875 | `aether-glaive` | `7e8424094c8fbd97` |

### armor

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `equipment.neural-visor` | armor / head | 90 | `neural-visor` | `822afd14ae4b3b45` |
| `equipment.bastion-helm` | armor / head | 185 | `bastion-helm` | `5820cf841f0fb2c3` |
| `equipment.signal-crown` | armor / head | 300 | `signal-crown` | `ca59be7792a94774` |
| `equipment.recon-monocle` | armor / head | 415 | `recon-monocle` | `e738dee2109ce71c` |
| `equipment.warden-mask` | armor / head | 530 | `warden-mask` | `7ae4ca335169e198` |
| `equipment.aerial-headset` | armor / head | 645 | `aerial-headset` | `9450f6e84302d86c` |
| `equipment.sentry-cap` | armor / head | 760 | `sentry-cap` | `7e126b3bbf5ed20c` |
| `equipment.prism-circlet` | armor / head | 875 | `prism-circlet` | `97eebf3698a78a54` |
| `equipment.aegis-jacket` | armor / chest | 160 | `aegis-jacket` | `c7c2a3001ba93f26` |
| `equipment.bastion-cuirass` | armor / chest | 185 | `bastion-cuirass` | `0a00fd17257ccfae` |
| `equipment.scout-harness` | armor / chest | 300 | `scout-harness` | `be18ce309adbfb11` |
| `equipment.reactor-vest` | armor / chest | 415 | `reactor-vest` | `e15c0b20648f89bf` |
| `equipment.lamellar-shell` | armor / chest | 530 | `lamellar-shell` | `4cd7ebad6d455e43` |
| `equipment.sentinel-mantle` | armor / chest | 645 | `sentinel-mantle` | `bb9932fca9a9ed97` |
| `equipment.ranger-bandolier` | armor / chest | 760 | `ranger-bandolier` | `33cc7bc3a6b122e6` |
| `equipment.carapace-vest` | armor / chest | 875 | `carapace-vest` | `c63c449a43fc9740` |
| `equipment.pulse-gloves` | armor / gloves | 80 | `pulse-gloves` | `d3a7bae5f1c20554` |
| `equipment.bastion-gauntlets` | armor / gloves | 185 | `bastion-gauntlets` | `c09a7ebcfd1e47c2` |
| `equipment.arc-bracers` | armor / gloves | 300 | `arc-bracers` | `37229ac831883f7e` |
| `equipment.climber-grips` | armor / gloves | 415 | `climber-grips` | `d2a4d69e961e51e4` |
| `equipment.duelist-vambraces` | armor / gloves | 530 | `duelist-vambraces` | `2b491fb58788f0d9` |
| `equipment.medic-cuffs` | armor / gloves | 645 | `medic-cuffs` | `ce5db28ac7928db4` |
| `equipment.talon-guards` | armor / gloves | 760 | `talon-guards` | `2a2ab24a306f2ed6` |
| `equipment.drift-boots` | armor / boots | 85 | `drift-boots` | `e86f6c875dff4e87` |
| `equipment.bastion-greaves` | armor / boots | 185 | `bastion-greaves` | `01331ff80ca647b8` |
| `equipment.vector-skates` | armor / boots | 300 | `vector-skates` | `70109255cddfce85` |
| `equipment.mag-lock-boots` | armor / boots | 415 | `mag-lock-boots` | `6537af200265ba0b` |
| `equipment.trail-sabatons` | armor / boots | 530 | `trail-sabatons` | `e500621055fdaad3` |
| `equipment.spring-striders` | armor / boots | 645 | `spring-striders` | `89a51b329ba1eee6` |
| `equipment.ridge-gaiters` | armor / boots | 760 | `ridge-gaiters` | `3aac04d02657de62` |

### equipment-accessory

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `equipment.focus-chip` | accessory / accessory1 | 140 | `focus-chip` | `ff53b8b05db145b1` |
| `equipment.relay-brooch` | accessory / accessory1 | 185 | `relay-brooch` | `8eccfcf0741d8741` |
| `equipment.cipher-locket` | accessory / accessory1 | 300 | `cipher-locket` | `edbeb22108bbbfe3` |
| `equipment.memory-ring` | accessory / accessory2 | 280 | `memory-ring` | `644fabcab1ae5250` |
| `equipment.chronometer` | accessory / accessory2 | 185 | `chronometer` | `aa8ff063e055b11f` |
| `equipment.dawn-relic` | accessory / relic | 1800 | `dawn-relic` | `a193ddf964018cce` |
| `equipment.orbit-talisman` | accessory / relic | 185 | `orbit-talisman` | `f59ba3df54df812e` |
| `equipment.guardian-sigil` | accessory / relic | 300 | `guardian-sigil` | `aadd1340e9bbaa88` |

### material

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `construction.floor-concrete` | floor | 10 | `floor-concrete` | — |
| `construction.floor-wood` | floor | 18 | `floor-wood` | — |
| `construction.floor-ceramic` | floor | 22 | `floor-ceramic` | — |
| `construction.floor-metal` | floor | 25 | `floor-metal` | — |
| `construction.floor-marble` | floor | 40 | `floor-marble` | — |
| `construction.floor-glass` | floor | 55 | `floor-glass` | — |
| `construction.floor-luxury` | floor | 70 | `floor-luxury` | — |
| `construction.wall-basic` | wall | 20 | `wall-basic` | — |
| `construction.wall-metal` | wall | 35 | `wall-metal` | — |
| `construction.wall-neon` | wall | 55 | `wall-neon` | — |
| `construction.ceiling-basic` | ceiling | 8 | `ceiling-basic` | — |
| `construction.roof-flat` | roof | 12 | `roof-flat` | — |
| `construction.roof-terrace` | roof | 25 | `roof-terrace` | — |

### door

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `construction.door-standard` | door | 100 | `door-standard` | `7ef370520aeb9f24` |
| `construction.door-sliding` | door | 130 | `door-sliding` | `76ece8c91ffd2eed` |
| `construction.door-glass` | door | 150 | `door-glass` | `94d55ebb6a7388c4` |
| `construction.door-auto` | door | 190 | `door-auto` | `c531e021f2b4ed04` |
| `construction.door-security` | door | 220 | `door-security` | `db771c7a52125214` |
| `construction.door-neon` | door | 280 | `door-neon` | `051f5ecda2a3d9c4` |
| `construction.door-louver` | door | 145 | `door-louver` | `0949fc37e42a5be6` |
| `construction.door-craftsman` | door | 175 | `door-craftsman` | `5ba77f9789b7d228` |

### straight-glass

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `construction.window-small` | window | 80 | `window-small` | `9fdb1c5bc144d8b3` |
| `construction.window-wide` | window | 110 | `window-wide` | `b6115049a1cccbf9` |
| `construction.window-panoramic` | window | 140 | `window-panoramic` | `49a18fe6f9f7a7d9` |
| `construction.window-full` | window | 170 | `window-full` | `4c6f36fb40fe7849` |
| `construction.window-tinted` | window | 190 | `window-tinted` | `694b6ea1623373b7` |
| `construction.window-holo` | window | 240 | `window-holo` | `f101614482623f15` |

### construction

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `construction.stairs-basic` | stairs | 240 | `stairs-basic` | — |

### curved-glass

| Registry ID | Category / slot | Price | Source ID | Structural signature digest |
| --- | --- | --- | --- | --- |
| `construction.curve-bay` | curve | 260 | `curve-bay` | `867da1ed7150fa2c` |
| `construction.curve-corner` | curve | 220 | `curve-corner` | `7dfabffb26b19cdd` |
| `construction.curve-panorama` | curve | 460 | `curve-panorama` | `e1f26a230c574c99` |
| `construction.curve-alcove` | curve | 380 | `curve-alcove` | `81afc0960fa3e916` |
| `construction.curve-divider` | curve | 180 | `curve-divider` | `11b3ee7a8698d107` |
| `construction.curve-bow` | curve | 520 | `curve-bow` | `bdfcac2a3bf90a48` |

## Historical exact source hash snapshot — 08:01 UTC

The following hashes identify the bytes actually loaded for this measurement, bounded source assertions and module inspection. They are documentary hashes, **not inserted asset evidence bindings**. A source change invalidates the corresponding measurements and requires remeasurement.

| Measured input | SHA-256 |
| --- | --- |
| [src/assets/registry.ts](<../src/assets/registry.ts>) | `ecfd5497517fc64f35181e7faca81649654a1fbcb1117dc6630262c9d4583457` |
| [src/character/catalog.ts](<../src/character/catalog.ts>) | `284e86c6fd395515fedd0b0521fc685eae35b92bd2ac94979f7c0111159d2bb7` |
| [src/character/fashion-lower-v7.ts](<../src/character/fashion-lower-v7.ts>) | `1908f2b33b9108568e842bd9e07c7099971cd2da1fbcc7014c16bf73f5c600ad` |
| [src/character/fashion-upper-v7.ts](<../src/character/fashion-upper-v7.ts>) | `8b41c723f1eb083cb5457e6205d80db86ce5a859c13ba8c3b8691e714e49c3d8` |
| [src/character/starter-polo-v7.ts](<../src/character/starter-polo-v7.ts>) | `b971b4819d0a6f44487683e98c2619f9aa40266d24cbfe5d53f46db7d9f78f96` |
| [src/character/fashion-accessory-v7.ts](<../src/character/fashion-accessory-v7.ts>) | `5680e4e03bca706c78e3d377c36955434f749595ba0cd6ed3f8807375e78476c` |
| [src/components/world/wearable-shapes.ts](<../src/components/world/wearable-shapes.ts>) | `428dde352f8f81b3a68c8c4c70dbde83a4a285782ea96ef3eabf2b1194ddcbd5` |
| [src/construction/catalog.ts](<../src/construction/catalog.ts>) | `ce70d9af2ff0ac4e9af45bdc8515fa670223998361865e78ed210c2d7be7cfac` |
| [src/components/construction/door-models.tsx](<../src/components/construction/door-models.tsx>) | `184216dc110201723d65fe57e1104cb7974ddee5c9258be430bda43a63070d8d` |
| [src/furniture/catalog.ts](<../src/furniture/catalog.ts>) | `57fd0b954426120bf2e9d82dc51e67084196452960a5260e6c99e2c3cbcec783` |
| [src/furniture/collection-living-v7.ts](<../src/furniture/collection-living-v7.ts>) | `9505c9e47f7845eba267e0a5aef8d4f85418ea958767e6af9f1025eff673e072` |
| [src/furniture/collection-tech-v7.ts](<../src/furniture/collection-tech-v7.ts>) | `19494e2ea87ce5882bb5c945b3caae276767e224c5a1c81b5dbdca17734a9142` |
| [src/furniture/collection-craft-v7.ts](<../src/furniture/collection-craft-v7.ts>) | `da850f1b3bad7700423aa25e90ce9357c4ea578120adc01668a48494f3ddc308` |
| [src/furniture/collection-home-v7.ts](<../src/furniture/collection-home-v7.ts>) | `5d9d75151df43287322c1175852cc56590850c64e6ec6692de83d1c48dc9560c` |
| [src/equipment/catalog.ts](<../src/equipment/catalog.ts>) | `ff66b3a18868957b9a0224089ae20c812b058c898159b384e4a4845c18a2be11` |
| [src/assets/coverage.ts](<../src/assets/coverage.ts>) | `8debc1af3c857aece49f6d4c8dda719cab05c29babb835b909bf6b6ef23f98f3` |
| [src/assets/types.ts](<../src/assets/types.ts>) | `d3909043a74454ceb58bbee1d0d7050575ee5e4ef3d13ac2ec40daec52d327c9` |
| [tests/assets/registry.test.ts](<../tests/assets/registry.test.ts>) | `16ef14dfefffc4193702579f2dd2623ba18cc4f3462a46af9a3ea44810085947` |
| [tests/assets/verification.test.ts](<../tests/assets/verification.test.ts>) | `0f2d8cbc617ea6182d6e6f29dd8cb41a30e8a4b18ab719fddb9940cd676d3007` |

The following additional curve implementation hashes identify historical08:01 bytes, not inputs loaded by the registry harness and not cryptographic bindings of the archived browser run. Curve frame/material changes are outside the registry's radius/angle/thickness/height signature.

| Additional current source | SHA-256 |
| --- | --- |
| [src/construction/curves.ts](<../src/construction/curves.ts>) | `c3f3d15f3626f24efd0f837a8f348ae055f401b164ff370131071e62f69dde15` |
| [src/components/construction/curve-material.ts](<../src/components/construction/curve-material.ts>) | `f233b942829344ddee8ef7b6ab6045465bc5bab56961e49796afa8c211cae7d8` |
| [src/components/construction/ConstructionWorld.tsx](<../src/components/construction/ConstructionWorld.tsx>) | `08ce7d472fa2e6612d7e3f2ff2e21ff52218d0e940eb8d1e97859f80f8a6559f` |

Complete measured records/signatures: [registry-records.json](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-final-frozen/registry-records.json>). Machine-readable metrics/test invocations: [measurement.json](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-final-frozen/measurement.json>). Complete broad manifest: [source-after.json](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-final-frozen/source-after.json>). These external paths are local evidence references, not bundled distributable game assets.

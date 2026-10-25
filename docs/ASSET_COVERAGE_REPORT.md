# Asset coverage report — current source, bounded evidence

**Overall status: INCOMPLETE. All 349 registry entries remain INTEGRATING; zero VERIFIED.** Numeric catalog coverage and source tests do not authorize an acceptance promotion.

## Current bounded measurement — 1627

Direct Node exit0 measured **2026-10-16T14:36:44.301Z–2026-10-16T14:36:46.289Z** on Node v24.22.0 / installed TypeScript5.9.3. Counts remain **349 entries /335 geometry-bearing /324 unique structural signatures /0 VERIFIED**; all349 INTEGRATING. **26/26 synchronous assert-shim cases passed** (15 registry,11 verification), not the Vitest runner or full tests/typecheck/build/GPU. No product or registry evidence was changed.

New external [measurement](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/measurement.json>) and [records](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-postfix-1543/registry-records.json>) preserve the historical directory. Copied harness SHA-256 `5bc6cd8ae74acf12ee08329ca3353339f4f4f272a081a7fb50553a2cd724cbe0` is byte-identical. Pre/post226-file manifests both hash to `6f3ca6a6c890770db5e0ac1de52157ff02dbb914a662fb9411500a28c975739f`; no source or test drift was observed during that interval, not a continuing freeze.

Only one of19 loaded-input hashes changed versus08:01: [wearable-shapes.ts](<../src/components/world/wearable-shapes.ts>) `428dde352f8f81b3a68c8c4c70dbde83a4a285782ea96ef3eabf2b1194ddcbd5` → `6de16a30cfcad63bd2ad304e3a672b71d4bcf921251298c8adeb4cde848fc384`. Other18 loaded hashes, including both assertion files, match; current full input hashes are in the new measurement. Hair/lamp renderer files are snapshot-covered but not loaded registry-signature inputs. Renderer changes can invalidate runtime evidence while leaving these counts unchanged: this inventory cannot certify the renderer dependency closure, visual quality or per-asset acceptance.

Product static/build checkpoint1543 remains separate and current per [TEST_REPORT](<TEST_REPORT.md>); no new full suite/build was run for1627.

## Historical measured snapshot — 08:01 UTC

The following measurement and crown/terminal checkpoints are retained history. Aggregate tables were reconfirmed by1627; historical artifact/hash references are not overwritten.

Measured 2026-10-16T08:01:01.005Z–2026-10-16T08:01:03.156Z; loaded-input publication check 2026-10-16T08:02:29.049Z. Runtime: Node v24.22.0, existing TypeScript 5.9.3. Pre/post comparison covered 217 files under source/tests plus present package manifests, lockfiles and TypeScript configuration. Both manifest digests: `e28c8c679d910577e20383d74347c40db5a5c7696d6b1b23829e96a71cda21d2` (SHA-256 of compact JSON array of path/hash pairs). The bounded measurement was stable; this is observed equality, **not an enforced write lock**. All 19 loaded measured inputs still matched at the publication check. This does not freeze the whole workspace or establish full-suite/build acceptance.

No product source, dependency, lockfile or runtime evidence was changed for this refresh. Only the bounded in-memory source measurement and its synchronous asset assertions were rerun; no install, build, typecheck, browser, GPU or heavy test run was performed. **Later Lead checkpoints on the crown + terminal source:1230 full Vitest3,868/3,868 PASS across80 files in250.60s;1215 global TypeScript/full ESLint PASS;1228 scoped test-only lint PASS;1223 Next16.4.1 production build PASS (compile5.3s/TypeScript9.3s). These are separate from this source measurement, not asset acceptance.**

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

Detailed registry IDs, duplicate groups, geometry methodology and all loaded source hashes are in [ASSET_CATALOG.md](<ASSET_CATALOG.md>). All 349 IDs are unique in this snapshot. No asset's status or evidence was modified.

## Target authority and units

The owner's V7 request specifies **120 furniture items**, with category targets totaling 120. Those requirements are represented in [src/assets/coverage.ts](<../src/assets/coverage.ts>) and `FURNITURE_MODEL_TARGET` in [src/furniture/catalog.ts](<../src/furniture/catalog.ts>); they are not numeric quotations from the reference PDF. The implemented **121** count belongs to cosmetics, not furniture. There is no unresolved 120/121 furniture target discrepancy, and stairs, finishes or recolors must not be counted as additional furniture.

Coverage rows measure **entries**, except material-finish definitions; unique structural signatures are shown independently. Parent and category rows overlap and must not be summed as independent inventory. Meeting an entry target alone leaves status INCOMPLETE when required runtime verification is absent. Runtime deficit means target minus eligible verified entries, not simply missing files. No independent equipment-accessory target exists in this coverage API.

## Per-category targets and unmet statuses

| Coverage row | Target | Entries | Unique signatures | Entry deficit | Runtime verified | Runtime deficit | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cosmetic.paid | 94 | 97 | 97 | 0 | 0 | 94 | INCOMPLETE |
| cosmetic.paid.top | 18 | 18 | 18 | 0 | 0 | 18 | INCOMPLETE |
| cosmetic.paid.bottom | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| cosmetic.paid.outer | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| cosmetic.paid.shoe | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| cosmetic.paid.head | 8 | 8 | 8 | 0 | 0 | 8 | INCOMPLETE |
| cosmetic.paid.eyewear | 8 | 8 | 8 | 0 | 0 | 8 | INCOMPLETE |
| cosmetic.paid.gloves | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| cosmetic.paid.back | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| cosmetic.paid.jewelry | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| cosmetic.starter | 21 | 24 | 21 | 0 | 0 | 21 | INCOMPLETE |
| furniture | 120 | 120 | 120 | 0 | 0 | 120 | INCOMPLETE |
| furniture.bed | 10 | 10 | 10 | 0 | 0 | 10 | INCOMPLETE |
| furniture.seating | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| furniture.desk | 10 | 10 | 10 | 0 | 0 | 10 | INCOMPLETE |
| furniture.chair | 8 | 8 | 8 | 0 | 0 | 8 | INCOMPLETE |
| furniture.storage | 10 | 10 | 10 | 0 | 0 | 10 | INCOMPLETE |
| furniture.electronics | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| furniture.lights | 12 | 12 | 12 | 0 | 0 | 12 | INCOMPLETE |
| furniture.kitchen | 10 | 10 | 10 | 0 | 0 | 10 | INCOMPLETE |
| furniture.decor | 16 | 16 | 16 | 0 | 0 | 16 | INCOMPLETE |
| furniture.workshop | 10 | 10 | 10 | 0 | 0 | 10 | INCOMPLETE |
| furniture.collectible | 10 | 10 | 10 | 0 | 0 | 10 | INCOMPLETE |
| weapon | 36 | 36 | 36 | 0 | 0 | 36 | INCOMPLETE |
| weapon.tactical | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| weapon.katana | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| weapon.energy | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| weapon.heavy | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| weapon.dual | 4 | 4 | 4 | 0 | 0 | 4 | INCOMPLETE |
| weapon.relic | 8 | 8 | 8 | 0 | 0 | 8 | INCOMPLETE |
| armor | 30 | 30 | 30 | 0 | 0 | 30 | INCOMPLETE |
| curved-glass | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| straight-glass | 6 | 6 | 6 | 0 | 0 | 6 | INCOMPLETE |
| material | 12 | 13 | 0 | 0 | 0 | 12 | INCOMPLETE |
| door | 8 | 8 | 8 | 0 | 0 | 8 | INCOMPLETE |

Paid cosmetics: 97 entries, comprising the full 94-entry requested category partition plus three additional entries classified as accessory/face (two accessory, one face). Only shoes→shoe, outerwear→outer and headwear→head aliases are normalized. All requested category entry targets are met; no runtime target is met. The three extras are not silently reassigned to requested categories.

Furniture: all 11 category entry targets are met, but every category remains unverified. The 120 items are base 36 + living 26 + tech 25 + craft 13 + home 20. The home integration adds the previously missing seven kitchen and thirteen decor entries.

All 36 weapon and 30 armor entry targets are met in source. Armor slots are head 8, chest 8, gloves 7, boots 7. Eight additional equipment accessories (accessory1 3, accessory2 2, relic 3) remain separate. Curves 6, straight glass 6, doors 8 and finishes 13 meet their entry/definition targets, but have zero source-bound runtime approvals. Finishes comprise floor 7, wall 3, ceiling 1 and roof 2.

## Previously pending modules — current integration state

[src/furniture/collection-home-v7.ts](<../src/furniture/collection-home-v7.ts>) exists; HOME_V7_CATALOG: 20 items, 20 registered IDs; HOME_V7_RECIPES: 20 keys. This source is now included in registry totals. Runtime and visual acceptance remain pending.

[src/character/fashion-accessory-v7.ts](<../src/character/fashion-accessory-v7.ts>) exists; ACCESSORY_V7_SHAPES: 35 keys; ACCESSORY_V7_COSMETICS: 35 items, 35 registered IDs. This source is now included in registry totals. Runtime and visual acceptance remain pending.

Both modules were inspected directly at the final snapshot. Home source is present and all 20 IDs are registered; accessory source is present and all 35 IDs are registered. The source-signature measurement includes both and shows the expected category additions without new repeats. This is a source-level integration observation, not runtime or visual acceptance.

## Runtime verification semantics

The implemented `hasRuntimeVerification` predicate in [src/assets/coverage.ts](<../src/assets/coverage.ts>) requires status `VERIFIED`, valid asset metadata, a passing **runtime** evidence record and a source binding. The binding must identify the same asset ID and match both `sourceSha256` and `observedSourceSha256` to the asset's valid 64-hex `source.sha256`; it also requires nonempty environment/test-case descriptions and at least one artifact with a reference and a valid SHA-256. **Any failed runtime or visual evidence vetoes verification**, even when another runtime record passes. Visual-only success is not sufficient; a separate passing visual record is not required by this predicate.

This is **pure metadata validation, not filesystem truth**: the function does not open the source or runtime artifacts, verify that referenced paths exist, recompute their hashes, inspect images, or prove that an artifact contains the claimed observation. A trustworthy acceptance process must independently do those checks. Synthetic passing/negative fixtures in unit tests do not verify production assets. Current registry records contain source evidence, not source-bound passing runtime evidence; none is promoted by this documentation.

## Executed source checks

Direct Node loaded the real catalogs, `createAssetRegistry()`, `calculateAssetCoverage()` and `assetMetrics()` using the already-installed TypeScript `transpileModule` in memory. It executed the unchanged test bodies in [tests/assets/registry.test.ts](<../tests/assets/registry.test.ts>) and [tests/assets/verification.test.ts](<../tests/assets/verification.test.ts>) through an external synchronous compatibility harness for their used Vitest `describe/it/it.each/expect` APIs, backed by `node:assert/strict`. This was **not the Vitest runner**, not a typecheck, not the complete test suite, and not a global product pass. Unsupported async cases are rejected rather than silently accepted.

Result: **26/26 test invocations passed, 0 failed** (15 registry/coverage cases; 11 verification cases, including expanded parameterized veto cases). Registry metadata issues: 0; coverage issues: 0. These assert source references, counts, signature behavior, malformed/duplicate rejection and verification-contract fixtures—not render quality, artifact existence, real database persistence or per-asset acceptance.

Reproduction command: `node C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-final-frozen/measure.cjs`. The harness and its output stay outside the product source. Per-case results, input hashes and timing are recorded in [measurement.json](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/coverage-final-frozen/measurement.json>); the older unstable measurement is historical and is not used for this snapshot. A future execution measures whatever source is then present and must not be represented as the same frozen snapshot.

## Latest retained geometry evidence — scoped PASS, no promotion

These existing report bytes were inspected and SHA-256 hashed for this refresh; no browser or visual-quality review was rerun. PASS below means the recorded test assertions passed, not that the complete asset acceptance contract is met. Every listed report records zero unexpected, skipped and flaky tests. The equipment and furniture runs used installed Chrome at 1440×1000 with API fixtures; preview selection is not a purchase or database persistence check.

| Retained report | Recorded passing tests | Asset/observation scope | SHA-256 of report bytes |
| --- | --- | --- | --- |
| [Curve frame-fix r2](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/curve-material-v7/evidence/curve-material-frame-fix-r2/results.json>) | 6 | Five finishes (clear, blue, violet, frosted, smoke), each normal/selected/ghost/reload, plus one clear-vs-frosted optical-contract test. **Not six independent curve geometries.** | `10dd59266885023e3b12412116161751f88a1f8fa51d87286de9ee0b05d7b586` |
| [Equipment crown-fix r5](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/equipment-gallery-v7/evidence/equipment-crown-fix-r5/results.json>) | 2 | 74 catalog assets: 73 searchable shop previews plus one starter inventory item; no purchases. | `fec6f3be3d72e0768292e4b998f1ba58b93a70631017114c542d799c5a9124af` |
| [Powered legacy furniture r3](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/powered-legacy-furniture-r3/results.json>) | 1 | 36 selected and captured furniture IDs; preview-only. | `4eec9529103c997cac7a3df2d1dbda6c29ec07d1d0424cf79b18aaff16a23cc8` |
| [Powered expanded furniture r3](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/expanded-assets-gallery/evidence/powered-postcontact-furniture-r3/results.json>) | 1 | 84 selected and captured IDs from the 120-item catalog; preview-only. | `69140b40d1a1ee9664bbb09daf01238381490e16c7757c157e58fbb26b8bff63` |
| [Terminal screen-fix r1](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/expanded-assets-gallery/evidence/terminal-screen-fix-r1/results.json>) | 1 | Only `v7-info-terminal` selected and captured after its fix; catalogCount 120, capturedCount 1. **Not a fresh full-120 rerun.** | `46c02194f577475f7b63d6603f93b388f9f2480b19c7f6cd49f146ef2e4f3bf4` |

The powered furniture selections have no overlap and their union is exactly the stored 120-ID catalog: 36 + 84 = 120, no missing or outside IDs. These are two gallery tests, not 120 independent passes. The single terminal run supplements those earlier galleries after its source change. Current [collection-tech-v7.ts](<../src/furniture/collection-tech-v7.ts>) SHA-256 is `19494e2ea87ce5882bb5c945b3caae276767e224c5a1c81b5dbdca17734a9142`; current [equipment/catalog.ts](<../src/equipment/catalog.ts>) SHA-256 is `ff66b3a18868957b9a0224089ae20c812b058c898159b384e4a4845c18a2be11`.

The [equipment r5 manifest](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/equipment-gallery-v7/evidence/equipment-crown-fix-r5/equipment-gallery-manifest.json>) hashes to `6583f34d89c42824db5a5aa8488507663041939d30d7813e1a88a9d8ed0ae021`. It records zero errors, consoleErrors or unexpectedApi, only a reconcile command, and explicitly states mocked `createInitialState`/`applyAction`, no database and no preview purchases. The [expanded furniture manifest](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/expanded-assets-gallery/evidence/powered-postcontact-furniture-r3/expanded-furniture-manifest.json>) hashes to `60f40cd7df8b6969b940b4a2d389c46a7d7251bee7aa0355076bc33d25a5729d`.

Furniture `snapshotHash` is a serialized catalog-data identity, **not a hash of the renderer/source closure**. The retained furniture/curve reports do not establish a complete source-file binding. Current source hashes are documentary identities and must not be retroactively represented as archived-run bindings. Expanded/terminal captures allow bounded single-channel rounding (`channelThreshold=1`, at most one changed channel/pixel, three consecutive samples); `semanticHash` is null. They are not semantic no-clipping proofs or strict byte-identical baselines. Curve reload uses intercepted APIs and serialized in-memory state with real domain `applyAction`, not live database/process-restart persistence. Service-worker/Three.js warnings remain recorded; the legacy furniture report also retains a shader floating-precision diagnostic.

**Premium visual acceptance and complete fashion acceptance remain unproven. Lead subsequently confirmed1230 full Vitest3,868/3,868 PASS/80 files/250.60s and1223 current production build PASS5.3s compile/9.3s TypeScript, with1215 global TypeScript/full ESLint PASS and1228 test-only scoped lint PASS; this is not per-asset acceptance.** Gallery PASS is bounded desktop fixture/rendering evidence, not approved premium style, every-mesh clipping/material acceptance, physical-mobile/low-graphics/full-house performance, real transactions, persistence, or source-bound per-asset VERIFIED status. All 349 entries remain INTEGRATING and overall coverage remains INCOMPLETE.

## Previously captured browser evidence — scoped, not rerun

The following older external JSON reports and attachment checks are retained from the preceding documentation snapshot; they were not re-executed or visually re-reviewed in this refresh. Their byte identities below are historical, not new source-current acceptance. No browser/GPU run or visual review was performed for this documentation refresh. Test result counts below are the reports' expected-success totals, not new source-bound acceptance. Each listed report has zero unexpected, skipped and flaky outcomes in its own scope; this does not erase failures from other runs or establish a global pass.

| Evidence | Recorded successful tests | PNG attachments | Scope / limits |
| --- | --- | --- | --- |
| [Furniture gallery](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/furniture-gallery-repaired-r2/results.json>) | 1 | 36 (36 existing path references; 0 valid-signature embedded PNG bodies) | One desktop gallery test; 36 named screenshots of the original furniture catalog. Not 36 independent test passes and not coverage of the expanded 120-item inventory. |
| [Strict locks](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/released-strict-locks-qa/results.json>) | 8 | 2 (2 existing path references; 0 valid-signature embedded PNG bodies) | Eight desktop/mobile-emulation cases; lock/ownership interaction assertions, not eight source-bound asset approvals. |
| [Construction controls](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/construction-browser/evidence/construction-controls-r2/results.json>) | 6 | 6 (0 existing path references; 6 valid-signature embedded PNG bodies) | Six desktop cases with browser route interception and real domain applyAction. In-memory serialized state survives reload, not a database/process restart. Canonical parameters/DOM controls are asserted; screenshots explicitly review-only, not curved-mesh geometry proof. |
| [Furniture interactions](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/furniture-interactions-qa/results.json>) | 5 | 10 (10 existing path references; 0 valid-signature embedded PNG bodies) | Five desktop cases with real canvas clicks; scoped wardrobe/workstation/bench/move/lamp interactions, not all furniture assets or mobile coverage. |
| [FPS HUD](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/released-fps-hud-qa/results.json>) | 4 | 4 (4 existing path references; 0 valid-signature embedded PNG bodies) | Four desktop/mobile-emulation × balanced/performance observations; hardware renderer GTX 1050 Ti, not physical mobile hardware. |

Construction PNGs are embedded in the report rather than file-path attachments; a zero path-reference count is not a missing-artifact finding. These checks establish file presence/PNG signature only, not visual quality. The original-36 gallery, eight locks, six construction controls, five interactions and four FPS cases **are not per-asset acceptance of all 120 furniture models** or the 349 total registry entries. They do not bind every current source hash to an inspected runtime artifact.

### Recorded FPS observations

| Project / quality | Samples | Minimum | Maximum | Mean FPS | Median FPS |
| --- | --- | --- | --- | --- | --- |
| desktop-chromium / balanced | 10 | 57 | 60 | 58.1 | 57.5 |
| desktop-chromium / performance | 10 | 56 | 60 | 57 | 56 |
| mobile-chromium / balanced | 10 | 56 | 60 | 57.6 | 57 |
| mobile-chromium / performance | 10 | 56 | 60 | 57.5 | 57 |

All four telemetry attachments identify ANGLE / NVIDIA GeForce GTX 1050 Ti / Direct3D11, including the emulated Pixel 7 mobile user agent. They sample the application's R3F HUD estimates about every 3250 ms after warm-up, with mocked APIs and reduced motion. These are not physical-phone benchmarks, not profiler frame-time distributions and not a guarantee on other hardware or all assets. No new performance target or pass threshold is inferred.

### Browser report byte identities

| Existing report | SHA-256 |
| --- | --- |
| [Furniture gallery](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/furniture-gallery-repaired-r2/results.json>) | `7cd28c085faa9f7371aeb76656f4d36f52900c60658e93eb06d45453735d341c` |
| [Strict locks](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/released-strict-locks-qa/results.json>) | `e8bd578bc410f4d2432e029d8568b442c34fe3771752736a3742e2abbde529a2` |
| [Construction controls](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/construction-browser/evidence/construction-controls-r2/results.json>) | `fd87feea6ec6993db1f1bc6fa5f902f0f7a846648d87e2560bb85b93210e6f4b` |
| [Furniture interactions](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/furniture-interactions-qa/results.json>) | `9c97ab6bd0460438cb4d7677ca01c953e9adb224699175d8b24128505a036124` |
| [FPS HUD](<C:/Users/phamc/.dsh/workai/life-level-v7/evidence/browser/released-fps-hud-qa/results.json>) | `a0a070918a0346fbaf35f55c575bfe3eeeeb94f8fd685035be0b3fd87d867729` |

## Complete PDF-reference review and authority boundaries

The preceding documentation review covered the complete extracted text across all 36 page markers in [all-text.txt](<reference/all-text.txt>), together with [manifest.json](<reference/manifest.json>). The reference conclusions and hashes below are retained historical findings, not a newly repeated PDF or screenshot review. The manifest's historical visual-inspection notes are not current acceptance. That review recorded that the original [LIFE_LEVEL_FINAL_DOWNLOAD.pdf](<../LIFE_LEVEL_FINAL_DOWNLOAD.pdf>) hash matched the manifest and Poppler reported a missing Symbol display font; low-resolution concept labels must not be treated as implementation instructions.

| Reference | SHA-256 |
| --- | --- |
| PDF | dd904f65e3c25a89a2513ca9339b5d0c7ac7be9abc03458b339df3b33c945d93 |
| Extracted complete text | 4c22f0fec59e2351123490a0d2efb710baff6e07d86564a80fdf7839922ea572 |
| Manifest | 7f00457bf3d59fbed7055554ec53d17732d2bfdcb1bdfcd6e1c7cf542d75a390 |

- Pages 2–4 distinguish concept references from actual runtime assets and require coherent cyberpunk style, real editable geometry, one rig/scale, desktop/mobile interaction and visual checks. Compilation alone is not acceptance.
- Page 7 (text lines 177–188) lists editable MVP minima: 12 hairstyles, 12 hair colors, 6 eyes, 8 iris colors, 6 eyebrows, 6 noses, 4 ears, 6 mouth/lip types, 6 face/jaw presets, 12 skin tones and 3 body presets. Their arithmetic sum is 81 mixed options, not 81 distinct meshes; this registry does not measure that facial/customization coverage.
- Page 8 (lines 220–243), reinforced on page 36, requires at least three complete free starter outfits. The 6 tops + 4 bottoms + 4 shoes + 3 outerwear + 4 accessories = 21 composition is **suggested** PDF content; the code separately uses a 21-entry target. Current 24 free entries/21 shapes do not by themselves prove three complete outfits, no-debit grants, persistence or clipping acceptance.
- Page 13 (lines 326–333) lists 15 modular kit types with a one-meter grid and standard three-meter wall height. Page 14 mixes 12 door/window/material examples, not a 12-finish numerical requirement. Page 16 (lines 380–387) lists 18 illustrative furniture types, not a 120/121-model target.
- Pages 17–20 distinguish inventory/equipment categories. Page 19 explicitly depicts eight weapon concept designs, not the later V7 36-weapon partition. Page 20's five-column icon sheet is not a five-icon count and supplies no per-class asset quota. Equipment accessories must not be merged into armor. Page 31 depicts five pets, outside this registry's measured coverage.
- Pages 8, 10–15 and 33–35 require consistent avatar/rig, effective customization, placement/editor controls and prices, exact preview/equip correspondence, owned items, idempotent starter grants, authoritative unlock/funds checks, atomic Gold debit, single ownership grant, retry/two-tab protection, reload persistence and no unintended finance/combat bonuses. Source recipes and this report do not prove these runtime properties.
- Page 36 (lines 779–798) requires implemented/verified/not-yet-verified/blocked reporting for customization, starter outfits, clothing categories, purchase/equip/persistence, style and FPS. Desktop/mobile/low-graphics visual inspection, clipping/scale/material/style comparison and real persistence remain distinct acceptance gates.

## Remaining acceptance limits

The registry is not a complete inventory of every game system (facial options, pets, consumables, raw materials, icons, boss geometry and all building parts are not all covered). Static recipe uniqueness is not aesthetic/silhouette quality, and procedural source references are not exported GLB files. Source that is not registered is excluded; the two formerly pending modules are now registered. Bound runtime artifacts, visual failure review, per-asset desktop/mobile/low-graphics interaction and source-current persistence/purchase evidence remain necessary. **No asset is promoted; this report is an incomplete, hash-bound source inventory, not release acceptance.**

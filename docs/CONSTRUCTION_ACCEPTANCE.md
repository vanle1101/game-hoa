# Construction acceptance: 61 required scenarios

Source: 2026-10-15 additive construction specification, section 15. Initial status **PENDING** means not yet verified for the new modular house system. Existing furniture or domain tests cannot be automatically counted as construction acceptance. Use PARTIAL when only domain/source evidence exists; PASS requires the stated scope. Live database and browser results must be distinguished from mocked/local tests.

| # | Scenario | Evidence needed | Status |
| --- | --- | --- | --- |
| 01 | Place one wall segment | Valid edge stored and mesh visible | PENDING |
| 02 | Drag multiple wall segments | Continuous drag creates snapped edges | PENDING |
| 03 | Adjacent walls connect | No unintended gaps/overlap | PENDING |
| 04 | Reject duplicate wall edges | Schema/domain rejects duplicate topology | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 05 | Remove a wall | Draft/commit/reconstruction remove edge | PENDING |
| 06 | Create enclosed room | Four boundaries plus floor region | PARTIAL: desktop coordinate-built adjacent 3×4 room observed; saved/browser drag flow pending |
| 07 | Detect room | Derived region/id/area, not hardcoded count | PARTIAL: 2 derived rooms observed at desktop; topology tests pass |
| 08 | Remove wall to join rooms | Topology merges as expected | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 09 | Update room detection | Add/remove boundaries recompute regions | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 10 | Change wall material | Valid catalog pricing and reconstruction | PENDING |
| 11 | Place door on wall | Ownership and wall compatibility validated | PENDING |
| 12 | Door makes real opening | Wall mesh has traversable cutout | PENDING |
| 13 | Character passes door | Live route/animation through opening | PENDING |
| 14 | Reject floating door | Opening cannot attach to absent wall | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 15 | Place valid window | Compatible wall cutout/frame/glass | PENDING |
| 16 | Replace window | New model/material and authoritative cost | PENDING |
| 17 | Remove window | Attachment removed in stored plan | PENDING |
| 18 | Restore wall after opening removal | Mesh filled correctly without z-fighting | PENDING |
| 19 | Construct floor | Grid cells create durable floor geometry | PARTIAL: adjacent room preview increased to 28 floor tiles; saved/reload visual acceptance pending |
| 20 | Paint single floor cell | Material and cost change for one cell | PENDING |
| 21 | Paint floor region | Multi-cell selection updates only target | PENDING |
| 22 | Replace floor material | Valid catalog item and reconstructed material | PENDING |
| 23 | Validate floor boundaries | Out-of-plot and unsupported floor rejected | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 24 | Buy sofa | Server price debit and ownership | PENDING |
| 25 | Place sofa | Ghost/footprint then persisted placement | PENDING |
| 26 | Rotate furniture | Supported rotations and footprint transform | PENDING |
| 27 | Detect collision | Walls/furniture/doors reject invalid footprint | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 28 | Move sofa | Retain instance identity and interactions | PENDING |
| 29 | Store furniture | Installed instance returns to owned inventory | PENDING |
| 30 | Place stored furniture again | No duplicate ownership or second purchase | PENDING |
| 31 | Reload furniture placement | Position/orientation/ownership reconstructed | PENDING |
| 32 | Preview construction cost | Same canonical pricing as server | PARTIAL: desktop draft showed 320 Gold for added room; canonical pricing tests pass |
| 33 | Save debits exact Gold | Atomic structure/ledger/journal mutation | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 34 | Reject insufficient funds | No partial architecture or debit | PARTIAL: Save disabled at 0 Gold in browser; server insufficient-funds rollback tested |
| 35 | Cancel draft costs nothing | Committed house/Gold unchanged | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 36 | Draft undo costs nothing | Local history does not mutate server | PENDING |
| 37 | Duplicate save charged once | Stable key, current response state, one ledger debit | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 38 | Demolition refund exact | Canonical policy and ownership checked | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 39 | No build/demolish Gold farming | Cycles never generate net Gold | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 40 | Real finance unchanged | Finance aggregate byte-equivalent after build | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 41 | Character cannot cross wall | Navigation blocks wall edge | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 42 | Character goes through door | Door edge creates valid navigation connection | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 43 | Avoid furniture | Occupancy footprint blocks route | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 44 | Added wall updates paths | Rebuild invalidates old route | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 45 | Removed wall updates paths | New traversable edge becomes reachable | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 46 | No-path handled safely | Feedback, no teleport/crash/infinite loop | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 47 | Save architecture | Authoritative revision and durable structured data | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 48 | Reload architecture | Same committed plan after store restart/read | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 49 | Restore walls | IDs/edges/materials/height restored | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 50 | Restore doors | Valid wall linkage/type restored | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 51 | Restore windows | Valid wall linkage/type restored | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 52 | Restore floor materials | Cell identity/material mapping preserved | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 53 | Restore furniture | Owner/instance/position/rotation preserved | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 54 | Restore room state | Derived topology and explicit room names preserved | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 55 | Multi-tab revision conflict | Exactly one competing draft commits; no overwrite/debit | PARTIAL: isolated store/topology test; full editor/render/browser scope pending |
| 56 | Desktop Build Mode | Direct interaction with editor/viewport | PARTIAL: direct desktop Build Mode interaction at 1087×836; broader controls pending |
| 57 | Mobile Build Mode | Viewport/layout/touch without hover dependence | PENDING |
| 58 | Camera gestures | Pan/orbit/zoom do not conflict with editor | PENDING |
| 59 | Toolbar usability | Active tool/context/shortcuts; inputs isolated | PARTIAL: coordinate palette used; palette/undo overlap corrected; complete shortcuts/touch pending |
| 60 | Touch placement | Snap/preview/confirm/cancel through touch | PENDING |
| 61 | Mobile save/cancel | Server commit or discarded draft with clear status | PENDING |

Additional required gates beyond these 61: coherent Live/Build/Buy shared state; local undo/redo; revision-conflict recovery UI; ceilings/roofs and level-ready schema; stair/support restrictions; area/material/blueprint progression; boss construction rewards; asset quality and measured FPS; no regressions to tasks/combat/equipment/finance/AI.

# Apartment asset audit — V21.1

`python tools/visual-v18/audit_assets.py` structurally validates all 12 registered
assets: each has a Blender source, GLB 2.0 runtime file, PNG studio preview,
metadata, nonzero dimensions, meshes and materials. This does **not** establish
reference fidelity or in-game visual acceptance. All remain `ASSET PRODUCTION`.

| Asset | Meshes | Triangles | Materials | Embedded images |
| --- | ---: | ---: | ---: | ---: |
| Premium bed (foot-bench revision) | 86 | 156,636 | 9 | 10 |
| Sectional sofa | 51 | 132,472 | 6 | 8 |
| Executive desk | 120 | 37,176 | 27 | 4 |
| Ergonomic chair | 27 | 38,132 | 3 | 2 |
| Paneled wardrobe | 28 | 4,992 | 4 | 2 |
| Marble kitchen island | 72 | 27,398 | 10 | 3 |
| Ceramic bathroom suite | 18 | 8,620 | 6 | 3 |
| Coffee table | 35 | 31,232 | 7 | 4 |
| Leather bar stool | 10 | 15,072 | 2 | 2 |
| Dome floor lamp | 7 | 7,680 | 5 | 2 |
| Wool rug | 73 | 10,288 | 3 | 6 |
| Potted palm | 353 | 5,744 | 3 | 0 |

The bed was rebuilt in Blender 4.5 from `tools/visual-v18/build_hero_assets.py`
and extended from its editable source by `bed/add_reference_foot_bench.py`.
The darker sculpted cover, tailored pillows and upholstered foot bench move its
silhouette toward REF-D. The unchanged runtime URL is
`/assets/apartment/bed/premium-bed.glb`. `assets/apartment/bed/preview.png`
is a real Cycles render of the source; it is not a Home screenshot. Final mesh
and triangle totals are in `bed/metadata.json` and the audit command output.
`bed/reference-vs-preview.png` places a labeled crop of REF-D next to that
studio render. It shows a meaningful dark-cover improvement, but also major
remaining differences: REF-D has a lower broad headboard, more layered bedding,
a foot bench, and stronger fabric/light interplay. The bed therefore stays
`ASSET PRODUCTION` and needs another modeling pass.

The 12 hero asset sources and texture generators are authored in this repository;
their metadata states no third-party model input. The existing Kenney City Kit
Roads and Commercial bundles are separate city assets. Their bundled
`public/assets/world-v20/{roads,commercial}/LICENSE.txt` files specify CC0.
No third-party furniture download was added in this pass because none was
validated as both more suitable for REF-D and clearly licensed. This avoids
replacing an authored asset on the basis of file availability alone.
The official [Poly Haven license](https://polyhaven.com/license) states CC0;
its live furniture catalog was checked for beds and sofas. Available matches
included Gothic/vintage beds and antique sofas, which do not fit REF-D's
contemporary upholstered design. They were not downloaded or integrated.

Remaining visual gates: load the revised GLB in actual Home, capture a close-up,
compare the silhouette and materials against REF-D, check collision and scale
in both starter and developed placements, then revise the model or camera as
needed. The existing Home close-up in `evidence/v21/bed-closeup-after.jpg`
predates this revision and must not be used as proof of the new runtime image.

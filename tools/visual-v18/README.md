# V18 asset production

Blender 4.5.0 LTS portable was downloaded from the official distribution at
`https://download.blender.org/release/Blender4.5/blender-4.5.0-windows-x64.zip`.
The SHA-256 was checked against the official `blender-4.5.0.sha256` before extraction.
It is workspace-local at `.tools/blender-4.5.0-windows-x64/blender.exe`.

## Reproduction

```powershell
& '.tools/blender-4.5.0-windows-x64/blender.exe' --background --python 'tools/visual-v18/build_hero_assets.py' -- bed
& '.tools/blender-4.5.0-windows-x64/blender.exe' --background --python 'tools/visual-v18/build_hero_assets.py' -- sofa
```

`model_common.py` is an importable authoring library. Its public coordinate arguments
use runtime coordinates: X right, Y up, Z front, in metres. It converts to Blender
Z-up internally; standard glTF export converts back to runtime Y-up. Bed headboard
and sofa back face local -Z; floors are Y=0. Meshes have meaningful node names.

`export_asset(category, slug, description, features)` exports selected production
meshes before any studio camera, floor or light is added. Source files, metadata,
and studio previews are under `assets/apartment/<category>/`. Runtime binaries
are under `public/assets/apartment/<category>/`. Images are embedded in GLB and
packed into the .blend source. The studio renders are offline Cycles production
previews and **must not be substituted for browser/game evidence**.

## Geometry and materials

All meshes and textures are original project authoring. No third-party models,
paid services, or AI generated result images are involved. Structural timber
uses beveled joinery. Upholstery uses a bevel/subdivision stage and deformed
vertices for padding/puckering; duvets/throws are continuously draped mesh grids
with thickness. Seams, piping, hems, and fringes are actual geometry. PBR fabric
and walnut base color/normal images export through glTF material nodes.

## Gate status

The first studio render revealed cloth overlap and excessively rippled fabric;
these were corrected before the second render. Studio renders support geometry
review only. Status remains `ASSET PRODUCTION` until GLB browser loading,
in-game closeups, placement and comparison are reviewed by integration QA.
Photoreal equivalence to REF-D is not asserted.

Bed overall width includes both bedside cabinets (3.42 m); the bed frame itself
is 2.2 m wide and 2.52 m long. Do not nonuniformly scale it to 2.2 m overall.
Sofa chaise projects toward +Z on the local -X side.

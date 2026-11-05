# V21 visual evidence — 2026-10-18

The `*-after.jpg` files were captured from the live browser WebGL canvas. They are not generated concept art.

- `home-after.jpg`: actual local Home with the authenticated save and the front-facing default camera.
- `home-rear-camera.jpg`: rear character preset on the same save; orbit does not rotate the actor.
- `home-benchmark-after.jpg`: actual Home starter plan in free camera.
- `showcase-starter-after.jpg`: read-only starter fixture through the same `ConstructionWorld` renderer.
- `showcase-developed-after.jpg`: read-only developed fixture through the same renderer.
- `bed-closeup-after.jpg`, `sofa-closeup-after.jpg`: live GLB inspections.
- `home-developed-same-fixture.png`, `showcase-developed-same-fixture.png`: the same
  developed fixture rendered through Home and Showcase; `same-fixture-side-by-side.png`
  is the captured comparison.
- `bed-closeup-current.png`, `sofa-closeup-current.png`, `desk-closeup-current.png`,
  `kitchen-closeup-current.png`, `window-view-revised.png`: current HTTPS captures after
  the camera and glass pass.
- `reference.png`: accessible REF-D from the supplied PDF.

The older `side-by-side.png` is **not** a same-fixture comparison. The saved Home capture
uses the player plan; the new same-fixture captures use `?visualFixture=developed`, which is
read-only and cannot call mutation APIs. Both routes use the same renderer, materials,
lighting, GLB loader and camera controller.

## Gate status

- WebGL in the in-app browser: **verified** for local Home and HTTPS Showcase. Cold GLB loading can take several seconds; the UI now distinguishes renderer readiness from asset loading and offers reload after a prolonged stall.
- Home and Showcase asset registry: **integrated**. All twelve source `.blend` and public `.glb` files exist. Asset manifest still marks them `ASSET PRODUCTION`, not `VERIFIED`.
- Bed close-up: **visual QA**. Sculpted bedding, stitched upholstery, headboard and side lamps are visible; the wardrobe occludes part of this inspection camera.
- Sofa close-up: **needs rework**. The model has cushions and seams, but the current camera is heavily blocked by the kitchen island.
- REF-D scene match: **needs rework**. Cutaway remains terrace-like, nearby imported buildings dominate the skyline, and panorama/water/bridge are not visible from the benchmark.
- Save/Gold: no write action was performed during capture. The Home screenshot shows 0 G before and after, but no database hash comparison was made.

The HTTPS gateway returns `200` for `/showcase/apartment-v18`, `401` plus a browser
Basic-auth challenge for unauthenticated `/`, and `200` for the authenticated `/api/game`.
The preview runs the production Next build with an explicit loopback-only local-save opt-in;
the saved JSON SHA-256 was recorded before and after QA and was unchanged. A remote-device
login flow still needs direct verification on a separate network.

## Current rework status

- **INTEGRATED:** Home and Showcase share `ConstructionWorld`, the V21 registry, GLB loader,
  materials, lighting and camera controller. Twelve `.blend`/`.glb` pairs are present and
  parse as glTF 2.0 with meshes, materials and textures where authored.
- **VISUAL QA:** bed, sofa, desk and kitchen close-ups render as real assets; the fixed
  window preset exposes sky, roadway and a deeper skyline. A tall landmark was moved behind
  the panorama corridor and the curtain-wall transom was raised.
- **NEEDS REWORK:** the benchmark still reads as an elevated cutaway and the city is a
  stylized low-detail kit. REF-D's dense luxury interior, purple waterfront skyline and
  exact proportions are not yet met. The asset manifest therefore remains `ASSET PRODUCTION`;
  no hero asset is marked `VERIFIED`.

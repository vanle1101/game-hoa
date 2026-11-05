# V18 visual production status

## VERIFIED infrastructure

- Reference JPGs copied byte-for-byte into `references/visual-v18/`.
- Baseline screenshot captured from the existing `/showcase` route at 1672 × 941: `showcase-before.jpg`.
- Dedicated read-only HTTPS showcase: `https://board-ready-suse-get.trycloudflare.com/showcase/apartment-v18`.
- Public route returns 200; `/` redirects to the showcase; unauthenticated `/api/game` returns 403.
- Player save hash is unchanged: `97725087F53B85ABA7E39D74E23227D27CC4864220B73258486F1D16D55F42B1`.

## ASSET PRODUCTION

Twelve original Blender 4.5 assets have `.blend`, `.glb`, preview, and metadata files. The runtime GLBs are public only through the showcase gateway. They are not marked VERIFIED until their rendered appearance is checked in the browser scene.

## VISUAL QA

- The local `/showcase/apartment-v18` route visibly loaded the GLB scene and changed its status to `MODEL ĐÃ TẢI · VISUAL QA`; the browser render showed the benchmark apartment with the new furniture assets.
- The public HTTPS route now serves the encoded Next scene chunks and the bed GLB after the gateway allowlist fix. Remote screenshot capture is still pending, so no final REF-D visual acceptance is claimed.
- Close-up and side-by-side evidence files remain to be captured: bed, sofa, desk, kitchen, window, starter, after, and comparison.

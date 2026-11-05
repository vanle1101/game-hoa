# LIFE//LEVEL 1:1 Frame Extraction Kit

This is a concrete **asset + React/CSS + validation** kit based on the user's own 1801×873 reference screenshot.

## Included

- `reference.png` — original reference image, 1801×873.
- `assets/*.png` — 9 transparent reference-derived mechanical-frame overlays.
- `frame-coordinates.json` — screenshot-space crop regions and reactor centers.
- `react/ReferenceFrameOverlay.tsx` — reference-size overlay + path-following LED animation.
- `react/FluidMechanicalFrame.tsx` — nine-slice adaptive border for other tabs.
- `react/reference-frame.css` — styling and accessible reduced-motion support.
- `extract_reference_frames.py` — editable, repeatable cropping/masking routine.
- `verification/pixel_diff.py` — screenshot overlay/difference heatmap generation.
- `verification/frame_contact_sheet.jpg` — quick inspection of transparency and extraction.
- `assets/reactors/*.png` — 10 reference-derived circular mechanical sprites.
- `preview.html` — standalone local demo for visual inspection (not an app).
- `CODEX_TASK.md` — direct implementation instructions for Codex.

## How to hand off

Open ChatGPT Codex in the **existing LIFE//LEVEL repository**, upload/extract this archive into the working directory, and ask:

> Implement `CODEX_TASK.md` in this repository. Use `reference.png` as the visual ground truth and the supplied actual extracted overlays, not redesigned replacement borders. Do the code changes, run the app, verify at 1801×873, generate screenshot comparisons, and iterate. Keep game functions and background intact.

## Limits

- The reference image is only a 2D flattened screenshot; the extracted source pixels inevitably include some adjoining background and do not reconstruct hidden layers. The center of each overlay is transparent, so app content remains real.
- Existing project files were **not provided** to this environment. Nothing in this ZIP changes the app until Codex integrates and verifies it in the real repository.
- The animated LED `perimeterPath` is a **starting point**, not a proof of pixel-exact circuit topology. Codex needs to refine it by comparing screenshots and tracing the paths.
- Reusing existing frame artwork on an arbitrary-sized tab requires careful nine-slice/corner decomposition; freely stretching whole PNG can distort circular reactors. The 1:1 screenshot is the defined calibration viewport.

## Optional local Windows copy helper

`install_assets.ps1 -ProjectRoot 'E:\Game hoa cuoc song'` copies the prepared image assets and React source into new folders (fails safely if destination folders already exist). It does **not** edit `GameApp`, routes, or backend; Codex still needs to integrate and visually verify the components.

# LIFE//LEVEL — WORKING CODEX TASK (ASSET-FIRST 1:1 RECONSTRUCTION)

**This archive contains ACTUAL source-extracted frame artwork**, not newly generated generic cyberpunk frames. Integrate those assets into the existing LIFE//LEVEL UI, not as a fake whole-page screenshot. The goal is a live, interactive Next.js app whose static decorations are as close as possible to `reference.png` at 1801×873.

## Project context

- Local project previously used by owner: `E:\Game hoa cuoc song`.
- Existing frontend: Next.js App Router, React, TypeScript. Inspect the current repository rather than assuming paths are unchanged.
- Current working UI is structurally close to the reference but its frames are too thin and lack reference reactor/metallic details.
- **Do not touch production server, database schema or deployment**, and do not overwrite user changes without verifying Git status.

## Required work (actually implement, not describe)

1. Inspect current `src/app/page.tsx` and the current `GameApp` component, routing and relevant styles. Check `git status` and existing local changes.
2. Read `frame-coordinates.json` and inspect every transparent PNG in `assets/`. These are crops of the REFERENCE screenshot with transparent interiors. They preserve pixel-sourced mechanical detail, concentric turbines, irregular metallic edges and static neon track appearance.
3. Copy the nine `assets/*.png` to `public/lifelevel-frames/`. Copy/adapt the React component and CSS from `react/` into the project's UI component system.
4. The included `ReferenceDashboardDecoration` is a calibration scaffold for the specific 1801×873 reference screenshot. **Do not blindly paste it over the page**. Remove or reduce the *old* CSS/SVG borders that would double-stack under the source-extracted frames. Preserve all real game content, controls and city background.
5. Adjust the actual layout or wrapper positions to the image's measured bounds. Main dashboard target boxes are given in the JSON, as are header/sidebar bounds. Use browser screenshots to refine alignment.
6. The imported PNGs are **not a perfect extraction of unseen source layers**. The supplied alpha masks contain some edge/background pixels and rare text contamination. Use `extract_reference_frames.py` to revise masks, or precisely clean the transparent assets where necessary. Do not pretend they're perfect.
7. `ReferenceFrameOverlay.tsx` includes a working approximate circuit-path LED animation. To achieve precise 1:1, trace the circuit tracks for each variant more accurately from the reference and refine the SVG path coordinates. Do not replace with border blink/random dots. Retain reduced-motion support.
8. Use or adapt `react/FluidMechanicalFrame.tsx`, the nine-slice border and `assets/reactors/*.png` for non-reference routes. Do NOT stretch the screenshot's large reactor into an oval. Use the same extracted mechanical motifs as corner assets but layout freely for pages whose exact screenshots are unavailable.
9. Check the actual behavior for all routes and interactions. Keep scroll/click/focus and background visibility. Asset overlay must have `pointer-events:none` and should not intercept interactions.
10. Start the app. Capture an actual screenshot **1801×873, deviceScaleFactor:1**, and run:

```bash
python verification/pixel_diff.py reference.png actual-dashboard.png --out verification/compare
```

11. Examine `overlay_50pct.png` and `difference_heatmap.png`; compare the frame silhouette, city exposure, turbine size, glow, header geometry and sidebar offsets. Iterate. Save before/after comparison. Check static fidelity before tuning animation.
12. Run the repo's existing build/lint/tests and report any failures honestly.

## Strict acceptance requirements

- Reference frame silhouette and turbine/ring art are reproduced using **actual reference-derived graphics** where feasible.
- Native React interactive content still works; no screenshot-as-page workaround.
- LED pulses physically travel around continuous SVG paths, rather than blink globally.
- Main dashboard background still shows through transparent panel centers.
- The frame overlay doesn't cover existing texts/controls.
- When exactly matched at 1801×873, the screenshot comparison shows minimal mismatch in each named panel. A simple overall pixel metric isn't enough to establish detail-level quality.
- **Do not claim pixel-perfect** until a visual comparison proves it. Still images do not contain 3D scene data, hidden layers, or original animation timing; report what remains underdetermined.

## Practical code mapping

The nine reference assets are: `header`, `sidebar`, `today`, `boss`, `ai`, `skills`, `character`, `achievements`, `rewards`.

For 1:1 calibration, `FRAME_GEOMETRY[name].rect = [left,top,right,bottom]` uses reference screenshot coordinates. The standalone decoration layer is only a starting point for calibration; it cannot solve layout mismatches by itself.

**Critical point:** The previous Codex attempt drew generic thin borders. Stop redrawing frames with approximated CSS. Use the included pixel-extracted mechanical art first, then reconstruct whatever still differs.

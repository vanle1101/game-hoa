# LIFE//LEVEL V18 visual decomposition

Inspection date: 2026-10-17  
Primary acceptance image: REF-D-developed-showcase.jpg  
Reference set: four supplied JPGs copied without recompression. Each source is 1680 x 941 px (16:9).

## Reference inventory

| ID | File | What it establishes | Use |
|---|---|---|---|
| REF-A | REF-A-build-mode.jpg | Build-mode camera, dark apartment shell, furniture catalog, bottom construction toolbar and city context | UI/build composition only; not the interior acceptance camera |
| REF-B | REF-B-starter.jpg | Empty/developing apartment shell, bed/wardrobe/desk, glazing and floor scale | Starter state and shell proportions |
| REF-C | REF-C-window-view.jpg | Interior window view, four-panel panorama, skyline/water/bridge depth | Window/city material and lighting benchmark |
| REF-D | REF-D-developed-showcase.jpg | Developed apartment with complete furniture zoning, warm pools and cyberpunk exterior | PRIMARY SHOWCASE GATE |

LIFE_LEVEL_FINAL_DOWNLOAD.pdf exists at the repository root (11,952,128 bytes at inspection). It was not treated as a replacement for the four supplied JPGs; the JPGs are the latest direct visual references.

## REF-D camera and coordinate convention

REF-D uses a three-quarter isometric view from above the front-right exterior corner, looking toward the rear panorama. The interior occupies roughly 88% of image width and 90% of height; the city reads through the glass. The camera is high enough to reveal floor zoning but low enough for furniture silhouettes to remain substantial. Use a fixed perspective benchmark around a 12 m x 10 m apartment footprint; record the exact camera transform with the game screenshot.

For layout below, rear means the panorama/window wall and front means the lower edge of the apartment in REF-D. Left/right are from the benchmark camera. Dimensions are visual estimates for a 120 m2 apartment and should be replaced by measured scene coordinates when the showcase is authored.

## Layer 1 — Architecture

| Element | REF-D observation and relative position | Estimated size/material | Required asset / current evidence |
|---|---|---|---|
| Floor | Continuous dark walnut floor from kitchen through living, bedroom and desk; long boards run mostly left-right in image. | 12 m x 10 m interior, 0.12 m build-up; satin walnut, visible seams and warm reflections | Procedural architectural mesh is acceptable. Screenshot evidence still required in evidence/v18. |
| Rear panorama | Full-height glazing spans nearly entire rear and right sides; thick charcoal mullions divide about four visible bays. | Sill-to-ceiling glazing about 2.7 m high; black powder-coated aluminium, low-roughness glass | Real frames + glass; city visible through each bay. REF-C is material/view benchmark. |
| Side/front glazing and balcony edge | Glass guardrail wraps exposed perimeter; dark structural beam and amber linear strip run along slab edge. | Guardrail about 1.1 m high, 40–60 mm posts; smoked/clear glass and black metal | Procedural architecture is acceptable; avoid a floating roof-terrace silhouette. |
| Rear wall / headboard wall | Dark vertical timber slats with warm concealed line at ceiling and bed sides; solid piers frame windows. | Slatted walnut wall about 4 m wide x 2.8 m high; black/dark bronze trim | Needs authored slat rhythm and emissive strip, not flat color. |
| Entry / left wall | Front-left door, tall wardrobe and marble transition; narrow illuminated shelves beside entry. | Door about 0.9 x 2.2 m; wardrobe run about 3.2 m; black marble inset | Wardrobe source exists as blend; door/wall remain architecture. |
| Bathroom enclosure | Front-right glass enclosure below desk/living line, with dark tile and white ceramic fixture. | Approx. 2.3 m x 2.1 m wet room; smoked glass, large dark tile, ceramic | Dedicated bathroom fixture asset not found; NEEDS REWORK until modeled and rendered. |
| Ceiling / cutaway | Showcase is cut away, but shell remains enclosed by ceiling/wall mass; no rooftop-only reading. | Ceiling about 2.7–3.0 m; dark acoustic panel/soffit with recessed amber lights | Keep real shell and hide only benchmark obstruction via explicit cutaway. |

## Layer 2 — Main furniture

| Zone | Objects and relative placement | Visual dimensions / materials | Asset status and gate |
|---|---|---|---|
| Rear-left bedroom | Bed centered against rear slat wall; two nightstands and globe lamps; wardrobe and entry farther left; rug under bed; tall plant at window corner. | Bed about 2.0 x 2.2 m, mattress top about 0.45 m; walnut/charcoal frame, linen duvet, dark runner, stitched pillows; rug about 3.4 x 2.8 m | premium-bed blend and runtime GLB exist; metadata says ASSET PRODUCTION, 59 meshes / 126,456 triangles. Needs close-up and in-game load evidence before VERIFIED. |
| Rear-right work zone | Executive desk faces inward/window immediately right of bed; monitor, keyboard, lamp and task chair; low shelving/decor at right edge. | Desk about 2.35 x 0.86 x 1.46 m including display/lamp; walnut, black metal, emissive monitor; chair about 0.73 x 0.76 x 1.27 m | Desk/chair blend, previews and declared runtime paths exist. Metadata ASSET PRODUCTION; need benchmark screenshot and runtime confirmation. |
| Front-left kitchen | Black marble island with integrated sink/faucet, induction details and two bar stools; cabinetry against left wall. | Island about 2.8 x 1.0 m, counter height about 0.92 m; black marble with pale veins, walnut/black cabinets, brushed metal fixtures; stools about 0.75 m high | No dedicated kitchen GLB/metadata found; NEEDS REWORK until island, cabinets, sink and stools pass model gate. |
| Front-center living | L-shaped sectional faces low black coffee table; large rug, pillows, floor lamp/plant form foreground vignette. | Sofa footprint about 3.3 x 2.3 m, seat about 0.42 m; taupe fabric, piping, soft cushions, bronze feet; table about 1.2 x 0.7 x 0.38 m | sectional-sofa blend and runtime GLB exist; ASSET PRODUCTION, 51 meshes / 132,472 triangles. Coffee table has no dedicated hero evidence. |
| Front-right bathroom | Transparent glass partition, vanity/sink and mirror at far-right lower corner; toilet visible in developed view. | Vanity about 1.2 m wide; mirror about 0.8 x 1.0 m; ceramic white, dark tile, brushed metal | No dedicated bathroom runtime asset found. NEEDS REWORK. |

## Layer 3 — Secondary furniture and decor

| Object | REF-D shape/location | Estimate / material | Status |
|---|---|---|---|
| Rugs | Textured rug under bed and living group; edges visible against reflective floor. | Bedroom about 3.4 x 2.8 m; living about 4.2 x 3.0 m; high-pile taupe/charcoal textile | No verified texture/asset evidence; NEEDS REWORK. |
| Floor plants | Large palm/fern in square dark planters at rear bedroom glazing and front living; small desk/shelf plants. | 1.2–1.8 m tall; broad leaves, matte ceramic/stone planters | No dedicated plant evidence; NEEDS REWORK. |
| Lamps | Globe bedside lamps, black dome floor lamp, desk lamp, table lamps and linear architectural strips. | Warm amber 2200–3000 K pools; metal shades, frosted globes | Fixture assets not registered; author fixtures and capture close-up. |
| Shelves/books/art | Open shelves by entry and desk; framed art above bed; books and small objects on tables. | 0.3–0.8 m modules; walnut/black metal, paper, ceramic, glass | No hero decor registry/evidence; NEEDS REWORK. |
| Kitchen objects | Cooktop, sink, faucet, bowl/plant and small countertop objects. | 0.2–0.5 m props; marble, brushed metal, ceramic | No dedicated set evidence; NEEDS REWORK. |
| Textiles | Duvet, runner, pillows, throw and sofa cushions have soft deformation and visible seams. | Linen/cotton with varied roughness; no plastic highlights | Bed/sofa metadata claims cloth features but remains ASSET PRODUCTION pending game screenshot. |

## Layer 4 — Materials

- Walnut/dark wood: warm brown grain on floor, slatted wall, desk and cabinets; satin reflections follow board direction. Grain must remain readable at benchmark distance.
- Black marble: kitchen and entry surfaces have pale irregular veins and sharper highlights than floor; avoid a black Lambert slab.
- Upholstery/linen: taupe/charcoal with broad soft highlights, piping and folds; rough fabric response and cushion separation.
- Metal: dark bronze/black frames, lamp shades, handles and chair base with controlled specular response.
- Glass: transparent panes with cyan/violet city reflections and dark mullion silhouettes; city remains legible.
- Ceramic: light smooth bathroom fixtures and pots, less reflective than metal.
- Emissive strips: warm amber interior strips and violet/cyan exterior signs; emission supports geometry and shadows, not placeholder concealment.

## Layer 5 — Lighting

- Interior key: warm amber pools from ceiling coves, bedside globes, floor lamps and desk lamp; localized falloff keeps light/shadow structure.
- Exterior fill: violet/cyan skyline enters through panorama and creates cool reflections on floor and frames.
- Bed wall: concealed slat lighting separates headboard, bed and wardrobe.
- Desk: monitor/lamp creates a smaller cool/warm contrast.
- Floor response: walnut receives elongated warm reflections; marble receives sharper vein highlights.
- Shadow requirement: sofa, stools, bed and plants cast contact shadows. Bloom cannot substitute for geometry or occlusion.

## Layer 6 — City context

REF-C and REF-D show foreground towers beyond glass, a layered midground skyline, bright central tower, river/water plane, bridges/roads and purple haze. Build:

1. Foreground: distinct nearby 3D towers with windows and cyan/magenta strips, spaced behind different panes.
2. Midground: lower towers and bridges with readable depth and water reflections.
3. Distant: hazy skyline and one bright landmark tower at lower contrast.
4. Ground/water: violet-lit river and linear traffic routes; no flat unlit backdrop.

The city is context for the interior benchmark. It must not occupy most of frame or become repeated cubes. REF-C is the dedicated window-view evidence target.

## Asset/evidence state at inspection

| Asset family | Files found | State |
|---|---|---|
| Bed | blend, preview, metadata, runtime GLB | ASSET PRODUCTION; model gate incomplete until render + in-game evidence |
| Sofa | blend, preview, metadata, runtime GLB | ASSET PRODUCTION; model gate incomplete |
| Desk | blend, preview, metadata (runtime path declared) | ASSET PRODUCTION; verify runtime file and screenshot |
| Ergonomic chair | blend, preview, metadata (runtime path declared) | ASSET PRODUCTION; verify runtime file and screenshot |
| Wardrobe | blend, metadata | ASSET PRODUCTION; no runtime GLB/preview found |
| Kitchen island/cabinets/stools | No dedicated hero asset registry found | NEEDS REWORK |
| Bathroom fixtures | No dedicated hero asset registry found | NEEDS REWORK |
| Rugs/plants/lighting/decor | No complete evidence bundle found | NEEDS REWORK |
| Architecture/city | Procedural/runtime scene components exist | VISUAL QA; judge from benchmark screenshots |

## Required evidence outputs

Produce game-rendered files under evidence/v18: reference.png (copy of REF-D), showcase-before.png, showcase-after.png, side-by-side.png, bed-closeup.png, sofa-closeup.png, desk-closeup.png, kitchen-closeup.png, window-view.png and starter-apartment.png. A component is not VERIFIED from a filename or metadata entry alone; it needs the asset file, material, dimensions, close-up render and successful runtime load.

## Current acceptance status

REF-D scene reconstruction: ASSET PRODUCTION / VISUAL QA. The reference is available and decomposed above. Bed, sofa, desk and chair source files exist but are not VERIFIED; kitchen, bathroom, decor and city-view evidence remain incomplete until rendered from current game.


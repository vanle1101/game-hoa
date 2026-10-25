import { DataTexture, RepeatWrapping, RGBAFormat } from "three";
import { getFurnitureDefinition, getFurnitureRecipe, type FurnitureMaterial, type FurniturePart, type FurnitureVector } from "../../furniture/catalog";

export type V12Surface = "linen" | "oak" | "stone" | "ceramic";
export type V12FurniturePart = FurniturePart & Readonly<{ tint?: string; finish?: V12Surface; contour?: "soft" | "drape" | "leaf" }>;
export type V12FurnitureRecipe = Readonly<{ id: string; parts: readonly V12FurniturePart[] }>;
export const V12_FURNITURE_IDS = ["cloud-bed", "platform-bed", "wardrobe", "workstation", "office-chair", "haven-sofa", "corner-sofa", "biolume-plant", "neon-floor-lamp", "tripod-lamp", "kitchen-island"] as const;
export const V12_FIXTURE_IDS = ["coffee-table", "bathroom-vanity", "bathroom-toilet", "bathroom-shower"] as const;
export type V12FixtureId = typeof V12_FIXTURE_IDS[number];

const box = (id: string, position: FurnitureVector, size: FurnitureVector, material: FurnitureMaterial = "finish", options: Partial<V12FurniturePart> = {}): V12FurniturePart => ({ id, shape: "box", position, size, material, ...options });
const form = (id: string, shape: FurniturePart["shape"], position: FurnitureVector, size: FurnitureVector, material: FurnitureMaterial = "metal", options: Partial<V12FurniturePart> = {}): V12FurniturePart => ({ ...box(id, position, size, material, options), shape });
const soft = (id: string, position: FurnitureVector, size: FurnitureVector, tint: string): V12FurniturePart => box(id, position, size, "fabric", { roundness: .42, contour: "soft", finish: "linen", tint });
const rail = (id: string, position: FurnitureVector, size: FurnitureVector): V12FurniturePart => box(id, position, size, "metal", { roundness: .4 });
const scaleParts = (parts: readonly V12FurniturePart[], scale: FurnitureVector): V12FurniturePart[] => parts.map(part => ({ ...part, position: part.position.map((value, i) => value * scale[i]) as [number, number, number], size: part.size.map((value, i) => value * scale[i]) as [number, number, number], ...(part.lean ? { lean: [part.lean[0] * scale[0], part.lean[1] * scale[2]] as const } : {}) }));

function bedding(platform: boolean): V12FurniturePart[] {
  const y = platform ? .5 : .4, w = platform ? .84 : .9;
  return [
    soft("v12-fitted-sheet", [0, y + .034, 0], [w + .012, .085, .89], "#ece8de"),
    { ...soft("v12-duvet", [0, y + .083, .155], [w - .01, .085, .57], "#768b98"), contour: "drape" },
    { ...soft("v12-folded-duvet", [0, y + .132, -.085], [w - .025, .055, .13], "#bdc9c7"), contour: "drape" },
    ...[-1, 1].flatMap(s => [
      soft(`v12-sleep-pillow-${s}`, [s * .21, y + .12, -.31], [.375, .13, .205], "#f3eee4"),
      soft(`v12-pillow-welt-${s}`, [s * .21, y + .113, -.31], [.381, .018, .212], "#d5d1c8"),
      soft(`v12-accent-pillow-${s}`, [s * .22, y + .193, -.24], [.22, .135, .14], s < 0 ? "#9b755e" : "#c4b397"),
    ]),
    ...[-1, 1].map(s => ({ ...soft(`v12-duvet-edge-${s}`, [s * (w / 2 - .018), y + .04, .17], [.04, .12, .53], "#768b98"), contour: "drape" as const })),
    ...Array.from({ length: 7 }, (_, i) => soft(`v12-quilt-seam-${i}`, [-.33 + i * .11, y + .128, .2], [.004, .004, .38], "#899ca5")),
    soft("v12-foot-throw", [0, y + .14, .34], [w + .015, .034, .17], "#bca68b"),
    ...Array.from({ length: 15 }, (_, i) => soft(`v12-throw-fringe-${i}`, [-w / 2 + .035 + i * (w - .07) / 14, y + .12, .438], [.008, .015, .06], "#cec0aa")),
  ];
}

function workstation(): V12FurniturePart[] {
  return [
    ...Array.from({ length: 4 }, (_, row) => Array.from({ length: 11 }, (_, col) => box(`v12-key-${row}-${col}`, [-.274 + col * .035, .572, .123 + row * .046], [.027, .014, .032], "paper", { roundness: .2, tint: row === 0 ? "#8c9c9c" : "#ced2cf" }))).flat(),
    box("v12-spacebar", [-.1, .572, .3], [.18, .014, .025], "paper", { roundness: .25 }),
    rail("v12-mouse-scroll", [.2, .567, .175], [.008, .011, .028]),
    box("v12-screen-wallpaper", [0, .84, -.237], [.585, .254, .005], "screen", { tint: "#163f50", surface: "display" }),
    box("v12-screen-sidebar", [-.24, .84, -.232], [.065, .23, .004], "screen", { tint: "#224e5c" }),
    ...Array.from({ length: 5 }, (_, i) => box(`v12-screen-line-${i}`, [-.025, .92 - i * .033, -.232], [.29 - (i % 3) * .045, .005, .004], "screen", { tint: i === 0 ? "#90bac2" : "#467887" })),
    form("v12-monitor-led", "sphere", [.275, .688, -.242], [.008, .005, .006], "glow", { tint: "#b9d3c2" }),
    form("v12-desk-cup", "cup", [-.4, .587, .25], [.066, .1, .14], "paper", { finish: "ceramic", radialSegments: 32 }),
    form("v12-cup-coffee", "cylinder", [-.4, .628, .25], [.052, .004, .11], "dark", { tint: "#3c2419" }),
    box("v12-notebook", [-.4, .538, -.03], [.13, .016, .28], "fabric", { tint: "#9b795b", roundness: .15 }),
    rail("v12-desk-pen", [-.4, .55, -.03], [.007, .007, .2]),
  ];
}

function wardrobe(): V12FurniturePart[] {
  return [
    box("v12-plinth", [0, .03, 0], [.87, .06, .85], "dark"),
    ...[-1, 1].flatMap(s => [
      box(`v12-door-panel-${s}`, [s * .24, .6, .476], [.414, .69, .018], "wood", { tint: "#98816c", finish: "oak", roundness: .12 }),
      ...[-1, 1].map(t => rail(`v12-handle-mount-${s}-${t}`, [s * .05, .58 + t * .07, .475], [.022, .018, .046])),
      ...[.29, .84].map(y => rail(`v12-hinge-${s}-${y}`, [s * .465, y, .46], [.025, .035, .045])),
    ]),
    box("v12-center-reveal", [0, .6, .473], [.012, .75, .008], "dark"),
    box("v12-top-crown", [0, .985, 0], [1, .03, .99], "wood", { finish: "oak" }),
  ];
}

function chair(): V12FurniturePart[] {
  return [
    ...Array.from({ length: 14 }, (_, i) => box(`v12-mesh-thread-${i}`, [-.26 + i * .04, .72, -.307], [.004, .35, .008], "fabric", { tint: "#78858a" })),
    soft("v12-lumbar-pad", [0, .6, -.265], [.46, .075, .09], "#4c5961"),
    rail("v12-back-spine", [0, .68, -.385], [.065, .42, .055]),
    rail("v12-seat-control", [.29, .4, .04], [.19, .018, .028]),
    form("v12-tension-dial", "sphere", [0, .36, .16], [.12, .075, .13], "dark"),
    ...Array.from({ length: 5 }, (_, i) => {
      const angle = i * Math.PI * 2 / 5;
      return rail(`v12-caster-fork-${i}`, [Math.sin(angle) * .4, .085, Math.cos(angle) * .4], [.05, .065, .06]);
    }),
  ];
}

function sofa(corner: boolean): V12FurniturePart[] {
  return [
    ...[-1, 1].map(s => soft(`v12-sofa-pillow-${s}`, [s * .29, .74, corner ? -.12 : -.03], [.21, .29, .14], s < 0 ? "#d3c1a3" : "#9faeaa")),
    { ...soft("v12-sofa-throw", [-.35, .575, corner ? -.07 : .12], [.15, .035, .42], "#b9a288"), contour: "drape" },
    soft("v12-sofa-throw-drop", [-.35, .45, corner ? .14 : .33], [.15, .24, .025], "#b9a288"),
    ...Array.from({ length: 8 }, (_, i) => soft(`v12-sofa-fringe-${i}`, [-.412 + i * .018, .325, corner ? .14 : .33], [.006, .04, .02], "#d1c0a5")),
  ];
}

function plant(): V12FurniturePart[] {
  return [
    form("v12-pot-rim", "ring", [0, .355, 0], [.79, .03, .79], "paper", { finish: "ceramic", tint: "#d0c3ad", radialSegments: 32 }),
    ...Array.from({ length: 9 }, (_, i) => {
      const a = i * 2.4, x = Math.sin(a), z = Math.cos(a), y = .48 + i * .046;
      return form(`v12-leaf-${i}`, "sphere", [x * .22, y, z * .22], [.36, .055, .24], "leaf", { contour: "leaf", tint: i % 2 ? "#507b55" : "#6d9465", rotation: [.1 * Math.cos(a), a, .12 * Math.sin(a)] });
    }),
    ...Array.from({ length: 9 }, (_, i) => {
      const a = i * 2.4;
      return { ...rail(`v12-leaf-stem-${i}`, [Math.sin(a) * .1, .45 + i * .046, Math.cos(a) * .1], [.014, .15, .014]), material: "leaf" as const, lean: [Math.sin(a) * .22, Math.cos(a) * .22] as const };
    }),
    ...Array.from({ length: 8 }, (_, i) => form(`v12-soil-stone-${i}`, "sphere", [Math.sin(i * 2.4) * .22, .38, Math.cos(i * 2.4) * .22], [.075, .035, .065], "wood", { tint: "#74634a" })),
  ];
}

function kitchen(): V12FurniturePart[] {
  return [
    box("v12-counter-left", [-.44, .87, 0], [.12, .06, 1], "paper", { finish: "stone" }),
    box("v12-counter-right", [.22, .87, 0], [.56, .06, 1], "paper", { finish: "stone" }),
    ...[-1, 1].map(s => box(`v12-counter-bridge-${s}`, [-.22, .87, s * .3875], [.32, .06, .225], "paper", { finish: "stone" })),
    form("v12-sink-bowl", "cup", [-.22, .8, 0], [.32, .2, .55], "metal", { radialSegments: 32 }),
    form("v12-sink-rim", "ring", [-.22, .904, 0], [.33, .014, .56], "metal", { radialSegments: 32 }),
    form("v12-sink-drain", "cylinder", [-.22, .735, 0], [.047, .008, .075], "dark"),
    box("v12-sink-cabinet-front", [-.22, .42, .462], [.43, .73, .025], "wood", { finish: "oak", roundness: .08 }),
    rail("v12-sink-cabinet-pull", [-.22, .68, .485], [.14, .02, .03]),
    rail("v12-tap-lever", [-.165, .945, -.3], [.08, .016, .028]),
    box("v12-knife-blade", [.26, .94, .04], [.02, .008, .23], "metal"),
    box("v12-knife-handle", [.26, .943, .21], [.026, .014, .12], "dark", { roundness: .4 }),
    ...[0, 1, 2].map(i => form(`v12-fruit-${i}`, "sphere", [.33 + (i % 2) * .055, .96, -.1 + i * .055], [.045, .07, .08], "finish", { tint: i === 1 ? "#acb164" : "#b8724b" })),
  ];
}

export function getV12FurnitureRecipe(id: string): V12FurnitureRecipe | undefined {
  const original = getFurnitureRecipe(id), definition = getFurnitureDefinition(id);
  if (!original || !definition) return undefined;
  if (!(V12_FURNITURE_IDS as readonly string[]).includes(id)) return original;
  let parts: V12FurniturePart[] = original.parts.map(part => ({ ...part, ...(part.material === "wood" ? { finish: "oak" as const } : {}), ...(["fabric", "cushion"].includes(part.material) ? { finish: "linen" as const, ...(part.roundness ? { contour: "soft" as const } : {}) } : {}) }));
  let details: V12FurniturePart[] = [];
  if (id === "cloud-bed" || id === "platform-bed") {
    parts = parts.filter(part => !/^(blanket|duvet-fold|pillow)/.test(part.id));
    details = bedding(id === "platform-bed");
  } else if (id === "wardrobe") details = wardrobe();
  else if (id === "workstation") { parts = parts.filter(part => !part.id.startsWith("key-row")); details = workstation(); }
  else if (id === "office-chair") details = chair();
  else if (id === "haven-sofa" || id === "corner-sofa") details = sofa(id === "corner-sofa");
  else if (id === "biolume-plant") { parts = parts.filter(part => !part.id.startsWith("leaf-")); details = plant(); }
  else if (id === "kitchen-island") {
    parts = parts.filter(part => !["counter", "sink", "sink-well", "cabinet"].includes(part.id));
    details = [...kitchen(), box("v12-cabinet-lower", [0, .36, 0], [.93, .72, .92], "wood", { finish: "oak" }), box("v12-cabinet-rear", [0, .78, -.43], [.93, .12, .06], "wood"), box("v12-cabinet-right", [.25, .78, 0], [.43, .12, .92], "wood")];
  } else if (id === "neon-floor-lamp") {
    details = [form("v12-base-trim", "ring", [0, .045, 0], [.9, .018, .9], "metal", { radialSegments: 32 }), form("v12-diffuser", "ring", [0, .94, 0], [1, .075, 1], "glow", { radialSegments: 32 }), rail("v12-power-switch", [0, .3, .052], [.06, .035, .02])];
    parts = parts.filter(part => part.id !== "light-ring");
  } else if (id === "tripod-lamp") details = [form("v12-socket-collar", "ring", [0, .755, 0], [.115, .045, .115], "gold", { radialSegments: 32 })];
  return { id, parts: [...parts, ...scaleParts(details, [definition.width, definition.height, definition.depth])] };
}

const fixtureRecipes: Record<V12FixtureId, () => V12FurniturePart[]> = {
  "coffee-table": () => [
    box("stone-top", [0, .48, 0], [1.2, .07, .65], "paper", { roundness: .4, finish: "stone", tint: "#c9c2af" }),
    ...[-1, 1].map(s => box(`oak-leg-${s}`, [s * .39, .225, 0], [.12, .45, .48], "wood", { finish: "oak", roundness: .15 })),
    box("lower-shelf", [0, .15, 0], [.87, .035, .44], "wood", { finish: "oak" }),
    box("book-cover", [-.25, .532, .02], [.28, .025, .32], "fabric", { tint: "#6e817b" }),
    box("book-pages", [-.25, .549, .02], [.26, .01, .3], "paper"),
    form("ceramic-bowl", "cup", [.27, .575, 0], [.23, .12, .23], "paper", { finish: "ceramic", radialSegments: 32 }),
  ],
  "bathroom-vanity": () => [
    box("oak-cabinet", [0, .44, 0], [1, .62, .48], "wood", { finish: "oak", roundness: .1 }),
    box("stone-counter", [0, .78, 0], [1.05, .06, .54], "paper", { finish: "stone", roundness: .15 }),
    form("ceramic-basin", "cup", [0, .89, .03], [.5, .19, .35], "paper", { finish: "ceramic", radialSegments: 32 }),
    form("basin-drain", "cylinder", [0, .835, .03], [.055, .008, .055], "metal"),
    rail("faucet-stem", [0, .94, -.2], [.035, .26, .035]), rail("faucet-spout", [0, 1.06, -.12], [.035, .035, .18]),
    ...[-1, 1].flatMap(s => [box(`door-${s}`, [s * .245, .44, .25], [.47, .58, .025], "wood", { finish: "oak" }), rail(`pull-${s}`, [s * .07, .58, .275], [.025, .13, .025]), rail(`foot-${s}`, [s * .4, .065, 0], [.05, .13, .35])]),
    box("mirror-frame", [0, 1.45, -.235], [.86, .65, .04], "metal", { roundness: .35 }),
    box("mirror", [0, 1.45, -.21], [.82, .61, .012], "metal", { surface: "mirror", roundness: .35 }),
    form("soap-dispenser", "cylinder", [.39, .9, 0], [.08, .17, .08], "paper", { finish: "ceramic" }), rail("soap-pump", [.39, 1, .01], [.055, .025, .07]),
  ],
  "bathroom-toilet": () => [
    form("pedestal", "sphere", [0, .2, .02], [.36, .4, .46], "paper", { finish: "ceramic" }),
    form("bowl", "cup", [0, .39, .1], [.43, .24, .58], "paper", { finish: "ceramic", radialSegments: 32 }),
    form("seat-ring", "ring", [0, .515, .1], [.46, .035, .6], "paper", { finish: "ceramic", radialSegments: 32 }),
    box("cistern", [0, .58, -.2], [.45, .48, .2], "paper", { finish: "ceramic", roundness: .24 }),
    box("cistern-lid", [0, .825, -.2], [.47, .03, .22], "paper", { finish: "ceramic", roundness: .3 }),
    form("flush-button", "cylinder", [0, .845, -.2], [.065, .015, .065], "metal"),
    box("seat-lid", [0, .68, -.075], [.42, .29, .035], "paper", { finish: "ceramic", roundness: .4 }),
    ...[-1, 1].map(s => rail(`hinge-${s}`, [s * .12, .53, -.075], [.065, .035, .05])),
  ],
  "bathroom-shower": () => [
    box("tray", [0, .04, 0], [.95, .08, .95], "paper", { finish: "ceramic", roundness: .3 }),
    ...[-1, 1].map(s => box(`tray-rim-${s}`, [s * .46, .09, 0], [.03, .03, .95], "paper", { finish: "ceramic" })),
    box("glass-panel", [-.46, 1.04, 0], [.012, 1.9, .9], "glass"),
    ...[-1, 1].map(s => rail(`glass-post-${s}`, [-.46, 1.04, s * .45], [.025, 1.92, .025])),
    rail("riser", [0, 1.15, -.42], [.035, 1.65, .035]), rail("shower-arm", [0, 1.97, -.24], [.035, .035, .38]),
    form("rain-head", "cylinder", [0, 1.94, -.06], [.28, .045, .28], "metal", { radialSegments: 32 }),
    ...Array.from({ length: 12 }, (_, i) => form(`nozzle-${i}`, "cylinder", [Math.sin(i * Math.PI / 6) * .1, 1.915, -.06 + Math.cos(i * Math.PI / 6) * .1], [.012, .012, .012], "dark")),
    rail("mixer", [0, .93, -.39], [.22, .045, .065]),
    form("drain", "cylinder", [.25, .083, .25], [.1, .008, .1], "metal"),
  ],
};

export function getV12FixtureRecipe(id: string): V12FurnitureRecipe | undefined {
  return Object.hasOwn(fixtureRecipes, id) ? { id, parts: fixtureRecipes[id as V12FixtureId]() } : undefined;
}

export function createV12SurfaceTexture(surface: V12Surface): DataTexture {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((x * 37 + y * 57 + x * y * 13) % 29) / 29;
    const value = surface === "linen" ? 130 + (x % 4 < 2 ? 32 : -12) + (y % 4 < 2 ? 26 : -12) + noise * 12
      : surface === "oak" ? 135 + Math.sin(x * .55 + Math.sin(y * .11) * 1.3) * 30 + noise * 18
        : surface === "stone" ? 165 + Math.sin(x * .09 + y * .12 + Math.sin(y * .17)) * 13 + noise * 8 : 190 + noise * 3;
    const offset = (y * size + x) * 4;
    data.set([value, value, value, 255], offset);
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(surface === "linen" ? 8 : 2, surface === "linen" ? 8 : 2);
  texture.needsUpdate = true;
  return texture;
}

export function getV12SurfaceProperties(part: V12FurniturePart, ghost = false) {
  return {
    ...(part.tint && !ghost ? { color: part.tint } : {}),
    ...(part.finish === "ceramic" ? { roughness: .22, metalness: .02 } : part.finish === "stone" ? { roughness: .48, metalness: .04 } : part.finish === "oak" ? { roughness: .62 } : {}),
    bumpScale: ghost ? 0 : part.finish === "linen" ? .008 : part.finish === "oak" ? .006 : .002,
  };
}

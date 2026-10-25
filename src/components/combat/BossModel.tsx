import * as THREE from "three";

type Vec = [number, number, number];
type Finish = "shell" | "edge" | "joint" | "recess" | "glow" | "trim";
type Profile = "torso" | "chest" | "shoulder" | "shin" | "helmet" | "fin";
export type BossPart = {
  id: string;
  position: Vec;
  rotation?: Vec;
  scale?: Vec;
  finish: Finish;
} & (
  | { kind: "plate"; profile: Profile; depth: number }
  | { kind: "box"; size: Vec }
  | { kind: "cylinder"; radii: [number, number]; height: number; segments: number }
  | { kind: "ring"; radius: number; tube: number }
);

const outlines: Record<Profile, [number, number][]> = {
  torso: [[-.42, -.5], [.42, -.5], [.74, .16], [.64, .5], [-.64, .5], [-.74, .16]],
  chest: [[-.34, .22], [.31, .16], [.26, -.08], [-.12, -.28], [-.34, -.12]],
  shoulder: [[-.44, -.12], [-.32, .25], [.22, .29], [.48, .02], [.3, -.26], [-.2, -.24]],
  shin: [[-.21, -.43], [.21, -.43], [.29, .28], [.16, .43], [-.16, .43], [-.29, .28]],
  helmet: [[-.24, -.25], [.24, -.25], [.29, .13], [.15, .3], [-.15, .3], [-.29, .13]],
  fin: [[-.08, -.2], [.08, -.2], [.04, .3]],
};
const profiles = Object.fromEntries(Object.entries(outlines).map(([name, points]) => [
  name, new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))),
])) as Record<Profile, THREE.Shape>;

export function bossPalette(theme: string, progress: number) {
  const sugar = /sugar|đường|ngọt/i.test(theme);
  const night = /midnight|khuya/i.test(theme);
  const phantom = /phantom|procrast|trì hoãn/i.test(theme) && !sugar;
  return {
    sugar, night, phantom,
    shell: sugar ? "#642d55" : night ? "#263c59" : "#353749",
    edge: progress > 65 ? "#6b7185" : sugar ? "#aa688f" : "#65748b",
    joint: "#192333", recess: "#090e19",
    glow: sugar ? "#ee5acb" : night ? "#5c8dff" : "#9067ff",
    trim: sugar ? "#ffb7df" : night ? "#8fcaff" : "#54d5e5",
  };
}

export function bossParts(theme: string): BossPart[] {
  const { sugar, night, phantom } = bossPalette(theme, 0);
  const parts: BossPart[] = [];
  const box = (id: string, position: Vec, size: Vec, finish: Finish, rotation?: Vec) => parts.push({ id, kind: "box", position, size, finish, rotation });
  const plate = (id: string, profile: Profile, position: Vec, scale: Vec, depth: number, finish: Finish, rotation?: Vec) => parts.push({ id, kind: "plate", profile, position, scale, depth, finish, rotation });
  const cylinder = (id: string, position: Vec, radii: [number, number], height: number, finish: Finish, rotation?: Vec, segments = 10) => parts.push({ id, kind: "cylinder", position, radii, height, finish, rotation, segments });
  plate("torso", "torso", [0, 2.12, -.32], [1, 1, 1], .64, "shell");
  box("waist-spine", [0, 1.57, 0], [.61, .5, .47], "joint");
  box("pelvis", [0, 1.34, .01], [1.1, .34, .55], "shell");
  for (let i = 0; i < 3; i++) box(`abdomen-rib-${i}`, [0, 1.57 + i * .13, .27], [.66 + i * .1, .065, .11], "edge");
  cylinder("neck", [0, 2.69, 0], [.17, .21], .33, "joint");
  plate("helmet", "helmet", [0, 2.99, -.21], [1, 1, 1], .43, "edge");
  box("visor-recess", [0, 3.025, .235], [.47, .14, .035], "recess");
  box("visor-inset", [0, 3.025, .258], [.35, .045, .014], "glow");
  box("visor-brow", [0, 3.11, .273], [.5, .055, .09], "shell");
  box("visor-bridge", [0, 3.01, .28], [.045, .12, .05], "shell");
  plate("jaw-guard", "helmet", [0, 2.84, .2], [.64, .45, 1], .09, "shell");
  cylinder("reactor-socket", [0, 2.18, .385], [.235, .235], .16, "recess", [Math.PI / 2, 0, 0], 12);
  parts.push({ id: "reactor-rim", kind: "ring", position: [0, 2.18, .475], radius: .18, tube: .045, finish: "edge" });
  cylinder("reactor-inset", [0, 2.18, .461], [.115, .115], .018, "glow", [Math.PI / 2, 0, 0], 12);
  box("reactor-divider", [0, 2.18, .49], [.035, .27, .045], "joint");
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? "left" : "right";
    plate(`${prefix}-chest`, "chest", [side * .36, 2.39, .3], [side, 1, 1], .17, "edge");
    box(`${prefix}-collar-inlay`, [side * .39, 2.54, .488], [.43, .035, .018], "glow", [0, 0, side * -.12]);
    cylinder(`${prefix}-shoulder-joint`, [side * .83, 2.42, 0], [.25, .25], .44, "joint", [0, 0, Math.PI / 2]);
    plate(`${prefix}-pauldron`, "shoulder", [side * 1.04, 2.5, -.24], [side, 1, 1], .54, "shell");
    plate(`${prefix}-pauldron-layer`, "shoulder", [side * 1.05, 2.58, .22], [side * .86, .67, 1], .13, "edge");
    box(`${prefix}-shoulder-inlay`, [side * 1.04, 2.69, .364], [.39, .035, .02], "glow", [0, 0, side * -.18]);
    box(`${prefix}-upper-arm`, [side * 1.2, 1.99, .01], [.31, .67, .34], "joint", [0, 0, side * -.13]);
    plate(`${prefix}-bicep-shell`, "shin", [side * 1.22, 2.02, .13], [.62, .6, 1], .14, "shell");
    cylinder(`${prefix}-elbow`, [side * 1.27, 1.66, .06], [.18, .18], .4, "edge", [0, 0, Math.PI / 2]);
    box(`${prefix}-forearm-frame`, [side * 1.31, 1.35, .11], [.29, .52, .34], "joint");
    plate(`${prefix}-gauntlet`, "shin", [side * 1.31, 1.4, .19], [.7, .58, 1], .23, "shell");
    box(`${prefix}-wrist`, [side * 1.31, 1.07, .14], [.22, .22, .26], "edge");
    box(`${prefix}-palm`, [side * 1.31, .91, .15], [.35, .27, .32], "shell");
    for (let f = 0; f < 3; f++) {
      box(`${prefix}-finger-${f}`, [side * (1.19 + f * .12), .74, .22], [.085, .22, .15], "edge", [.17, 0, 0]);
    }
    box(`${prefix}-thumb`, [side * 1.09, .88, .22], [.13, .22, .2], "joint", [0, 0, side * -.35]);
    box(`${prefix}-thigh-frame`, [side * .47, 1.08, 0], [.36, .58, .4], "joint");
    plate(`${prefix}-thigh-plate`, "shin", [side * .47, 1.12, .17], [.8, .55, 1], .18, "shell");
    cylinder(`${prefix}-knee`, [side * .52, .81, .07], [.2, .2], .43, "edge", [0, 0, Math.PI / 2]);
    box(`${prefix}-shin-frame`, [side * .56, .48, .02], [.32, .6, .36], "joint");
    plate(`${prefix}-shin-plate`, "shin", [side * .56, .49, .17], [.9, .72, 1], .19, "shell");
    plate(`${prefix}-knee-cap`, "shoulder", [side * .52, .81, .27], [.45, .5, 1], .15, "edge");
    box(`${prefix}-shin-channel`, [side * .56, .45, .375], [.12, .36, .035], "recess");
    box(`${prefix}-shin-inlay`, [side * .56, .45, .396], [.035, .29, .012], "trim");
    box(`${prefix}-foot`, [side * .58, .12, .17], [.6, .24, .78], "joint");
    box(`${prefix}-toe-cap`, [side * .58, .19, .36], [.55, .16, .39], "edge");
    plate(`${prefix}-head-fin`, "fin", [side * .2, 3.25, -.08], [side, night ? .45 : .65, 1], .13, sugar ? "glow" : "shell", [0, 0, side * -.17]);
    if (sugar) plate(`${prefix}-crystal-crest`, "fin", [side * 1.14, 2.84, .03], [side * 1.8, .8, 1], .18, "glow", [0, 0, side * -.4]);
    if (phantom) {
      box(`${prefix}-dorsal-mount`, [side * .51, 2.48, -.36], [.25, .4, .23], "joint");
      plate(`${prefix}-dorsal-fin`, "fin", [side * .56, 2.86, -.43], [side * 1.7, 1.5, 1], .17, "shell", [0, 0, side * -.18]);
      box(`${prefix}-dorsal-inlay`, [side * .56, 2.95, -.244], [.035, .25, .02], "glow", [0, 0, side * -.18]);
    }
  }
  return parts;
}

export function BossPartGeometry({ part }: { part: BossPart }) {
  switch (part.kind) {
    case "plate": return <extrudeGeometry args={[profiles[part.profile], { depth: part.depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .025, bevelThickness: .02, curveSegments: 1 }]}/>;
    case "box": return <boxGeometry args={part.size}/>;
    case "cylinder": return <cylinderGeometry args={[...part.radii, part.height, part.segments]}/>;
    case "ring": return <torusGeometry args={[part.radius, part.tube, 6, 16]}/>;
  }
}

export function BossModel({ theme, progress }: { theme: string; progress: number }) {
  const palette = bossPalette(theme, progress);
  return <group position={[1.8, .2, -1]} rotation={[0, -.25, 0]}>
    {bossParts(theme).map(part => <mesh key={part.id} name={part.id} position={part.position} rotation={part.rotation} scale={part.scale} castShadow>
      <BossPartGeometry part={part}/>
      <meshStandardMaterial color={palette[part.finish]} metalness={part.finish === "recess" ? .25 : .65} roughness={palette.sugar ? .3 : .43} emissive={part.finish === "glow" || part.finish === "trim" ? palette[part.finish] : "#000000"} emissiveIntensity={part.finish === "glow" ? 1.7 : part.finish === "trim" ? 1.2 : 0}/>
    </mesh>)}
  </group>;
}

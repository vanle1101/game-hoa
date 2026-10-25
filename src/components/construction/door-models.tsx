import { createElement } from "react";

export const DOOR_MODEL_IDS = [
  "door-standard", "door-sliding", "door-glass", "door-auto",
  "door-security", "door-neon", "door-louver", "door-craftsman",
] as const;
export type DoorModelId = typeof DOOR_MODEL_IDS[number];
export type DoorMotionKind = "hinged" | "sliding";
export type DoorMaterial = "finish" | "panel" | "metal" | "dark" | "glass" | "glow";
export type DoorPart = {
  id: string;
  shape: "box" | "cylinder";
  material: DoorMaterial;
  position: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number];
};
export type DoorRecipe = {
  id: DoorModelId;
  motion: DoorMotionKind;
  parts: DoorPart[];
  partCount: number;
  geometrySignature: string;
};

export function doorMotionKind(id: string): DoorMotionKind {
  return id === "door-auto" || id === "door-sliding" || id === "door-neon" ? "sliding" : "hinged";
}

export function getDoorRecipe(id: string, width = 1, height = 1): DoorRecipe | undefined {
  if (!(DOOR_MODEL_IDS as readonly string[]).includes(id)) return undefined;
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return undefined;
  const parts: DoorPart[] = [];
  const box = (name: string, material: DoorMaterial, x: number, y: number, w: number, h: number, depth = 0.055, z = 0) => {
    parts.push({ id: name, shape: "box", material, position: [x * width, y * height, z], size: [w * width, h * height, depth], rotation: [0, 0, 0] });
  };
  const region = (name: string, material: DoorMaterial, x0: number, y0: number, x1: number, y1: number, depth = 0.035, z = 0) =>
    box(name, material, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, depth, z);
  const rod = (name: string, x: number, y: number, length: number, z: number, radius = 0.012) => {
    const diameter = Math.min(radius * 2, width * 0.035);
    parts.push({ id: name, shape: "cylinder", material: "metal", position: [x * width, y * height, z], size: [diameter, length * height, diameter], rotation: [0, 0, 0] });
  };
  const frame = (stile: number, rail: number) => {
    region("hinge-stile", "finish", 0.025, 0.012, 0.025 + stile, 0.988);
    region("latch-stile", "finish", 0.975 - stile, 0.012, 0.975, 0.988);
    region("bottom-rail", "finish", 0.025 + stile, 0.012, 0.975 - stile, rail);
    region("top-rail", "finish", 0.025 + stile, 1 - rail, 0.975 - stile, 0.988);
  };
  const pull = (x: number, y: number, length: number) => {
    for (const side of [-1, 1]) {
      box(`pull-mount-${side}-low`, "metal", x, y - length / 2, 0.035, 0.018, 0.022, side * 0.039);
      box(`pull-mount-${side}-high`, "metal", x, y + length / 2, 0.035, 0.018, 0.022, side * 0.039);
      rod(`pull-${side}`, x, y, length, side * 0.055, 0.009);
    }
  };

  switch (id) {
    case "door-standard": {
      frame(0.09, 0.075);
      region("waist-rail", "finish", 0.115, 0.43, 0.885, 0.49, 0.055);
      region("lower-recessed-panel", "panel", 0.115, 0.075, 0.885, 0.43);
      region("upper-recessed-panel", "panel", 0.115, 0.49, 0.885, 0.925);
      for (const side of [-1, 1]) {
        box(`lock-plate-${side}`, "metal", 0.91, 0.46, 0.045, 0.09, 0.009, side * 0.032);
        box(`lever-neck-${side}`, "metal", 0.91, 0.48, 0.025, 0.018, 0.028, side * 0.045);
        box(`lever-${side}`, "metal", 0.86, 0.48, 0.12, 0.018, 0.015, side * 0.06);
      }
      break;
    }
    case "door-sliding": {
      frame(0.055, 0.065);
      for (let index = 0; index < 5; index++) {
        region(`vertical-board-${index}`, "panel", 0.08 + index * 0.168, 0.065, 0.08 + (index + 1) * 0.168 - 0.006, 0.935, 0.036);
      }
      for (const side of [-1, 1]) {
        for (const y of [0.23, 0.77]) box(`strap-${side}-${y}`, "metal", 0.5, y, 0.84, 0.032, 0.012, side * 0.025);
        box(`recessed-pull-${side}`, "dark", 0.88, 0.48, 0.06, 0.13, 0.008, side * 0.03);
        box(`pull-lip-${side}`, "metal", 0.9, 0.48, 0.013, 0.11, 0.014, side * 0.037);
      }
      for (const x of [0.19, 0.81]) box(`roller-carriage-${x}`, "metal", x, 0.963, 0.12, 0.035, 0.07);
      break;
    }
    case "door-glass": {
      frame(0.04, 0.045);
      region("full-height-glazing", "glass", 0.065, 0.045, 0.935, 0.955, 0.012);
      pull(0.87, 0.48, 0.24);
      break;
    }
    case "door-auto": {
      frame(0.065, 0.08);
      region("kick-plate", "metal", 0.09, 0.08, 0.91, 0.19, 0.045);
      region("service-spine", "finish", 0.68, 0.19, 0.73, 0.92, 0.055);
      region("wide-safety-glazing", "glass", 0.09, 0.19, 0.68, 0.92, 0.012);
      region("narrow-safety-glazing", "glass", 0.73, 0.19, 0.91, 0.92, 0.012);
      for (const side of [-1, 1]) {
        box(`sensor-housing-${side}`, "dark", 0.5, 0.95, 0.25, 0.035, 0.02, side * 0.035);
        box(`sensor-lens-${side}`, "glow", 0.5, 0.95, 0.08, 0.013, 0.008, side * 0.049);
        box(`safety-marking-${side}`, "metal", 0.385, 0.48, 0.55, 0.015, 0.006, side * 0.01);
      }
      pull(0.855, 0.47, 0.12);
      break;
    }
    case "door-security": {
      frame(0.105, 0.09);
      region("armor-left", "panel", 0.13, 0.09, 0.36, 0.91, 0.068);
      region("armor-right", "panel", 0.64, 0.09, 0.87, 0.91, 0.068);
      region("armor-bottom", "panel", 0.36, 0.09, 0.64, 0.66, 0.068);
      region("armor-header", "panel", 0.36, 0.84, 0.64, 0.91, 0.068);
      region("inspection-glass", "glass", 0.36, 0.66, 0.64, 0.84, 0.018);
      for (const x of [0.4, 0.5, 0.6]) box(`viewport-bar-${x}`, "metal", x, 0.75, 0.018, 0.18, 0.08);
      for (const y of [0.24, 0.4, 0.56]) box(`reinforcement-${y}`, "metal", 0.5, y, 0.8, 0.035, 0.083);
      for (const side of [-1, 1]) {
        box(`lock-case-${side}`, "dark", 0.87, 0.49, 0.075, 0.17, 0.024, side * 0.04);
        rod(`locking-rod-${side}`, 0.89, 0.5, 0.78, side * 0.042, 0.009);
      }
      pull(0.78, 0.49, 0.12);
      break;
    }
    case "door-neon": {
      frame(0.07, 0.065);
      region("lower-console", "dark", 0.095, 0.065, 0.905, 0.22, 0.045);
      for (const [index, limits] of [[0, [0.22, 0.48]], [1, [0.51, 0.72]], [2, [0.75, 0.935]]] as const) {
        region(`glazed-band-${index}`, "glass", 0.095, limits[0], 0.905, limits[1], 0.014);
      }
      for (const y of [0.495, 0.735]) box(`transom-${y}`, "finish", 0.5, y, 0.81, 0.03);
      for (const side of [-1, 1]) {
        for (const x of [0.06, 0.94]) box(`light-edge-${side}-${x}`, "glow", x, 0.5, 0.018, 0.91, 0.006, side * 0.031);
        box(`console-light-${side}`, "glow", 0.5, 0.14, 0.53, 0.018, 0.006, side * 0.026);
      }
      pull(0.86, 0.38, 0.16);
      break;
    }
    case "door-louver": {
      frame(0.09, 0.075);
      region("bottom-panel", "panel", 0.115, 0.075, 0.885, 0.32);
      region("vent-cross-rail", "finish", 0.115, 0.32, 0.885, 0.37, 0.055);
      for (let index = 0; index < 10; index++) {
        box(`vent-slat-${index}`, "panel", 0.5, 0.405 + index * 0.052, 0.77, 0.029, 0.026);
        parts[parts.length - 1].rotation[0] = Math.PI / 7;
      }
      pull(0.92, 0.45, 0.09);
      break;
    }
    case "door-craftsman": {
      frame(0.095, 0.075);
      region("glass-shelf", "finish", 0.12, 0.64, 0.88, 0.7, 0.065);
      for (let index = 0; index < 3; index++) {
        const x0 = 0.12 + index * 0.26;
        region(`upper-light-${index}`, "glass", x0, 0.7, x0 + 0.24, 0.925, 0.014);
        if (index < 2) region(`glazing-mullion-${index}`, "finish", x0 + 0.24, 0.7, x0 + 0.26, 0.925, 0.055);
      }
      region("panel-divider", "finish", 0.475, 0.075, 0.525, 0.64, 0.055);
      region("left-recess", "panel", 0.12, 0.075, 0.475, 0.64);
      region("right-recess", "panel", 0.525, 0.075, 0.88, 0.64);
      for (const side of [-1, 1]) {
        box(`shelf-bead-${side}`, "metal", 0.5, 0.67, 0.78, 0.017, 0.012, side * 0.036);
        box(`escutcheon-${side}`, "dark", 0.92, 0.47, 0.045, 0.12, 0.01, side * 0.034);
      }
      pull(0.92, 0.47, 0.08);
      break;
    }
  }
  if (doorMotionKind(id) === "hinged") {
    for (const [index, y] of [0.17, 0.5, 0.83].entries()) rod(`hinge-${index}`, 0.045, y, 0.045, 0, 0.014);
  }
  const geometrySignature = JSON.stringify(parts.map(({ shape, position, size, rotation }) => [shape, position, size, rotation]));
  return { id: id as DoorModelId, motion: doorMotionKind(id), parts, partCount: parts.length, geometrySignature };
}

export type DoorLeafModelProps = {
  catalogId: string;
  width: number;
  height: number;
  color: string;
  frameOpacity?: number;
  glassOpacity?: number;
};

export function DoorLeafModel({ catalogId, width, height, color, frameOpacity = 1, glassOpacity = 0.3 }: DoorLeafModelProps) {
  const recipe = getDoorRecipe(catalogId, width, height);
  if (!recipe) return null;
  const colors: Record<DoorMaterial, string> = {
    finish: color, panel: color, metal: "#a7b5bc", dark: "#24313e", glass: "#8dcbd7", glow: color,
  };
  const opacityFor = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  return createElement("group", { name: recipe.id, userData: { doorModelId: recipe.id, doorMotionKind: recipe.motion } },
    ...recipe.parts.map(part => {
      const glass = part.material === "glass";
      const glow = part.material === "glow";
      const opacity = opacityFor(glass ? glassOpacity : frameOpacity);
      return createElement("mesh", {
        key: part.id, name: part.id, position: part.position, rotation: part.rotation,
        castShadow: !glass && opacity === 1, receiveShadow: true,
        userData: { isOpeningGlass: glass, doorPart: part.id },
      },
      part.shape === "cylinder"
        ? createElement("cylinderGeometry", { args: [part.size[0] / 2, part.size[0] / 2, part.size[1], 12] })
        : createElement("boxGeometry", { args: part.size }),
      createElement("meshStandardMaterial", {
        color: colors[part.material], transparent: opacity < 1, opacity, depthWrite: opacity === 1,
        roughness: glass ? 0.09 : part.material === "panel" ? 0.7 : 0.34,
        metalness: glass ? 0.12 : part.material === "metal" ? 0.75 : 0.22,
        emissive: glow ? color : "#000000", emissiveIntensity: glow ? 1.4 : 0,
      }));
    }),
  );
}

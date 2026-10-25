"use client";

import { useId } from "react";
import { getEquipmentDefinition, getEquipmentRecipe, type EquipmentAnchor, type EquipmentMaterial, type EquipmentPart, type EquipmentRecipe } from "@/equipment/catalog";
import type { ItemDefinition, Rarity } from "@/domain/types";

const RARITY_COLOR: Record<Rarity, string> = {
  common: "#a7bed1",
  uncommon: "#69dcb1",
  rare: "#32e6f4",
  epic: "#9067ff",
  legendary: "#ffbc62",
  mythic: "#ee5acb",
};

const DISPLAY_ANCHORS: Record<EquipmentAnchor, [number, number, number]> = {
  rightHand: [0.2, 0, 0],
  leftHand: [-0.2, 0, 0],
  head: [0, 0.2, 0],
  torso: [0, -1.08, 0],
  leftArm: [-0.14, 0.56, 0],
  rightArm: [0.14, 0.56, 0],
  leftShin: [-0.1, 0.565, 0],
  rightShin: [0.1, 0.565, 0],
};

const SURFACE_PALETTE: Record<EquipmentMaterial, { fill: string; stroke: string; opacity?: number }> = {
  steel: { fill: "#708697", stroke: "#b5c7d6" },
  dark: { fill: "#263442", stroke: "#5c748a" },
  grip: { fill: "#19232b", stroke: "#465a6b" },
  edge: { fill: "#d1dce0", stroke: "#f3f9fc" },
  light: { fill: "#9de9f2", stroke: "#e8fcff" },
  gold: { fill: "#c5a162", stroke: "#f2d699" },
  cloth: { fill: "#3d5263", stroke: "#6c879d" },
  glass: { fill: "#73c7d9", stroke: "#c4f1fa", opacity: 0.78 },
};

type Vec3 = [number, number, number];

type ProjectedFace = {
  key: string;
  points: [number, number][];
  depth: number;
  material: EquipmentMaterial;
  fill: string;
  stroke: string;
  opacity: number;
  emissive: boolean;
};

export type ProjectedEquipmentArtwork = {
  itemId: string;
  signature: string;
  faces: ProjectedFace[];
  accent: string;
  rarityColor: string;
};

function rotateEulerXYZ([x, y, z]: Vec3, [rx, ry, rz]: Vec3): Vec3 {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y1 = y * cx - z * sx;
  const z1 = y * sx + z * cx;

  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x2 = x * cy + z1 * sy;
  const z2 = -x * sy + z1 * cy;

  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const x3 = x2 * cz - y1 * sz;
  const y3 = x2 * sz + y1 * cz;

  return [x3, y3, z2];
}

function getDisplayOffset(recipe: EquipmentRecipe, anchor: EquipmentAnchor): Vec3 {
  if (recipe.slot === "weapon" && recipe.category !== "dual") {
    return [0, 0, 0];
  }
  return DISPLAY_ANCHORS[anchor];
}

function createPartLocalFaces(part: EquipmentPart): Vec3[][] {
  const g = part.geometry;
  if (g.kind === "box") {
    const [w, h, d] = g.size;
    const hx = w / 2;
    const hy = h / 2;
    const hz = d / 2;
    const v: Vec3[] = [
      [-hx, -hy, -hz],
      [hx, -hy, -hz],
      [hx, hy, -hz],
      [-hx, hy, -hz],
      [-hx, -hy, hz],
      [hx, -hy, hz],
      [hx, hy, hz],
      [-hx, hy, hz],
    ];
    return [
      [v[4], v[5], v[6], v[7]],
      [v[1], v[0], v[3], v[2]],
      [v[3], v[7], v[6], v[2]],
      [v[0], v[1], v[5], v[4]],
      [v[5], v[1], v[2], v[6]],
      [v[0], v[4], v[7], v[3]],
    ];
  }

  if (g.kind === "prism") {
    const pts = g.outline;
    const hz = g.depth / 2;
    const front: Vec3[] = pts.map(([x, y]) => [x, y, hz]);
    const back: Vec3[] = pts
      .slice()
      .reverse()
      .map(([x, y]) => [x, y, -hz]);
    const faces: Vec3[][] = [front, back];
    for (let i = 0; i < pts.length; i += 1) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      faces.push([
        [x0, y0, hz],
        [x1, y1, hz],
        [x1, y1, -hz],
        [x0, y0, -hz],
      ]);
    }
    return faces;
  }

  if (g.kind === "cylinder") {
    const segs = Math.max(6, Math.min(8, g.segments ?? 8));
    const hy = g.height / 2;
    const topRing: Vec3[] = [];
    const bottomRing: Vec3[] = [];
    for (let i = 0; i < segs; i += 1) {
      const angle = (i / segs) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      topRing.push([c * g.radiusTop, hy, s * g.radiusTop]);
      bottomRing.push([c * g.radiusBottom, -hy, s * g.radiusBottom]);
    }
    const faces: Vec3[][] = [];
    for (let i = 0; i < segs; i += 1) {
      const next = (i + 1) % segs;
      faces.push([bottomRing[i]!, bottomRing[next]!, topRing[next]!, topRing[i]!]);
    }
    if (g.radiusTop > 0.001) {
      faces.push(topRing);
    }
    if (g.radiusBottom > 0.001) {
      faces.push(bottomRing.slice().reverse());
    }
    return faces;
  }

  if (g.kind === "sphere") {
    const r = g.radius;
    const maxTheta = g.thetaLength ?? Math.PI;
    const latSteps = 3;
    const lonSteps = 5;
    const faces: Vec3[][] = [];
    for (let i = 0; i < latSteps; i += 1) {
      const t0 = (i / latSteps) * maxTheta;
      const t1 = ((i + 1) / latSteps) * maxTheta;
      for (let j = 0; j < lonSteps; j += 1) {
        const p0 = (j / lonSteps) * Math.PI * 2;
        const p1 = ((j + 1) / lonSteps) * Math.PI * 2;
        const pt = (t: number, p: number): Vec3 => [
          r * Math.sin(t) * Math.cos(p),
          r * Math.cos(t),
          r * Math.sin(t) * Math.sin(p),
        ];
        faces.push([pt(t0, p0), pt(t0, p1), pt(t1, p1), pt(t1, p0)]);
      }
    }
    return faces;
  }

  const arc = g.arc ?? Math.PI * 2;
  const majorSteps = 8;
  const minorSteps = 4;
  const faces: Vec3[][] = [];
  for (let i = 0; i < majorSteps; i += 1) {
    const u0 = (i / majorSteps) * arc;
    const u1 = ((i + 1) / majorSteps) * arc;
    for (let j = 0; j < minorSteps; j += 1) {
      const v0 = (j / minorSteps) * Math.PI * 2;
      const v1 = ((j + 1) / minorSteps) * Math.PI * 2;
      const pt = (u: number, v: number): Vec3 => {
        const rr = g.radius + g.tube * Math.cos(v);
        return [rr * Math.cos(u), rr * Math.sin(u), g.tube * Math.sin(v)];
      };
      faces.push([pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)]);
    }
  }
  return faces;
}

function getCameraAngles(recipe: EquipmentRecipe): { yaw: number; pitch: number; roll: number } {
  if (recipe.slot === "weapon") {
    if (recipe.category === "dual") {
      return { yaw: 0.48, pitch: -0.26, roll: -0.32 };
    }
    if (recipe.category === "heavy") {
      return { yaw: 0.62, pitch: -0.24, roll: -0.46 };
    }
    return { yaw: 0.68, pitch: -0.22, roll: -0.52 };
  }
  if (recipe.slot === "head") {
    return { yaw: 0.46, pitch: -0.22, roll: 0 };
  }
  if (recipe.slot === "chest") {
    return { yaw: 0.38, pitch: -0.18, roll: 0 };
  }
  if (recipe.slot === "gloves" || recipe.slot === "boots") {
    return { yaw: 0.5, pitch: -0.24, roll: 0 };
  }
  return { yaw: 0.52, pitch: -0.28, roll: -0.12 };
}

function applyViewTransform(point: Vec3, angles: { yaw: number; pitch: number; roll: number }): Vec3 {
  const cy = Math.cos(angles.yaw);
  const sy = Math.sin(angles.yaw);
  const x1 = point[0] * cy + point[2] * sy;
  const z1 = -point[0] * sy + point[2] * cy;

  const cp = Math.cos(angles.pitch);
  const sp = Math.sin(angles.pitch);
  const y2 = point[1] * cp - z1 * sp;
  const z2 = point[1] * sp + z1 * cp;

  const cr = Math.cos(angles.roll);
  const sr = Math.sin(angles.roll);
  const x3 = x1 * cr - y2 * sr;
  const y3 = x1 * sr + y2 * cr;

  return [x3, y3, z2];
}

const PROJECTION_CACHE = new Map<string, ProjectedEquipmentArtwork>();

export function buildEquipmentArtworkProjection(item: ItemDefinition): ProjectedEquipmentArtwork {
  const cacheKey = `${item.id}:${item.rarity}`;
  const cached = PROJECTION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }
  const recipe = getEquipmentRecipe(item.id);
  const definition = getEquipmentDefinition(item.id);
  const rarityColor = RARITY_COLOR[item.rarity] ?? "#32e6f4";
  const accent = definition?.accent ?? rarityColor;

  if (!recipe) {
    const fallback: ProjectedEquipmentArtwork = {
      itemId: item.id,
      signature: `${item.id}:missing`,
      faces: [],
      accent,
      rarityColor,
    };
    PROJECTION_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  const angles = getCameraAngles(recipe);
  const rawFaces: {
    key: string;
    vertices: Vec3[];
    depth: number;
    material: EquipmentMaterial;
  }[] = [];

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  recipe.parts.forEach((part, partIndex) => {
    const anchorOffset = getDisplayOffset(recipe, part.anchor);
    const localFaces = createPartLocalFaces(part);
    localFaces.forEach((face, faceIndex) => {
      const transformed = face.map((vertex) => {
        const rotated = rotateEulerXYZ(vertex, part.rotation);
        const world: Vec3 = [
          rotated[0] + part.position[0] + anchorOffset[0],
          rotated[1] + part.position[1] + anchorOffset[1],
          rotated[2] + part.position[2] + anchorOffset[2],
        ];
        const viewed = applyViewTransform(world, angles);
        minX = Math.min(minX, viewed[0]);
        maxX = Math.max(maxX, viewed[0]);
        minY = Math.min(minY, viewed[1]);
        maxY = Math.max(maxY, viewed[1]);
        return viewed;
      });
      const depth = transformed.reduce((sum, v) => sum + v[2], 0) / transformed.length;
      rawFaces.push({
        key: `${part.id}-${partIndex}-${faceIndex}`,
        vertices: transformed,
        depth,
        material: part.material,
      });
    });
  });

  const spanX = Math.max(0.05, maxX - minX);
  const spanY = Math.max(0.05, maxY - minY);
  const scale = Math.min(188 / spanX, 188 / spanY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  rawFaces.sort((a, b) => a.depth - b.depth);

  const faces: ProjectedFace[] = rawFaces.map((face) => {
    const surface = SURFACE_PALETTE[face.material];
    const isAccent = face.material === "light" || face.material === "glass";
    const fill = isAccent ? accent : surface.fill;
    const stroke = isAccent ? "#e8fcff" : surface.stroke;
    const opacity = surface.opacity ?? 1;
    const points: [number, number][] = face.vertices.map(([vx, vy]) => [
      Number((150 + (vx - centerX) * scale).toFixed(1)),
      Number((148 - (vy - centerY) * scale).toFixed(1)),
    ]);
    return {
      key: face.key,
      points,
      depth: Number(face.depth.toFixed(4)),
      material: face.material,
      fill,
      stroke,
      opacity,
      emissive: face.material === "light",
    };
  });

  const signature = faces
    .map((f) => `${f.material}:${f.points.map((p) => `${p[0]},${p[1]}`).join(";")}`)
    .join("|");

  const result: ProjectedEquipmentArtwork = {
    itemId: item.id,
    signature,
    faces,
    accent,
    rarityColor,
  };
  PROJECTION_CACHE.set(cacheKey, result);
  return result;
}

export function EquipmentArtwork({ item, large = false }: { item: ItemDefinition; large?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const projection = buildEquipmentArtworkProjection(item);
  const { accent, rarityColor, faces } = projection;

  return (
    <svg
      className={`ref-item-art ${large ? "large" : ""}`}
      viewBox="0 0 300 300"
      role="img"
      aria-label={item.name}
      data-item-id={item.id}
      data-slot={item.slot}
    >
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop stopColor={accent} stopOpacity="0.26" />
          <stop offset="0.65" stopColor={rarityColor} stopOpacity="0.1" />
          <stop offset="1" stopColor={rarityColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="150" rx="128" ry="116" fill={`url(#${uid}-halo)`} />
      <ellipse cx="150" cy="262" rx="84" ry="12" fill="#030912" opacity="0.62" />
      <ellipse cx="150" cy="261" rx="74" ry="9" fill="none" stroke={accent} opacity="0.38" />
      <g strokeLinejoin="round" strokeLinecap="round">
        {faces.map((face) => (
          <polygon
            key={face.key}
            points={face.points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill={face.fill}
            fillOpacity={face.opacity}
            stroke={face.stroke}
            strokeWidth={face.emissive ? 1.5 : 0.95}
            strokeOpacity={face.emissive ? 0.95 : 0.72}
          />
        ))}
      </g>
    </svg>
  );
}

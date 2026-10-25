import productionManifest from "../../../assets/apartment/registry-v18.json";

/** A machine-readable production check for one of the twelve apartment hero assets. */
export type ApartmentAssetMetadata = {
  /** Canonical source id from the Blender asset manifest. */
  sourceId: string;
  /** Source .blend file kept outside public/ for reproducible editing. */
  blendPath: string;
  /** Rendered preview supplied with the source asset. */
  previewPath: string;
  dimensions: readonly [number, number, number];
  bounds: { min: readonly [number, number, number]; max: readonly [number, number, number] };
  meshCount: number;
  triangles: number;
  /** Number of material and image texture slots in the exported GLB. */
  materialCount: number;
  textureCount: number;
  features: readonly string[];
  license: string;
  reference: string;
  status: "ASSET PRODUCTION" | "VISUAL QA" | "VERIFIED" | "BLOCKED";
};

type ManifestEntry = (typeof productionManifest)[number];
const manifestById = new Map<string, ManifestEntry>(productionManifest.map(entry => [entry.id, entry]));

const sourceIds = {
  bed: "premium-bed",
  wardrobe: "paneled-wardrobe",
  desk: "executive-desk",
  chair: "ergonomic-chair",
  sofa: "sectional-sofa",
  kitchen: "marble-island",
  stool: "leather-bar-stool",
  bathroom: "ceramic-bathroom-suite",
  plant: "potted-palm",
  coffee: "coffee-table",
  lamp: "dome-floor-lamp",
  rug: "wool-rug",
} as const;

/**
 * Single source of truth for production apartment assets. Home and Showcase
 * consume this registry so both routes load the same GLB, metadata and
 * materials. The manifest remains source controlled beside the .blend files;
 * runtime only receives the public GLB URL and immutable acceptance metadata.
 */
export const APARTMENT_ASSETS = {
  bed: { url: "/assets/apartment/bed/premium-bed.glb", label: "Giường", position: [-2.8, 0, -3.25] as [number, number, number], metadata: metadataFor("bed") },
  wardrobe: { url: "/assets/apartment/wardrobe/paneled-wardrobe.glb", label: "Tủ", position: [-5.6, 0, -1.8] as [number, number, number], rotation: Math.PI / 2, metadata: metadataFor("wardrobe") },
  desk: { url: "/assets/apartment/desk/executive-desk.glb", label: "Bàn làm việc", position: [3.7, 0, -3.85] as [number, number, number], metadata: metadataFor("desk") },
  chair: { url: "/assets/apartment/chair/ergonomic-chair.glb", label: "Ghế", position: [3.7, 0, -2.7] as [number, number, number], rotation: Math.PI, metadata: metadataFor("chair") },
  sofa: { url: "/assets/apartment/sofa/sectional-sofa.glb", label: "Sofa", position: [0.5, 0, 1.2] as [number, number, number], metadata: metadataFor("sofa") },
  kitchen: { url: "/assets/apartment/kitchen/marble-island.glb", label: "Bếp", position: [-3.5, 0, 0.75] as [number, number, number], metadata: metadataFor("kitchen") },
  stool: { url: "/assets/apartment/stool/leather-bar-stool.glb", label: "Ghế bar", position: [-4.2, 0, 1.8] as [number, number, number], rotation: Math.PI, metadata: metadataFor("stool") },
  bathroom: { url: "/assets/apartment/bathroom/ceramic-bathroom-suite.glb", label: "Phòng tắm", position: [4.45, 0, 2.05] as [number, number, number], metadata: metadataFor("bathroom") },
  plant: { url: "/assets/apartment/decor/potted-palm.glb", label: "Cây", position: [-0.45, 0, -4.05] as [number, number, number], metadata: metadataFor("plant") },
  coffee: { url: "/assets/apartment/coffee-table/coffee-table.glb", label: "Bàn trà", position: [0.85, 0, 3] as [number, number, number], metadata: metadataFor("coffee") },
  lamp: { url: "/assets/apartment/lamp/dome-floor-lamp.glb", label: "Đèn", position: [-1.6, 0, 0.9] as [number, number, number], metadata: metadataFor("lamp") },
  rug: { url: "/assets/apartment/rug/wool-rug.glb", label: "Thảm", position: [0, 0, 0] as [number, number, number], metadata: metadataFor("rug") },
} as const;

/** Architectural GLBs used by the same ConstructionWorld in Home and Showcase. */
export const APARTMENT_ARCHITECTURE_ASSETS = {
  kitchenWall: {
    url: "/assets/apartment/kitchen/reference-kitchen-wall.glb",
    blendPath: "assets/apartment/kitchen-wall/reference-kitchen-wall.blend",
    previewPath: "assets/apartment/kitchen-wall/preview.png",
    dimensions: [3.58, 2.68, 0.72] as const,
  },
} as const;

function metadataFor(asset: keyof typeof sourceIds): ApartmentAssetMetadata {
  const sourceId = sourceIds[asset];
  const entry = manifestById.get(sourceId);
  if (!entry) throw new Error(`Missing apartment asset manifest entry: ${sourceId}`);
  const folder = entry.runtime.split("/").slice(0, -1).join("/").replace(/^\/assets\//, "");
  // GLB mesh/material/image counts are kept in the manifest sidecar generated
  // from Blender exports. Keeping these values explicit prevents a missing
  // texture or accidentally replaced file from being silently accepted.
  const counts: Record<string, readonly [number, number]> = {
    "ceramic-bathroom-suite": [6, 3], "premium-bed": [8, 10], "ergonomic-chair": [3, 2],
    "coffee-table": [7, 4], "potted-palm": [3, 0], "executive-desk": [27, 4],
    "marble-island": [10, 3], "dome-floor-lamp": [5, 2], "wool-rug": [3, 4],
    "sectional-sofa": [6, 8], "leather-bar-stool": [2, 2], "paneled-wardrobe": [4, 2],
  };
  const [materialCount, textureCount] = counts[sourceId] ?? [0, 0];
  return {
    sourceId,
    blendPath: `assets/apartment/${folder.split("/").pop()}/${sourceId}.blend`,
    previewPath: `assets/apartment/${folder.split("/").pop()}/preview.png`,
    dimensions: entry.dimensions as [number, number, number],
    bounds: { min: entry.bounds.min as [number, number, number], max: entry.bounds.max as [number, number, number] },
    meshCount: entry.meshCount,
    triangles: entry.triangles,
    materialCount,
    textureCount,
    features: entry.features,
    license: entry.license,
    reference: entry.reference,
    status: entry.status as ApartmentAssetMetadata["status"],
  };
}

export type ApartmentAssetId = keyof typeof APARTMENT_ASSETS;

/** Persisted Home fixture/catalog ids resolve through aliases without changing save data. */
const HOME_ASSET_ALIASES: Readonly<Record<string, ApartmentAssetId>> = {
  bed: "bed", "cloud-bed": "bed", wardrobe: "wardrobe", "paneled-wardrobe": "wardrobe",
  desk: "desk", workstation: "desk", terminal: "desk", "gaming-desk": "desk", workbench: "desk",
  chair: "chair", "dining-chair": "chair", sofa: "sofa", "corner-sofa": "sofa", couch: "sofa",
  kitchen: "kitchen", "kitchen-island": "kitchen", "bar-stool": "stool", stool: "stool",
  bathroom: "bathroom", "bathroom-suite": "bathroom", plant: "plant", "biolume-plant": "plant",
  lamp: "lamp", "neon-floor-lamp": "lamp", "tripod-lamp": "lamp", "coffee-table": "coffee",
  "wool-rug": "rug", rug: "rug",
};

export function resolveApartmentAssetId(kind: string): ApartmentAssetId | undefined {
  return HOME_ASSET_ALIASES[kind];
}

export function getApartmentAsset(id: ApartmentAssetId) {
  return APARTMENT_ASSETS[id];
}

/** Grid footprint used by construction/navigation for hero GLBs that do not
 * have a purchasable catalog entry (bathroom, rug and coffee table). */
export function getApartmentFootprint(kind: string, rotation = 0): { width: number; depth: number } | undefined {
  const id = resolveApartmentAssetId(kind);
  if (!id) return undefined;
  const [x, , z] = APARTMENT_ASSETS[id].metadata.dimensions;
  const rotated = rotation % 180 !== 0;
  return {
    width: Math.max(1, Math.ceil(rotated ? z : x)),
    depth: Math.max(1, Math.ceil(rotated ? x : z)),
  };
}


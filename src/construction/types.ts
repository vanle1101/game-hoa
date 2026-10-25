/** Cells occupy [x,x+1] × [z,z+1]; world Y is level * LEVEL_HEIGHT. */
export interface GridPoint { x: number; z: number; level: number; }
export interface FloorCell extends GridPoint { materialId: string; }
/** x edges run (x,z)→(x+1,z); z edges run (x,z)→(x,z+1). */
export interface WallSegment extends GridPoint { orientation: "x" | "z"; materialId: string; opening?: { kind: "door" | "window"; catalogId: string }; }
export interface BuildingFurniture extends GridPoint {
  id: string;
  furnitureId: string;
  rotation: 0 | 90 | 180 | 270;
  neonColor?: string;
  placementType?: "floor" | "wall" | "ceiling" | "wall_insert";
  /** Stable wall edge and position along that one-meter segment. */
  wall_id?: string;
  wall_u?: number;
  /** LotObject-compatible fields. Optional so saves made before this migration still load. */
  object_def_guid?: string;
  transform?: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } };
  parent_id?: string;
  slot_hash?: string;
  scale?: number;
  light_color?: string;
  light_dimmer_value?: number;
  wallNormal?: [number, number, number];
  wallY?: number;
  ceilingY?: number;
}
/** A persisted, orthogonal neon strip drawn in Build Mode. */
export interface LedStrip {
  id: string;
  start: GridPoint;
  end: GridPoint;
  color: string;
}
export interface StairSegment extends GridPoint { orientation: "x" | "z"; catalogId: string; }
export interface SurfaceCell extends GridPoint { materialId: string; }
export const CURVE_MATERIALS = ["clear", "blue", "violet", "frosted", "smoke"] as const;
export const CURVE_FRAMES = ["aluminium", "graphite", "brass"] as const;
export type CurveMaterial = typeof CURVE_MATERIALS[number];
export type CurveFrame = typeof CURVE_FRAMES[number];
export interface CurveProfile { radius: number; angle: number; thickness: number; height: number; material: string; frame: string; }
export interface CurvedGlassSegment extends GridPoint, CurveProfile { id: string; catalogId: string; rotation: number; }
export interface BuildingPlan { curves?: CurvedGlassSegment[]; ledStrips?: LedStrip[]; floors: FloorCell[]; walls: WallSegment[]; furniture: BuildingFurniture[]; stairs: StairSegment[]; ceilings: SurfaceCell[]; roofs: SurfaceCell[]; roomNames: Record<string, string>; }
export interface Plot { minX: number; maxX: number; minZ: number; maxZ: number; maxLevel: number; cellSize: number; }
export interface RoomRegion { id: string; level: number; cells: GridPoint[]; area: number; enclosed: boolean; name: string; }
export interface BuildingFoundation { version: 9; mode: "fixed-apartment" | "legacy-preserved"; }
export interface BuildingState { version: 1; foundation?: BuildingFoundation; revision: number; plot: Plot; plan: BuildingPlan; paid: Record<string, number>; starterGrantApplied: boolean; migratedAt: string; legacyPlacementsPreserved: boolean; }
export interface ConstructionQuote { added: number; removed: number; cost: number; refund: number; netCost: number; remainingGold: number; insufficientGold: number; paid: Record<string, number>; }
export interface ConstructionContext { gold: number; characterLevel: number; ownedFurniture: Record<string, number>; defeatedCampaign: boolean; }
export interface BuildingCatalogItem { id: string; name: string; category: "floor" | "wall" | "door" | "window" | "ceiling" | "roof" | "stairs" | "curve"; curve?: CurveProfile; price: number; level: number; color: string; description: string; height?: number; thickness?: number; openingWidth?: number; openingHeight?: number; sill?: number; campaignUnlock?: boolean; }

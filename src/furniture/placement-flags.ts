/** Browser-side subset of the Build/Buy placement rules. Values matching the
 * reference flags are kept stable; FLOOR_ONLY is our explicit default bit. */
export const PlacementFlags = Object.freeze({
  CENTER_ON_WALL: 1,
  EDGE_AGAINST_WALL: 2,
  ADJUST_HEIGHT_ON_WALL: 4,
  CEILING: 8,
  SHOW_OBJ_IF_WALL_DOWN: 256,
  REQUIRES_SLOT: 1024,
  GROUNDED_AGAINST_WALL: 16777216,
  FLOOR_ONLY: 33554432,
  SNAP_TO_WALL: 1 | 4,
} as const);

export function hasPlacementFlag(flags: number, flag: number): boolean {
  return (flags & flag) === flag;
}

export function placementTypeForFlags(flags: number): "floor" | "wall" | "ceiling" {
  if (hasPlacementFlag(flags, PlacementFlags.CEILING)) return "ceiling";
  if (hasPlacementFlag(flags, PlacementFlags.CENTER_ON_WALL) || hasPlacementFlag(flags, PlacementFlags.EDGE_AGAINST_WALL)) return "wall";
  return "floor";
}

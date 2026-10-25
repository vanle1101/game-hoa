import { z } from "zod";
import { CURVE_PROFILE_LIMITS } from "./curves";
import { CURVE_FRAMES, CURVE_MATERIALS } from "./types";
const coordinate = z.number().int().min(-32).max(32), level = z.number().int().min(0).max(2), id = z.string().min(1).max(150);
const neonColor = z.string().regex(/^#[0-9a-f]{6}$/i);
const point = { x: coordinate, z: coordinate, level };
const surface = z.object({ ...point, materialId: id }).strict();
export const curvedGlassSchema = z.object({ ...point, id, catalogId: id, rotation: z.number().int().min(0).max(345).multipleOf(15), radius: z.number().finite().min(CURVE_PROFILE_LIMITS.radius.min).max(CURVE_PROFILE_LIMITS.radius.max), angle: z.number().finite().min(CURVE_PROFILE_LIMITS.angle.min).max(CURVE_PROFILE_LIMITS.angle.max).multipleOf(CURVE_PROFILE_LIMITS.angle.step), thickness: z.number().finite().min(CURVE_PROFILE_LIMITS.thickness.min).max(CURVE_PROFILE_LIMITS.thickness.max), height: z.number().finite().min(CURVE_PROFILE_LIMITS.height.min).max(CURVE_PROFILE_LIMITS.height.max), material: z.enum(CURVE_MATERIALS), frame: z.enum(CURVE_FRAMES) }).strict();
export const buildingPlanSchema = z.object({
  curves: z.array(curvedGlassSchema).max(128).optional(),
  ledStrips: z.array(z.object({ id, start: z.object(point).strict(), end: z.object(point).strict(), color: neonColor }).strict()).max(256).optional(),
  floors: z.array(surface).max(1600),
  walls: z.array(z.object({ ...point, orientation: z.enum(["x", "z"]), materialId: id, opening: z.object({ kind: z.enum(["door", "window"]), catalogId: id }).strict().optional() }).strict()).max(3200),
  furniture: z.array(z.object({ ...point, id, furnitureId: id, rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]), neonColor: neonColor.optional(), placementType: z.enum(["floor", "wall", "ceiling", "wall_insert"]).optional(), wall_id: id.optional(), wall_u: z.number().finite().min(0).max(1).optional(), object_def_guid: id.optional(), transform: z.object({ position: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict(), rotation: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict() }).strict().optional(), parent_id: id.optional(), slot_hash: id.optional(), scale: z.number().finite().min(0.1).max(4).optional(), light_color: neonColor.optional(), light_dimmer_value: z.number().finite().min(0).max(5).optional(), wallNormal: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).optional(), wallY: z.number().finite().min(0).max(10).optional(), ceilingY: z.number().finite().min(0).max(10).optional() }).strict()).max(200),
  stairs: z.array(z.object({ ...point, orientation: z.enum(["x", "z"]), catalogId: id }).strict()).max(40),
  ceilings: z.array(surface).max(1600), roofs: z.array(surface).max(1600),
  roomNames: z.record(z.string().max(150), z.string().trim().min(1).max(80)).refine((value) => Object.keys(value).length <= 200),
}).strict();
export const buildingStateSchema = z.object({
  version: z.literal(1), foundation: z.object({ version: z.literal(9), mode: z.enum(["fixed-apartment", "legacy-preserved"]) }).strict().optional(), revision: z.number().int().nonnegative().safe(),
  plot: z.object({ minX: coordinate, maxX: coordinate, minZ: coordinate, maxZ: coordinate, maxLevel: level, cellSize: z.literal(1) }).strict().refine(plot=>plot.minX<plot.maxX&&plot.minZ<plot.maxZ,"Invalid plot dimensions"),
  plan: buildingPlanSchema, paid: z.record(z.string().max(300), z.number().int().nonnegative().safe()), starterGrantApplied: z.boolean(), migratedAt: z.iso.datetime(), legacyPlacementsPreserved: z.boolean(),
}).strict();

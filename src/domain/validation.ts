import { z } from "zod";
import type { Action } from "./types";
import { buildingPlanSchema } from "../construction/schema";
import { bossActionSchemas } from "../boss/schema";
import { appearanceSchema, characterActionSchemas } from "../character/schema";
const id = z.string().min(1).max(240);
const neonColor = z.string().regex(/^#[0-9a-f]{6}$/i);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(`${value}T12:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }, "Choose a real calendar date.");
const date = dateSchema;
export const timezoneSchema = z.string().min(1).max(80).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; } }, "Choose a valid timezone.");
const slot = z.enum(["weapon", "head", "chest", "gloves", "boots", "accessory1", "accessory2", "relic"]);
export const taskInputSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(2000).optional(), kind: z.enum(["once", "daily", "weekly", "habit", "negative-habit", "campaign", "farming", "recovery"]).optional(), difficulty: z.enum(["easy", "medium", "hard", "epic"]).optional(), skill: z.enum(["health", "knowledge", "career", "finance", "relationships", "creativity"]).optional(), targetSkillId: id.nullable().optional(), xpReward: z.number().int().min(1).max(1000000).optional(), duration: z.number().int().min(1).max(240).optional(), dueDate: date.optional(), timezone: timezoneSchema.optional(), committed: z.boolean().optional(), campaignId: id.optional(), bossId: id.optional(), priority: z.enum(["low", "normal", "high"]).optional(), checklist: z.array(z.string().trim().min(1).max(120)).max(30).optional() }).strict();
export const taskEditSchema = taskInputSchema.partial().refine((value) => Object.keys(value).length > 0, "Change at least one quest field.");
const settings = z.object({ hardcore: z.boolean().optional(), equipmentLossAccepted: z.boolean().optional(), timezone: timezoneSchema.optional(), restDays: z.array(date).max(366).optional(), graphics: z.enum(["ultra", "high", "balanced", "performance"]).optional(), reducedMotion: z.boolean().optional(), focusWorkMinutes: z.union([z.literal(15), z.literal(25), z.literal(45), z.literal(60)]).optional(), focusBreakMinutes: z.union([z.literal(3), z.literal(5), z.literal(10), z.literal(15)]).optional() }).strict();
export const actionSchema: z.ZodType<Action> = z.discriminatedUnion("type", [
  ...bossActionSchemas,
  ...characterActionSchemas,
  z.object({ type: z.literal("housing.settle"), districtId: z.literal("district07"), buildingId: id, floor: z.union([z.literal(8), z.literal(16), z.literal(24)]), layoutId: z.enum(["studio", "one-bedroom", "open-plan"]) }).strict(),
  z.object({ type: z.literal("focus.start"), occurrenceId: id, plannedMinutes: z.number().int().min(1).max(240).optional() }).strict(),
  z.object({ type: z.literal("focus.end"), sessionId: id }).strict(),
  z.object({ type: z.literal("focus.confirm"), sessionId: id, confirmed: z.literal(true) }).strict(),
  z.object({ type: z.literal("focus.cancel"), sessionId: id }).strict(),
  z.object({ type: z.literal("construction.commit"), expectedRevision: z.number().int().nonnegative(), plan: buildingPlanSchema }).strict(),
  z.object({ type: z.literal("task.create"), task: taskInputSchema }).strict(),
  z.object({ type: z.literal("task.edit"), taskId: id, task: taskEditSchema }).strict(),
  z.object({ type: z.literal("task.complete"), occurrenceId: id }).strict(),
  z.object({ type: z.literal("task.checklist"), taskId: id, checklistId: id, done: z.boolean() }).strict(),
  z.object({ type: z.literal("task.reschedule"), taskId: id, dueDate: date }).strict(),
  z.object({ type: z.literal("task.cancel"), occurrenceId: id }).strict(),
  z.object({ type: z.literal("task.archive"), taskId: id }).strict(),
  z.object({ type: z.literal("reconcile") }).strict(), z.object({ type: z.literal("undo") }).strict(),
  z.object({ type: z.literal("boss.select"), encounterId: id }).strict(), z.object({ type: z.literal("boss.start"), definitionId: id }).strict(),
  z.object({ type: z.literal("item.equip"), itemId: id, slot: slot.optional() }).strict(), z.object({ type: z.literal("item.unequip"), slot }).strict(),
  z.object({ type: z.literal("item.buy"), definitionId: id }).strict(), z.object({ type: z.literal("item.upgrade"), itemId: id }).strict(), z.object({ type: z.literal("item.craft"), recipeId: id }).strict(),
  z.object({ type: z.literal("furniture.buy"), furnitureId: id, neonColor: neonColor.optional() }).strict(), z.object({ type: z.literal("furniture.sell"), furnitureId: id, placementId: id.optional() }).strict(), z.object({ type: z.literal("furniture.place"), furnitureId: id, placementId: id.optional(), roomId: id, x: z.number().finite().min(-100).max(100), z: z.number().finite().min(-100).max(100), rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]), neonColor: neonColor.optional() }).strict(), z.object({ type: z.literal("furniture.remove"), placementId: id }).strict(),
  z.object({ type: z.literal("room.unlock"), roomId: id }).strict(), z.object({ type: z.literal("pet.adopt"), petId: id, name: z.string().min(1).max(40).optional() }).strict(), z.object({ type: z.literal("pet.care"), petId: id }).strict(),
  z.object({ type: z.literal("pet.select"), petId: id }).strict(),
  z.object({ type: z.literal("pet.accessory.buy"), accessoryId: id }).strict(),
  z.object({ type: z.literal("pet.accessory.equip"), petId: id, accessoryId: id }).strict(),
  z.object({ type: z.literal("pet.accessory.remove"), petId: id }).strict(),
  z.object({ type: z.literal("consumable.buy"), consumableId: id }).strict(),
  z.object({ type: z.literal("consumable.consume"), consumableId: id }).strict(),
  z.object({ type: z.literal("reward.create"), name: z.string().trim().min(1).max(100), description: z.string().max(500).optional(), cost: z.number().int().min(1).max(1000000) }).strict(),
  z.object({ type: z.literal("reward.redeem"), rewardId: id }).strict(),
  z.object({ type: z.literal("reward.archive"), rewardId: id }).strict(),
  z.object({ type: z.literal("skill.unlock"), nodeId: id }).strict(), z.object({ type: z.literal("career.select"), careerId: id }).strict(), z.object({ type: z.literal("career.promote") }).strict(),
  z.object({ type: z.literal("campaign.create"), title: z.string().min(1).max(120), description: z.string().max(2000).optional(), tasks: z.array(taskInputSchema).min(1).max(30) }).strict(),
  z.object({ type: z.literal("character.rename"), name: z.string().trim().min(1).max(40) }).strict(), z.object({ type: z.literal("character.update"), name: z.string().trim().min(1).max(40).optional(), skin: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), outfit: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), hair: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), hairstyle: z.enum(["short", "swept", "mohawk"]).optional(), appearance: appearanceSchema.partial().optional() }).strict(), z.object({ type: z.literal("character.rest") }).strict(),
  z.object({ type: z.literal("settings.update"), settings }).strict(),
]);

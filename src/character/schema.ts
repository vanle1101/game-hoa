import { z } from "zod";
export const appearanceSchema = z.object({ presentation: z.enum(["masculine", "feminine", "neutral"]).optional(), body: z.enum(["balanced", "slim", "athletic"]), face: z.enum(["oval", "angular", "round"]), eyes: z.enum(["soft", "focused", "wide"]), eyeColor: z.string().regex(/^#[0-9a-f]{6}$/i), eyebrows: z.enum(["natural", "straight", "arched"]), nose: z.enum(["soft", "straight", "wide"]), mouth: z.enum(["neutral", "smile", "full"]), height: z.number().min(0.85).max(1.15), shoulderWidth: z.number().min(0.8).max(1.2), facePreset: z.number().int().min(0).max(5).optional(), eyePreset: z.number().int().min(0).max(5).optional(), browPreset: z.number().int().min(0).max(5).optional(), nosePreset: z.number().int().min(0).max(5).optional(), earPreset: z.number().int().min(0).max(3).optional(), mouthPreset: z.number().int().min(0).max(5).optional(), hairPreset: z.number().int().min(0).max(11).optional(), beard: z.boolean().optional(), tattoos: z.boolean().optional(), piercings: z.boolean().optional(), cyberware: z.boolean().optional() }).strict();
export const cosmeticSlotSchema = z.enum(["top", "bottom", "shoes", "headwear", "accessory", "outerwear", "gloves", "eyewear", "face", "back", "jewelry"]);
export const characterActionSchemas = [
  z.object({ type: z.literal("character.appearance"), appearance: appearanceSchema.partial().refine((value) => Object.values(value).some((v) => v !== undefined), "Chọn thay đổi ngoại hình.") }).strict(),
  z.object({ type: z.literal("cosmetic.buy"), cosmeticId: z.string().min(1).max(120) }).strict(),
  z.object({ type: z.literal("cosmetic.equip"), cosmeticId: z.string().min(1).max(120) }).strict(),
  z.object({ type: z.literal("cosmetic.outfit"), outfitId: z.string().min(1).max(120) }).strict(),
  z.object({ type: z.literal("cosmetic.unequip"), slot: cosmeticSlotSchema }).strict(),
] as const;

export interface ModularAppearance {
  presentation?: "masculine" | "feminine" | "neutral";
  body: "balanced" | "slim" | "athletic";
  face: "oval" | "angular" | "round";
  eyes: "soft" | "focused" | "wide";
  eyeColor: string;
  eyebrows: "natural" | "straight" | "arched";
  nose: "soft" | "straight" | "wide";
  mouth: "neutral" | "smile" | "full";
  height: number;
  shoulderWidth: number;
  facePreset?: number; eyePreset?: number; browPreset?: number; nosePreset?: number; earPreset?: number; mouthPreset?: number; hairPreset?: number;
  beard?: boolean; tattoos?: boolean; piercings?: boolean; cyberware?: boolean;
}
export type CosmeticSlot = "top" | "bottom" | "shoes" | "headwear" | "accessory" | "outerwear" | "gloves" | "eyewear" | "face" | "back" | "jewelry";
export interface CosmeticDefinition { id: string; name: string; description: string; slot: CosmeticSlot; price: number; color: string; model: string; starter?: boolean; rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"; level?: number; collection?: string; assetId?: string; }
export type CharacterAction =
  | { type: "character.appearance"; appearance: Partial<ModularAppearance> }
  | { type: "cosmetic.buy"; cosmeticId: string }
  | { type: "cosmetic.equip"; cosmeticId: string }
  | { type: "cosmetic.outfit"; outfitId: string }
  | { type: "cosmetic.unequip"; slot: CosmeticSlot };

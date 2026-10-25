import { FURNITURE_CATALOG } from "@/furniture/catalog";
import { PlacementFlags } from "@/furniture/placement-flags";
import { EQUIPMENT_CATALOG } from "@/equipment/catalog";
import { localizedCatalogText } from "./catalog-labels";
import type { BossDefinition, ConsumableDefinition, Difficulty, FurnitureDefinition, ItemDefinition, PetAccessoryDefinition, Skill } from "./types";
function catalogText(id: string) { const value = localizedCatalogText(id); if (!value) throw new Error(`Missing catalog text: ${id}`); return value; }

export const BALANCE = { dailyXpCap: 600, dailyGoldCap: 300, dailyRewardedTaskCap: 20, maxDuration: 240, maxDamageFraction: 0.35, undoWindowMs: 300_000, maxEnhancement: 10 } as const;
/** Local QA mode: furniture purchases grant ownership without consuming Gold. */
export const FURNITURE_TEST_MODE = process.env.NODE_ENV === "development";
export const LOOT_WEIGHTS = { common: 50, uncommon: 30, rare: 12, epic: 5, legendary: 2, mythic: 1 } as const;
export const REWARDS: Record<Difficulty, { xp: number; gold: number; damage: number; penalty: number }> = { easy: { xp: 25, gold: 12, damage: 20, penalty: 8 }, medium: { xp: 50, gold: 25, damage: 40, penalty: 15 }, hard: { xp: 90, gold: 45, damage: 65, penalty: 25 }, epic: { xp: 140, gold: 70, damage: 90, penalty: 40 } };
export const ITEMS: ItemDefinition[] = EQUIPMENT_CATALOG.map(({ id, name, description, rarity, slot, attack, defense, critRate, level, price }) => ({ id, name, description, rarity, slot, attack, defense, critRate, level, price }));
export const FURNITURE: FurnitureDefinition[] = FURNITURE_CATALOG.map(({id,name,description,price,category,width,depth,height,level,color,modelUrl,neonColor,placementType,cutoutSize,placementFlags,slots}) => ({id,name,description,price,category,width,depth,height,level,color,modelUrl,neonColor,placementType: placementType ?? "floor",cutoutSize,placementFlags: placementFlags ?? PlacementFlags.FLOOR_ONLY,slots}));
export const BOSSES: BossDefinition[] = [
  { id: "static-wraith", name: catalogText("static-wraith").name, description: catalogText("static-wraith").description ?? "", type: "daily", level: 1, rarity: "uncommon", maxHp: 180, defense: 3, resistance: 0.05, rewardXp: 70, rewardGold: 45 },
  { id: "deadline-sentinel", name: catalogText("deadline-sentinel").name, description: catalogText("deadline-sentinel").description ?? "", type: "weekly", level: 2, rarity: "rare", maxHp: 650, defense: 8, resistance: 0.12, rewardXp: 180, rewardGold: 120 },
  { id: "procrastination-titan", name: catalogText("procrastination-titan").name, description: catalogText("procrastination-titan").description ?? "", type: "campaign", level: 1, rarity: "epic", maxHp: 500, defense: 5, resistance: 0.1, rewardXp: 220, rewardGold: 180 },
  { id: "chrome-revenant", name: catalogText("chrome-revenant").name, description: catalogText("chrome-revenant").description ?? "", type: "elite", level: 4, rarity: "epic", maxHp: 1200, defense: 14, resistance: 0.2, rewardXp: 320, rewardGold: 250 },
  { id: "zero-day", name: catalogText("zero-day").name, description: catalogText("zero-day").description ?? "", type: "legendary", level: 7, rarity: "legendary", maxHp: 2500, defense: 20, resistance: 0.28, rewardXp: 600, rewardGold: 450 },
];
export const MATERIALS = [{ id: "alloy", name: catalogText("alloy").name, rarity: "common" }, { id: "energy-core", name: catalogText("energy-core").name, rarity: "uncommon" }, { id: "quantum-crystal", name: catalogText("quantum-crystal").name, rarity: "rare" }, { id: "boss-fragment", name: catalogText("boss-fragment").name, rarity: "epic" }, { id: "upgrade-component", name: catalogText("upgrade-component").name, rarity: "uncommon" }] as const;
export const RECIPES = [
  { id: "craft-katana", name: catalogText("craft-katana").name, itemId: "cyber-katana", gold: 50, materials: { alloy: 8, "energy-core": 2 } as Record<string, number> },
  { id: "craft-plasma", name: catalogText("craft-plasma").name, itemId: "plasma-sword", gold: 140, materials: { alloy: 15, "energy-core": 5, "boss-fragment": 2 } as Record<string, number> },
  { id: "craft-chip", name: catalogText("craft-chip").name, itemId: "focus-chip", gold: 35, materials: { alloy: 4, "quantum-crystal": 2 } as Record<string, number> },
];
export const ROOMS = [{ id: "living", name: catalogText("living").name, price: 0, level: 1, width: 13, depth: 9 }, { id: "training", name: catalogText("training").name, price: 350, level: 2, width: 13, depth: 9 }, { id: "workshop", name: catalogText("workshop").name, price: 500, level: 3, width: 13, depth: 9 }, { id: "gaming", name: catalogText("gaming").name, price: 700, level: 4, width: 13, depth: 9 }, { id: "trophy", name: catalogText("trophy").name, price: 900, level: 5, width: 13, depth: 9 }, { id: "premium", name: catalogText("premium").name, price: 1600, level: 7, width: 13, depth: 9 }];
export const PETS = [{ id: "neko", name: catalogText("neko").name, price: 200, color: "#e6b790" }, { id: "drone", name: catalogText("drone").name, price: 300, color: "#32e6f4" }, { id: "fox", name: catalogText("fox").name, price: 500, color: "#9067ff" }];
export const CONSUMABLES: ConsumableDefinition[] = [
  { id: "recovery-kit", name: catalogText("recovery-kit").name, description: catalogText("recovery-kit").description ?? "", price: 30, effect: "hp", amount: 30 },
  { id: "energy-cell", name: catalogText("energy-cell").name, description: catalogText("energy-cell").description ?? "", price: 25, effect: "energy", amount: 25 },
  { id: "focus-serum", name: catalogText("focus-serum").name, description: catalogText("focus-serum").description ?? "", price: 60, effect: "focus", amount: 10, charges: 3 },
];
export const PET_ACCESSORIES: PetAccessoryDefinition[] = [
  { id: "cyan-collar", name: catalogText("cyan-collar").name, description: catalogText("cyan-collar").description ?? "", price: 45, color: "#32e6f4" },
  { id: "violet-halo", name: catalogText("violet-halo").name, description: catalogText("violet-halo").description ?? "", price: 85, color: "#9067ff" },
  { id: "amber-band", name: catalogText("amber-band").name, description: catalogText("amber-band").description ?? "", price: 65, color: "#ffbc62" },
];
export const CAREERS = [{ id: "software", name: catalogText("software").name, skill: "career" }, { id: "accounting", name: catalogText("accounting").name, skill: "finance" }, { id: "auditing", name: catalogText("auditing").name, skill: "knowledge" }, { id: "management", name: catalogText("management").name, skill: "relationships" }, { id: "creative", name: catalogText("creative").name, skill: "creativity" }] as const;
export const SKILL_NODES: { id: string; name: string; skill: Skill; requiredXp: number; prerequisite?: string; attack: number; defense: number }[] = [
  { id: "steady-body", name: catalogText("steady-body").name, skill: "health", requiredXp: 100, attack: 0, defense: 5 },
  { id: "clear-mind", name: catalogText("clear-mind").name, skill: "knowledge", requiredXp: 100, attack: 3, defense: 0 },
  { id: "deep-focus", name: catalogText("deep-focus").name, skill: "knowledge", requiredXp: 350, prerequisite: "clear-mind", attack: 7, defense: 0 },
  { id: "craftsmanship", name: catalogText("craftsmanship").name, skill: "career", requiredXp: 100, attack: 4, defense: 0 },
  { id: "resourceful", name: catalogText("resourceful").name, skill: "finance", requiredXp: 100, attack: 2, defense: 2 },
  { id: "connection", name: catalogText("connection").name, skill: "relationships", requiredXp: 100, attack: 1, defense: 4 },
  { id: "new-perspective", name: catalogText("new-perspective").name, skill: "creativity", requiredXp: 100, attack: 4, defense: 1 },
];
export const ACHIEVEMENTS = [{ id: "first-step", name: catalogText("first-step").name, description: catalogText("first-step").description ?? "" }, { id: "boss-breaker", name: catalogText("boss-breaker").name, description: catalogText("boss-breaker").description ?? "" }, { id: "maker", name: catalogText("maker").name, description: catalogText("maker").description ?? "" }, { id: "home-maker", name: catalogText("home-maker").name, description: catalogText("home-maker").description ?? "" }, { id: "consistent", name: catalogText("consistent").name, description: catalogText("consistent").description ?? "" }, { id: "campaign-clear", name: catalogText("campaign-clear").name, description: catalogText("campaign-clear").description ?? "" }];

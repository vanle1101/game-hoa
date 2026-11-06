import type { HousingAction, Residence } from "../housing/types";
import type { BuildingPlan, BuildingState } from "../construction/types";
import type { MeaningfulBoss, MeaningfulBossAction } from "../boss/types";
import type { CharacterAction, CosmeticSlot, ModularAppearance } from "../character/types";
export type Skill = "health" | "knowledge" | "career" | "finance" | "relationships" | "creativity";
export type Difficulty = "easy" | "medium" | "hard" | "epic";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type EquipmentSlot = "weapon" | "head" | "chest" | "gloves" | "boots" | "accessory1" | "accessory2" | "relic";
export type TaskKind = "once" | "daily" | "weekly" | "habit" | "negative-habit" | "campaign" | "farming" | "recovery";
export interface Task {
  id: string; title: string; description: string; kind: TaskKind; difficulty: Difficulty; skill: Skill;
  targetSkillId?: string | null; xpReward?: number;
  duration: number; priority: "low" | "normal" | "high"; dueDate: string; timezone: string;
  committed: boolean; campaignId?: string; bossId?: string; checklist: { id: string; title: string; done: boolean }[];
  archived: boolean; createdAt: string; exceptions: string[];
}
export interface TaskOccurrence { id: string; taskId: string; date: string; status: "open" | "completed" | "missed" | "canceled"; completedAt?: string; rewardEventId?: string; penaltyEventId?: string; }
export interface ItemDefinition { id: string; name: string; description: string; rarity: Rarity; slot: EquipmentSlot; attack: number; defense: number; critRate: number; level: number; price: number; }
export interface ItemInstance { id: string; definitionId: string; enhancement: number; acquiredAt: string; }
export interface FurnitureDefinition { id: string; name: string; price: number; modelUrl?: string; neonColor: string; placementType: "floor" | "wall" | "ceiling" | "wall_insert"; cutoutSize?: readonly [number, number, number]; placementFlags: number; slots?: readonly { hash: string; x: number; z: number; y: number }[]; category: "seating" | "desk" | "lighting" | "plant" | "decoration" | "bed" | "chair" | "storage" | "electronics" | "light" | "kitchen" | "decor" | "workshop" | "collectible" | "doors" | "windows"; width: number; depth: number; color: string; level?: number; description?: string; height?: number; }
export interface Placement { id: string; furnitureId: string; roomId: string; x: number; z: number; rotation: number; neonColor?: string; }
export interface BossDefinition { id: string; name: string; description: string; type: "daily" | "weekly" | "campaign" | "elite" | "legendary"; level: number; rarity: Rarity; maxHp: number; defense: number; resistance: number; rewardXp: number; rewardGold: number; }
export interface BossEncounter { id: string; definitionId: string; hp: number; phase: 1 | 2 | 3; defeatedAt?: string; rewardEventId?: string; campaignId?: string; loot?: string[]; }
export interface Campaign { id: string; title: string; description: string; bossId: string; requiredTaskIds: string[]; milestones: { id: string; title: string; taskIds: string[] }[]; completedAt?: string; }
export interface JournalEvent { id: string; type: string; title: string; at: string; data: Record<string, string | number | boolean | string[]>; }
export interface LedgerEntry { id: string; eventId: string; amount: number; balance: number; reason: string; at: string; }
export interface Character { name: string; title: string; xp: number; hp: number; energy: number; mood: number; social: number; career: string; skillXp: Record<Skill, number>; skillNodes: string[]; careerRank: number; skin: string; outfit: string; hair: string; hairstyle: "short" | "swept" | "mohawk"; appearance?: ModularAppearance; }
export interface GameSettings { hardcore: boolean; equipmentLossAccepted: boolean; timezone: string; restDays: string[]; graphics: "ultra" | "high" | "balanced" | "performance"; reducedMotion: boolean; focusWorkMinutes?: 15 | 25 | 45 | 60; focusBreakMinutes?: 3 | 5 | 10 | 15; }
export interface ConsumableDefinition { id: string; name: string; description: string; price: number; effect: "hp" | "energy" | "focus"; amount: number; charges?: number; }
export interface RealLifeReward { id: string; name: string; description: string; cost: number; redemptions: number; archived: boolean; lastRedeemedAt?: string; }
export interface PetAccessoryDefinition { id: string; name: string; description: string; price: number; color: string; }
export interface GameState {
  focusSessions?: { id: string; occurrenceId: string; startedAt: string; plannedMinutes?: number; endedAt?: string; confirmedAt?: string; status: "running" | "ended" | "confirmed" | "canceled" }[];
  meaningfulBosses?: MeaningfulBoss[]; activeMeaningfulBossId?: string;
  ownedCosmetics?: string[]; equippedCosmetics?: Partial<Record<CosmeticSlot, string>>;
  building?: BuildingState;
  residence?: Residence;
  housingStarterEligible?: boolean;
  starterCosmeticsVersion?: number;
  starterTasksVersion?: number;
  version: 1; userId: string; revision: number; createdAt: string;
  character: Character; gold: number; tasks: Task[]; occurrences: TaskOccurrence[]; campaigns: Campaign[];
  bosses: BossEncounter[]; activeBossId: string; inventory: ItemInstance[]; equipment: Partial<Record<EquipmentSlot, string>>;
  materials: Record<string, number>; ownedFurniture: Record<string, number>; furnitureNeonColors?: Record<string, string>; placements: Placement[]; unlockedRooms: string[];
  pets: { id: string; name: string; bond: number; lastCareDate?: string }[];
  consumables?: Record<string, number>; activeBuffs?: { id: string; attackBonus: number; remainingQuests: number }[];
  realLifeRewards?: RealLifeReward[]; activePetId?: string; ownedPetAccessories?: string[]; petAccessories?: Record<string, string>;
  undoUnavailableReason?: string;
  achievements: string[]; journal: JournalEvent[]; ledger: LedgerEntry[];
  rewardBudgets: Record<string, { xp: number; gold: number; completed: number }>;
  settings: GameSettings; undo?: { eventId: string; at: string; revision: number; before: Omit<GameState, "undo"> };
}
export interface ActionContext { userId: string; now: string; random: () => number; eventId: string; seedStarterTasks?: boolean; }
export interface TaskInput { title: string; description?: string; kind?: TaskKind; difficulty?: Difficulty; skill?: Skill; targetSkillId?: string | null; xpReward?: number; duration?: number; dueDate?: string; timezone?: string; committed?: boolean; campaignId?: string; bossId?: string; priority?: Task["priority"]; checklist?: string[]; }
export type Action = MeaningfulBossAction | CharacterAction | HousingAction
  | { type: "focus.start"; occurrenceId: string; plannedMinutes?: number }
  | { type: "focus.end"; sessionId: string }
  | { type: "focus.confirm"; sessionId: string; confirmed: true }
  | { type: "focus.cancel"; sessionId: string }
  | { type: "construction.commit"; expectedRevision: number; plan: BuildingPlan }
  | { type: "task.create"; task: TaskInput }
  | { type: "task.edit"; taskId: string; task: Partial<TaskInput> }
  | { type: "task.complete"; occurrenceId: string }
  | { type: "task.checklist"; taskId: string; checklistId: string; done: boolean }
  | { type: "task.reschedule"; taskId: string; dueDate: string }
  | { type: "task.cancel"; occurrenceId: string }
  | { type: "task.archive"; taskId: string }
  | { type: "reconcile" }
  | { type: "undo" }
  | { type: "boss.select"; encounterId: string }
  | { type: "boss.start"; definitionId: string }
  | { type: "item.equip"; itemId: string; slot?: EquipmentSlot }
  | { type: "item.unequip"; slot: EquipmentSlot }
  | { type: "item.buy"; definitionId: string }
  | { type: "item.upgrade"; itemId: string }
  | { type: "item.craft"; recipeId: string }
  | { type: "furniture.buy"; furnitureId: string; neonColor?: string }
  | { type: "furniture.sell"; furnitureId: string; placementId?: string }
  | { type: "furniture.place"; furnitureId: string; placementId?: string; roomId: string; x: number; z: number; rotation: number; neonColor?: string }
  | { type: "furniture.remove"; placementId: string }
  | { type: "room.unlock"; roomId: string }
  | { type: "pet.adopt"; petId: string; name?: string }
  | { type: "pet.care"; petId: string }
  | { type: "pet.select"; petId: string }
  | { type: "pet.accessory.buy"; accessoryId: string }
  | { type: "pet.accessory.equip"; petId: string; accessoryId: string }
  | { type: "pet.accessory.remove"; petId: string }
  | { type: "consumable.buy"; consumableId: string }
  | { type: "consumable.consume"; consumableId: string }
  | { type: "reward.create"; name: string; description?: string; cost: number }
  | { type: "reward.redeem"; rewardId: string }
  | { type: "reward.archive"; rewardId: string }
  | { type: "skill.unlock"; nodeId: string }
  | { type: "career.select"; careerId: string }
  | { type: "career.promote" }
  | { type: "campaign.create"; title: string; description?: string; tasks: TaskInput[] }
  | { type: "character.rename"; name: string }
  | { type: "character.update"; name?: string; skin?: string; outfit?: string; hair?: string; hairstyle?: Character["hairstyle"]; appearance?: Partial<ModularAppearance> }
  | { type: "character.rest" }
  | { type: "settings.update"; settings: Partial<GameSettings> };
export interface ActionResult { state: GameState; events: JournalEvent[]; message: string; }

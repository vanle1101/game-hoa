import { COSMETICS, DEFAULT_APPEARANCE } from "./catalog";
import type { GameState } from "../domain/types";
import type { CosmeticDefinition, CosmeticSlot, ModularAppearance } from "./types";

export const STARTER_COSMETICS_VERSION = 7;
export function grantStarterCosmetics(state: GameState): boolean {
  const free = COSMETICS.filter(item => item.starter && item.price === 0).map(item => item.id);
  const owned = state.ownedCosmetics ?? [];
  if ((state.starterCosmeticsVersion ?? 0) >= STARTER_COSMETICS_VERSION && free.every(id => owned.includes(id))) return false;
  state.ownedCosmetics = [...new Set([...owned, ...free])];
  state.starterCosmeticsVersion = Math.max(state.starterCosmeticsVersion ?? 0, STARTER_COSMETICS_VERSION);
  return true;
}
export function equipCosmetic(equipped: Partial<Record<CosmeticSlot, string>> | undefined, cosmetic: CosmeticDefinition): Partial<Record<CosmeticSlot, string>> {
  const next = { ...equipped };
  if (cosmetic.slot === "outerwear" && COSMETICS.some(item => item.id === next.top && item.model === "long-coat")) delete next.top;
  if (cosmetic.slot === "top" && cosmetic.model === "long-coat") delete next.outerwear;
  next[cosmetic.slot] = cosmetic.id;
  return next;
}
export function mergeAppearance(current: Partial<ModularAppearance> | undefined, patch: Partial<ModularAppearance> = {}): ModularAppearance {
  const normalized = { ...DEFAULT_APPEARANCE, ...current, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) };
  const maps = [
    ["face", "facePreset", { oval: 0, angular: 2, round: 3 }],
    ["eyes", "eyePreset", { soft: 0, focused: 1, wide: 4 }],
    ["eyebrows", "browPreset", { natural: 0, straight: 2, arched: 1 }],
    ["nose", "nosePreset", { soft: 0, straight: 1, wide: 2 }],
    ["mouth", "mouthPreset", { neutral: 0, smile: 1, full: 2 }],
  ] as const;
  for (const [field, preset, values] of maps) {
    const value = patch[field] ?? current?.[field];
    if (value !== undefined && patch[preset] === undefined && (patch[field] !== undefined || current?.[preset] === undefined)) normalized[preset] = (values as Record<string, number>)[value];
  }
  return normalized;
}

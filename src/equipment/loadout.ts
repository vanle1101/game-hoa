import type { EquipmentSlot, GameState, ItemInstance } from "../domain/types";
import { EQUIPMENT_CATALOG } from "./catalog";

const slots: EquipmentSlot[] = ["weapon", "head", "chest", "gloves", "boots", "accessory1", "accessory2", "relic"];
const isAccessory = (slot: EquipmentSlot) => slot === "accessory1" || slot === "accessory2";

export function resolveEquipmentLoadout(state: Pick<GameState, "inventory" | "equipment">): Partial<Record<EquipmentSlot, string>> {
  const loadout: Partial<Record<EquipmentSlot, string>> = {};
  const owned = new Map<string, ItemInstance | undefined>();
  for (const item of state.inventory) owned.set(item.id, owned.has(item.id) ? undefined : item);
  const used = new Set<string>();
  for (const slot of slots) {
    if (!Object.hasOwn(state.equipment, slot)) continue;
    const instanceId = state.equipment[slot];
    if (typeof instanceId !== "string" || !instanceId || used.has(instanceId)) continue;
    const instance = owned.get(instanceId);
    if (!instance) continue;
    const definition = EQUIPMENT_CATALOG.find(item => item.id === instance.definitionId);
    if (!definition || !(definition.slot === slot || isAccessory(slot) && isAccessory(definition.slot))) continue;
    loadout[slot] = definition.id;
    used.add(instanceId);
  }
  return loadout;
}

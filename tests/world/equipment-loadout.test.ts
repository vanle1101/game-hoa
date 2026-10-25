import { describe, expect, it } from "vitest";
import type { EquipmentSlot, GameState, ItemInstance } from "../../src/domain/types";
import { EQUIPMENT_CATALOG } from "../../src/equipment/catalog";
import { resolveEquipmentLoadout } from "../../src/equipment/loadout";

const owned = (id: string, definitionId: string): ItemInstance => ({ id, definitionId, enhancement: 0, acquiredAt: "2026-01-01T00:00:00.000Z" });
const state = (inventory: ItemInstance[] = [], equipment: GameState["equipment"] = {}) => ({ inventory, equipment });

describe("equipment loadout resolution", () => {
  it("preserves empty equipment even when inventory has a weapon", () => {
    expect(resolveEquipmentLoadout(state())).toEqual({});
    expect(resolveEquipmentLoadout(state([owned("blade-instance", "starter-blade")]))).toEqual({});
    expect(resolveEquipmentLoadout(state([], { weapon: undefined, head: "" }))).toEqual({});
  });

  it.each(EQUIPMENT_CATALOG)("resolves owned $id in its catalog slot to a definition ID", definition => {
    const instanceId = `instance:${definition.id}`;
    expect(resolveEquipmentLoadout(state([owned(instanceId, definition.id)], { [definition.slot]: instanceId }))).toEqual({ [definition.slot]: definition.id });
  });

  it("resolves every slot together without forwarding instance IDs", () => {
    const definitions = ["starter-blade", "neural-visor", "aegis-jacket", "pulse-gloves", "drift-boots", "focus-chip", "memory-ring", "dawn-relic"];
    const inventory = definitions.map((id, index) => owned(`owned-${index}`, id));
    const equipment: Partial<Record<EquipmentSlot, string>> = {};
    const expected: Partial<Record<EquipmentSlot, string>> = {};
    inventory.forEach(instance => {
      const slot = EQUIPMENT_CATALOG.find(item => item.id === instance.definitionId)!.slot;
      equipment[slot] = instance.id;
      expected[slot] = instance.definitionId;
    });
    expect(resolveEquipmentLoadout(state(inventory, equipment))).toEqual(expected);
  });

  it("rejects stale ownership, unknown definitions, and definition IDs used as instance IDs", () => {
    const inventory = [owned("blade-instance", "starter-blade"), owned("unknown-instance", "missing-head")];
    expect(resolveEquipmentLoadout(state(inventory, { weapon: "starter-blade", head: "unknown-instance", chest: "sold-instance" }))).toEqual({});
    expect(resolveEquipmentLoadout(state([], { weapon: "blade-instance" }))).toEqual({});
  });

  it("rejects mismatched slots and unknown slot keys without hiding valid slots", () => {
    const inventory = [owned("blade", "starter-blade"), owned("visor", "neural-visor"), owned("chip", "focus-chip")];
    const equipment = { weapon: "blade", chest: "visor", relic: "chip", invalid: "visor" };
    expect(resolveEquipmentLoadout(state(inventory, equipment))).toEqual({ weapon: "starter-blade" });
  });

  it("does not use inherited equipment references", () => {
    const equipment = Object.create({ weapon: "blade" }) as GameState["equipment"];
    expect(resolveEquipmentLoadout(state([owned("blade", "starter-blade")], equipment))).toEqual({});
  });

  it("does not replace a stale reference with another owned copy", () => {
    expect(resolveEquipmentLoadout(state([owned("new-blade", "starter-blade")], { weapon: "sold-blade" }))).toEqual({});
  });

  it("preserves the engine's interchangeable accessory slots", () => {
    const inventory = [owned("chip", "focus-chip"), owned("ring", "memory-ring")];
    expect(resolveEquipmentLoadout(state(inventory, { accessory1: "ring", accessory2: "chip" }))).toEqual({ accessory1: "memory-ring", accessory2: "focus-chip" });
  });

  it("renders an instance assigned twice only once in deterministic slot order", () => {
    const inventory = [owned("chip", "focus-chip")];
    expect(resolveEquipmentLoadout(state(inventory, { accessory2: "chip", accessory1: "chip" }))).toEqual({ accessory1: "focus-chip" });
    expect(resolveEquipmentLoadout(state(inventory, { weapon: "chip", accessory2: "chip" }))).toEqual({ accessory2: "focus-chip" });
  });

  it("allows two separately owned instances of the same accessory definition", () => {
    const inventory = [owned("chip-one", "focus-chip"), owned("chip-two", "focus-chip")];
    expect(resolveEquipmentLoadout(state(inventory, { accessory1: "chip-one", accessory2: "chip-two" }))).toEqual({ accessory1: "focus-chip", accessory2: "focus-chip" });
  });

  it("rejects ambiguous duplicate inventory IDs regardless of ordering or definitions", () => {
    const inventory = [owned("duplicate", "starter-blade"), owned("duplicate", "neural-visor"), owned("valid", "aegis-jacket")];
    const equipment = { weapon: "duplicate", head: "duplicate", chest: "valid" };
    expect(resolveEquipmentLoadout(state(inventory, equipment))).toEqual({ chest: "aegis-jacket" });
    expect(resolveEquipmentLoadout(state([...inventory].reverse(), equipment))).toEqual({ chest: "aegis-jacket" });
    expect(resolveEquipmentLoadout(state([owned("duplicate", "starter-blade"), owned("duplicate", "starter-blade")], { weapon: "duplicate" }))).toEqual({});
  });

  it("does not mutate state or share a mutable output between calls", () => {
    const input = state([owned("blade", "starter-blade")], { weapon: "blade" });
    const before = structuredClone(input);
    input.inventory.forEach(Object.freeze);
    Object.freeze(input.inventory);
    Object.freeze(input.equipment);
    Object.freeze(input);
    const first = resolveEquipmentLoadout(input);
    first.weapon = "plasma-sword";
    expect(resolveEquipmentLoadout(input)).toEqual({ weapon: "starter-blade" });
    expect(input).toEqual(before);
  });
});

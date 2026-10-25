import { DEFAULT_APPEARANCE } from "@/character/catalog";
import { getBuilding } from "@/construction/engine";
import { isFixedApartmentShell } from "@/components/construction/render-geometry";
import { resolveEquipmentLoadout } from "@/equipment/loadout";
import type { GameState } from "@/domain/types";
import type { ModelCharacter } from "@/components/world/CharacterModel";

type VisualCharacter = ModelCharacter;
type Cosmetics = GameState["equippedCosmetics"];

const starterCosmetics: Record<string, string> = {
  top: "runner-jacket", bottom: "runner-pants", shoes: "runner-shoes",
};

/** The apartment's cinematic female is only the presentation for an untouched starter character. */
export function usesReferenceCharacterLook(character: VisualCharacter, cosmetics?: Cosmetics): boolean {
  const appearance = character.appearance as Record<string, unknown> | undefined;
  return character.skin === "#c99573" && character.hair === "#171b2e" &&
    character.outfit === "#32e6f4" && character.hairstyle === "short" &&
    Object.entries(DEFAULT_APPEARANCE).every(([key, value]) => appearance?.[key] === undefined || appearance[key] === value) &&
    Object.entries(cosmetics ?? {}).every(([slot, id]) => starterCosmetics[slot] === id);
}

export function characterRenderProfile(state: GameState) {
  const building = getBuilding(state);
  const equipment = resolveEquipmentLoadout(state);
  return {
    renderer: "procedural" as const,
    modelUrl: null,
    character: state.character,
    cosmetics: state.equippedCosmetics,
    equipment,
    weaponId: equipment.weapon,
    referenceLook: isFixedApartmentShell(building.plan.floors, building.plot) &&
      usesReferenceCharacterLook(state.character, state.equippedCosmetics),
  };
}

export type CharacterRenderProfile = ReturnType<typeof characterRenderProfile>;

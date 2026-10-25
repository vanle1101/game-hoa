"use client";

import { create } from "zustand";
import { levelProgress } from "@/domain/engine";
import type { GameState } from "@/domain/types";
import { characterRenderProfile, type CharacterRenderProfile } from "./character-render-profile";

export type CharacterIdentity = {
  ownerId: string;
  revision: number;
  portraitKey: string;
  render: CharacterRenderProfile;
  avatarUrl: string | null;
  name: string;
  level: number;
  hp: number;
  energy: number;
  mood: number;
};

type IdentityStore = {
  identity: CharacterIdentity | null;
  sync: (state: GameState) => void;
  setPortrait: (ownerId: string, portraitKey: string, avatarUrl: string) => void;
};

export function portraitKeyFor(state: GameState, render = characterRenderProfile(state)): string {
  const appearance = JSON.stringify({
    skin: state.character.skin,
    hair: state.character.hair,
    outfit: state.character.outfit,
    hairstyle: state.character.hairstyle,
    appearance: state.character.appearance,
    cosmetics: state.equippedCosmetics,
    equipment: render.equipment,
    referenceLook: render.referenceLook,
  });
  let hash = 2166136261;
  for (let i = 0; i < appearance.length; i++) hash = Math.imul(hash ^ appearance.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

function cachedPortrait(ownerId: string, portraitKey: string): string | null {
  try { return localStorage.getItem(`lifelevel-portrait:${ownerId}:${portraitKey}`); }
  catch { return null; }
}

export const useCharacterIdentity = create<IdentityStore>((set) => ({
  identity: null,
  sync: (state) => set((current) => {
    const previous = current.identity;
    if (previous?.ownerId === state.userId && state.revision < previous.revision) return current;
    const render = characterRenderProfile(state);
    const portraitKey = portraitKeyFor(state, render);
    const identity: CharacterIdentity = {
      ownerId: state.userId,
      revision: state.revision,
      portraitKey,
      render: previous?.ownerId === state.userId && previous.portraitKey === portraitKey ? previous.render : render,
      avatarUrl: previous?.ownerId === state.userId && previous.portraitKey === portraitKey
        ? previous.avatarUrl : cachedPortrait(state.userId, portraitKey),
      name: state.character.name,
      level: levelProgress(state.character.xp).level,
      hp: state.character.hp,
      energy: state.character.energy,
      mood: state.character.mood,
    };
    return { identity };
  }),
  setPortrait: (ownerId, portraitKey, avatarUrl) => set((current) => {
    const identity = current.identity;
    if (!identity || identity.ownerId !== ownerId || identity.portraitKey !== portraitKey) return current;
    try { localStorage.setItem(`lifelevel-portrait:${ownerId}:${portraitKey}`, avatarUrl); }
    catch { /* Thumbnail remains available for this session. */ }
    return { identity: { ...identity, avatarUrl } };
  }),
}));

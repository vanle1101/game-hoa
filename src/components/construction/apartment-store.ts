"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { BuildingPlan } from "@/construction/types";

type ApartmentState = {
  ownerId: string | null;
  revision: number;
  committed: BuildingPlan | null;
  draft: BuildingPlan | null;
  commit: (ownerId: string, revision: number, plan: BuildingPlan) => void;
  edit: (ownerId: string, plan: BuildingPlan) => void;
  discard: (ownerId: string) => void;
};

/** The server save is authoritative; a construction draft is only visible in
 * the editor and is never persisted or mistaken for purchased furniture. */
export const useApartmentStore = create<ApartmentState>((set) => ({
  ownerId: null, revision: -1, committed: null, draft: null,
  commit: (ownerId, revision, plan) => set(current => {
    if (current.ownerId === ownerId && revision < current.revision) return current;
    if (current.ownerId === ownerId && revision === current.revision && current.committed === plan) return current;
    return { ownerId, revision, committed: plan, draft: current.ownerId === ownerId && revision === current.revision ? current.draft : null };
  }),
  edit: (ownerId, plan) => set(current => current.ownerId === ownerId ? { draft: plan } : current),
  discard: ownerId => set(current => current.ownerId === ownerId && current.draft ? { draft: null } : current),
}));

export function useApartmentPlan(ownerId: string | undefined, revision: number, savedPlan: BuildingPlan | null, includeDraft = false): BuildingPlan | null {
  const commit = useApartmentStore(state => state.commit);
  useEffect(() => { if (ownerId && savedPlan) commit(ownerId, revision, savedPlan); }, [commit, ownerId, revision, savedPlan]);
  const activeOwner = useApartmentStore(state => state.ownerId);
  const activeRevision = useApartmentStore(state => state.revision);
  const plan = useApartmentStore(state => includeDraft ? state.draft ?? state.committed : state.committed);
  return activeOwner === ownerId && activeRevision >= revision && plan ? plan : savedPlan;
}

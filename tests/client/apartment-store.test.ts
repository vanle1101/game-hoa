import { beforeEach, describe, expect, it } from "vitest";
import { useApartmentStore } from "@/components/construction/apartment-store";
import { createFixedApartment } from "@/construction/migration";

const plan = () => structuredClone(createFixedApartment("2026-01-01T00:00:00.000Z").plan);

beforeEach(() => useApartmentStore.setState({ ownerId: null, revision: -1, committed: null, draft: null }));

describe("apartment furniture source of truth", () => {
  it("keeps every placement and rotation from the authoritative save", () => {
    const saved = plan();
    saved.furniture = [
      { id: "bed-a", furnitureId: "cloud-bed", x: -4, z: -2, level: 0, rotation: 90 },
      { id: "bed-b", furnitureId: "cloud-bed", x: 1, z: 2, level: 0, rotation: 270 },
    ];
    useApartmentStore.getState().commit("owner-a", 4, saved);
    expect(useApartmentStore.getState().committed?.furniture).toEqual(saved.furniture);
    useApartmentStore.getState().commit("owner-a", 3, plan());
    expect(useApartmentStore.getState().committed).toBe(saved);
  });

  it("shares editor drafts while preserving the saved plan until commit", () => {
    const saved = plan();
    useApartmentStore.getState().commit("owner-a", 1, saved);
    const draft = structuredClone(saved);
    draft.furniture.push({ id: "sofa", furnitureId: "corner-sofa", x: 2, z: 1, level: 0, rotation: 180 });
    useApartmentStore.getState().edit("owner-a", draft);
    expect(useApartmentStore.getState().draft?.furniture).toHaveLength(1);
    expect(useApartmentStore.getState().committed?.furniture).toHaveLength(0);
    useApartmentStore.getState().discard("owner-a");
    expect(useApartmentStore.getState().draft).toBeNull();
    useApartmentStore.getState().commit("owner-a", 2, draft);
    expect(useApartmentStore.getState().committed?.furniture[0].rotation).toBe(180);
  });

  it("isolates one player's apartment from another player's save", () => {
    const first = plan();
    const second = plan();
    second.furniture.push({ id: "lamp", furnitureId: "neon-floor-lamp", x: 0, z: 0, level: 0, rotation: 0 });
    useApartmentStore.getState().commit("owner-a", 9, first);
    useApartmentStore.getState().edit("owner-a", first);
    useApartmentStore.getState().commit("owner-b", 1, second);
    expect(useApartmentStore.getState()).toMatchObject({ ownerId: "owner-b", revision: 1, committed: second, draft: null });
    useApartmentStore.getState().edit("owner-a", first);
    expect(useApartmentStore.getState().draft).toBeNull();
  });
});

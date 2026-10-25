import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "@/domain/engine";
import { portraitKeyFor, useCharacterIdentity } from "./character-identity-store";
import { usesReferenceCharacterLook } from "./character-render-profile";

const state = (userId: string, revision: number, name = "Astra", hair = "#171b2e") => {
  const saved = createInitialState(userId, "2026-10-21T00:00:00.000Z");
  saved.revision = revision;
  saved.character = { ...saved.character, name, xp: 400, hp: 88, energy: 76, mood: 92, hair };
  return saved;
};

describe("saved character identity", () => {
  beforeEach(() => useCharacterIdentity.setState({ identity: null }));

  it("projects the saved name, level and vitals into the shared store", () => {
    useCharacterIdentity.getState().sync(state("owner-a", 1));
    expect(useCharacterIdentity.getState().identity).toMatchObject({
      ownerId: "owner-a", name: "Astra", level: 3, hp: 88, energy: 76, mood: 92,
    });
    expect(useCharacterIdentity.getState().identity?.render).toMatchObject({ renderer: "procedural", modelUrl: null });
  });

  it("uses the apartment's female reference look only for the untouched starter appearance", () => {
    const starter = state("owner-a", 1);
    expect(usesReferenceCharacterLook(starter.character, starter.equippedCosmetics)).toBe(true);
    expect(usesReferenceCharacterLook({ ...starter.character, hair: "#f1e2a3" }, starter.equippedCosmetics)).toBe(false);
    expect(usesReferenceCharacterLook(starter.character, { ...starter.equippedCosmetics, top: "other-top" })).toBe(false);
  });

  it("changes the portrait only when the saved 3D appearance changes", () => {
    const original = state("owner-a", 1);
    const key = portraitKeyFor(original);
    useCharacterIdentity.getState().sync(original);
    useCharacterIdentity.getState().setPortrait("owner-a", key, "data:image/png;base64,portrait");
    useCharacterIdentity.getState().sync(state("owner-a", 2, "Nova"));
    expect(useCharacterIdentity.getState().identity).toMatchObject({ name: "Nova", avatarUrl: "data:image/png;base64,portrait" });
    useCharacterIdentity.getState().sync(state("owner-a", 3, "Nova", "#f1e2a3"));
    expect(useCharacterIdentity.getState().identity?.avatarUrl).toBeNull();
    useCharacterIdentity.getState().setPortrait("owner-a", key, "stale image");
    expect(useCharacterIdentity.getState().identity?.avatarUrl).toBeNull();
  });

  it("rejects stale revisions and never carries a portrait to a different owner", () => {
    const saved = state("owner-a", 5);
    useCharacterIdentity.getState().sync(saved);
    useCharacterIdentity.getState().setPortrait("owner-a", portraitKeyFor(saved), "portrait-a");
    useCharacterIdentity.getState().sync(state("owner-a", 4, "Old name"));
    expect(useCharacterIdentity.getState().identity?.name).toBe("Astra");
    useCharacterIdentity.getState().sync(state("owner-b", 1, "Bea"));
    expect(useCharacterIdentity.getState().identity).toMatchObject({ ownerId: "owner-b", name: "Bea", avatarUrl: null });
  });
});

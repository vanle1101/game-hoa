import { beforeEach, describe, expect, it } from "vitest";
import { useSkillTreeStore, type SkillCategory } from "../../src/components/game/skill-tree-store";

function installMemoryStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
}

beforeEach(() => {
  installMemoryStorage();
  useSkillTreeStore.setState({ ownerId: null, hydrated: false, skills: [], traits: [], awards: [], activeTab: "skills", filterCategory: "all", searchQuery: "" });
});

describe("tracked skill tree", () => {
  it("creates, updates, deletes, and persists skills and traits per owner", () => {
    const store = useSkillTreeStore.getState();
    store.hydrate("profile-a");
    const pianoId = useSkillTreeStore.getState().addSkill({ name: "Piano", description: "Âm nhạc", icon: "♫", category: "Music" as SkillCategory, parentId: null });
    expect(pianoId).toBeTruthy();
    const harmonyId = useSkillTreeStore.getState().addSkill({ name: "Harmonization", description: "Hòa âm", icon: "✦", category: "Music", parentId: pianoId! });
    expect(harmonyId).toBeTruthy();
    useSkillTreeStore.getState().updateSkill(harmonyId!, { name: "Hòa âm" });
    const traitId = useSkillTreeStore.getState().addTrait({ name: "Fast Learner", description: "Học nhanh", icon: "⚡", type: "Bonus", buffEffect: "+10% XP" });
    useSkillTreeStore.getState().updateTrait(traitId!, { buffEffect: "+15% XP" });

    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === harmonyId)?.name).toBe("Hòa âm");
    expect(useSkillTreeStore.getState().traits.find((trait) => trait.id === traitId)?.buffEffect).toBe("+15% XP");

    useSkillTreeStore.getState().deleteSkill(harmonyId!);
    useSkillTreeStore.getState().deleteTrait(traitId!);
    expect(useSkillTreeStore.getState().skills.some((skill) => skill.id === harmonyId)).toBe(false);
    expect(useSkillTreeStore.getState().traits.some((trait) => trait.id === traitId)).toBe(false);

    useSkillTreeStore.getState().addTrait({ name: "Night Owl", description: "Tỉnh táo buổi tối", icon: "☾", type: "Personality", buffEffect: "+10% tập trung" });
    useSkillTreeStore.setState({ ownerId: null, hydrated: false, skills: [], traits: [], awards: [] });
    useSkillTreeStore.getState().hydrate("profile-a");
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === pianoId)?.name).toBe("Piano");
    expect(useSkillTreeStore.getState().skills.some((skill) => skill.id === harmonyId)).toBe(false);
    expect(useSkillTreeStore.getState().traits.some((trait) => trait.name === "Night Owl")).toBe(true);
  });

  it("offers parent deletion with either child promotion or subtree deletion", () => {
    useSkillTreeStore.getState().hydrate("profile-b");
    const parentId = useSkillTreeStore.getState().addSkill({ name: "Piano", description: "", icon: "♫", category: "Music", parentId: null })!;
    const childId = useSkillTreeStore.getState().addSkill({ name: "Harmonization", description: "", icon: "✦", category: "Music", parentId })!;

    useSkillTreeStore.getState().deleteSkill(parentId, "promote-children");
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === childId)?.parentId).toBeNull();

    const nextParentId = useSkillTreeStore.getState().addSkill({ name: "Guitar", description: "", icon: "♫", category: "Music", parentId: null })!;
    useSkillTreeStore.getState().updateSkill(childId, { parentId: nextParentId });
    useSkillTreeStore.getState().deleteSkill(nextParentId, "delete-children");
    expect(useSkillTreeStore.getState().skills.some((skill) => skill.id === childId || skill.id === nextParentId)).toBe(false);
  });

  it("awards 100 XP to a child and 30 XP to its parent once, persists, and supports undo", () => {
    useSkillTreeStore.getState().hydrate("profile-c");
    const pianoId = useSkillTreeStore.getState().addSkill({ name: "Piano", description: "", icon: "♫", category: "Music", parentId: null })!;
    const harmonyId = useSkillTreeStore.getState().addSkill({ name: "Harmonization", description: "", icon: "✦", category: "Music", parentId: pianoId })!;

    expect(useSkillTreeStore.getState().awardSkillXp("profile-c", harmonyId, 100, "occurrence-reward-1")).toMatchObject({ awarded: true, childLevels: 0, parentLevels: 0 });
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === harmonyId)?.currentXp).toBe(100);
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === pianoId)?.currentXp).toBe(30);
    expect(useSkillTreeStore.getState().awardSkillXp("profile-c", harmonyId, 100, "occurrence-reward-1").awarded).toBe(false);

    useSkillTreeStore.setState({ ownerId: null, hydrated: false, skills: [], traits: [], awards: [] });
    useSkillTreeStore.getState().hydrate("profile-c");
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === harmonyId)?.currentXp).toBe(100);
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === pianoId)?.currentXp).toBe(30);
    expect(useSkillTreeStore.getState().undoSkillXp("profile-c", "occurrence-reward-1")).toBe(true);
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === harmonyId)?.currentXp).toBe(0);
    expect(useSkillTreeStore.getState().skills.find((skill) => skill.id === pianoId)?.currentXp).toBe(0);
  });
});

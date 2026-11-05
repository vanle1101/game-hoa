"use client";

import { create } from "zustand";

export type SkillCategory = "Music" | "Mental" | "Physical" | "Creative" | "Technical" | "Social" | "Life";
export type SkillCategoryFilter = SkillCategory | "all";
export type TraitType = "Personality" | "Bonus" | "Aspiration";

export interface TrackedSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  parentId: string | null;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  category: SkillCategory;
  createdAt: number;
}

export interface Trait {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: TraitType;
  buffEffect: string;
}

export type NewTrackedSkill = Omit<TrackedSkill, "id" | "currentXp" | "level" | "xpToNextLevel" | "createdAt">;
export type NewTrait = Omit<Trait, "id">;
export type ChildDeleteMode = "delete-children" | "promote-children";

type SkillXpAward = { id: string; amounts: { skillId: string; amount: number }[] };
type PersistedSkillTree = { version: 1; skills: TrackedSkill[]; traits: Trait[]; awards: SkillXpAward[] };

const MAX_LEVEL = 100;
const STORAGE_PREFIX = "lifelevel-skill-tree:v1:";
export const SKILL_CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "Music", label: "Âm nhạc" },
  { id: "Mental", label: "Trí tuệ" },
  { id: "Physical", label: "Thể chất" },
  { id: "Creative", label: "Sáng tạo" },
  { id: "Technical", label: "Kỹ thuật" },
  { id: "Social", label: "Xã hội" },
  { id: "Life", label: "Đời sống" },
];
export const TRAIT_TYPES: { id: TraitType; label: string }[] = [
  { id: "Personality", label: "Tính cách" },
  { id: "Bonus", label: "Đặc điểm thưởng" },
  { id: "Aspiration", label: "Khát vọng" },
];

export function xpRequiredForLevel(level: number): number {
  return Math.round(level * 100 * 1.5);
}

function makeStarterSkills(): TrackedSkill[] {
  const now = Date.now();
  const root = (id: string, name: string, icon: string, category: SkillCategory, description: string): TrackedSkill => ({
    id, name, icon, category, description, parentId: null, level: 1, currentXp: 0,
    xpToNextLevel: xpRequiredForLevel(1), createdAt: now,
  });
  const child = (id: string, name: string, icon: string, category: SkillCategory, parentId: string, description: string): TrackedSkill => ({
    id, name, icon, category, description, parentId, level: 1, currentXp: 0,
    xpToNextLevel: xpRequiredForLevel(1), createdAt: now,
  });
  return [
    root("starter-health", "Thể lực", "♥", "Physical", "Năng lượng, sức bền và chăm sóc cơ thể."),
    child("starter-running", "Chạy bộ", "⌁", "Physical", "starter-health", "Rèn sức bền qua những bước chạy đều đặn."),
    child("starter-mobility", "Vận động linh hoạt", "✦", "Physical", "starter-health", "Giữ cơ thể linh hoạt và khỏe mạnh."),
    root("starter-learning", "Tri thức", "⌘", "Mental", "Khả năng học hỏi, suy luận và tập trung."),
    child("starter-reading", "Đọc sâu", "▤", "Mental", "starter-learning", "Hiểu sâu nội dung qua việc đọc có chủ đích."),
    child("starter-focus", "Tập trung", "◎", "Mental", "starter-learning", "Duy trì sự chú ý trong các phiên làm việc."),
    root("starter-creative", "Sáng tạo", "✧", "Creative", "Tư duy hình ảnh và khả năng biểu đạt."),
    child("starter-sketching", "Phác thảo", "✎", "Creative", "starter-creative", "Biến ý tưởng thành những nét phác đầu tiên."),
    root("starter-technical", "Kỹ thuật", "⌬", "Technical", "Năng lực sử dụng công cụ và công nghệ."),
    child("starter-programming", "Lập trình", "</>", "Technical", "starter-technical", "Xây dựng sản phẩm bằng tư duy lập trình."),
  ];
}

function makeStarterTraits(): Trait[] {
  return [
    { id: "trait-bookworm", name: "Bookworm", description: "Thích khám phá ý tưởng qua sách và tài liệu.", icon: "▤", type: "Personality", buffEffect: "+10% XP Tri thức khi hoàn thành nhiệm vụ học tập." },
    { id: "trait-night-owl", name: "Night Owl", description: "Tỉnh táo và tập trung tốt vào buổi tối.", icon: "☾", type: "Personality", buffEffect: "+10% Tập trung trong khung giờ buổi tối." },
    { id: "trait-perfectionist", name: "Perfectionist", description: "Chú ý đến chất lượng và những chi tiết nhỏ.", icon: "✧", type: "Personality", buffEffect: "+5% XP khi hoàn thành checklist đầy đủ." },
    { id: "trait-fast-learner", name: "Fast Learner", description: "Tiến bộ nhanh khi duy trì luyện tập đều đặn.", icon: "⚡", type: "Bonus", buffEffect: "+10% XP kỹ năng từ nhiệm vụ đã liên kết." },
  ];
}

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(ownerId)}`;
}

function persist(ownerId: string, value: PersistedSkillTree) {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(value));
  } catch {
    // Keep the current session usable if storage is disabled or full.
  }
}

function readPersisted(ownerId: string): PersistedSkillTree | null {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PersistedSkillTree>;
    if (value.version !== 1 || !Array.isArray(value.skills) || !Array.isArray(value.traits)) return null;
    return { version: 1, skills: value.skills, traits: value.traits, awards: Array.isArray(value.awards) ? value.awards : [] };
  } catch {
    return null;
  }
}

function makeId(kind: string): string {
  return `${kind}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`}`;
}

function totalSkillXp(skill: TrackedSkill): number {
  let total = skill.currentXp;
  for (let level = 1; level < skill.level; level += 1) total += xpRequiredForLevel(level);
  return total;
}

function withTotalXp(skill: TrackedSkill, totalXp: number): TrackedSkill {
  let level = 1;
  let currentXp = Math.max(0, totalXp);
  while (level < MAX_LEVEL && currentXp >= xpRequiredForLevel(level)) {
    currentXp -= xpRequiredForLevel(level);
    level += 1;
  }
  return { ...skill, level, currentXp, xpToNextLevel: xpRequiredForLevel(level) };
}

export interface SkillTreeStore {
  ownerId: string | null;
  hydrated: boolean;
  skills: TrackedSkill[];
  traits: Trait[];
  awards: SkillXpAward[];
  activeTab: "skills" | "traits";
  filterCategory: SkillCategoryFilter;
  searchQuery: string;
  hydrate: (ownerId: string, force?: boolean) => void;
  setActiveTab: (tab: "skills" | "traits") => void;
  setFilterCategory: (category: SkillCategoryFilter) => void;
  setSearchQuery: (query: string) => void;
  addSkill: (data: NewTrackedSkill) => string | null;
  updateSkill: (id: string, updates: Partial<TrackedSkill>) => void;
  deleteSkill: (id: string, childMode?: ChildDeleteMode) => void;
  addTrait: (data: NewTrait) => string | null;
  updateTrait: (id: string, updates: Partial<Trait>) => void;
  deleteTrait: (id: string) => void;
  awardSkillXp: (ownerId: string, skillId: string, earnedXp: number, awardId: string) => { awarded: boolean; childLevels: number; parentLevels: number };
  undoSkillXp: (ownerId: string, awardId: string) => boolean;
}

export const useSkillTreeStore = create<SkillTreeStore>((set, get) => {
  const currentPersisted = (): PersistedSkillTree => ({ version: 1, skills: get().skills, traits: get().traits, awards: get().awards });
  const saveCurrent = () => {
    const state = get();
    if (state.ownerId && state.hydrated) persist(state.ownerId, currentPersisted());
  };

  // Private records remain in Zustand state so XP event receipts persist with the tree.
  const state = {
    ownerId: null,
    hydrated: false,
    skills: [] as TrackedSkill[],
    traits: [] as Trait[],
    activeTab: "skills" as const,
    filterCategory: "all" as SkillCategoryFilter,
    searchQuery: "",
    awards: [] as SkillXpAward[],
  };

  return {
    ...state,
    hydrate: (ownerId, force = false) => {
      if (!ownerId || (!force && get().ownerId === ownerId && get().hydrated)) return;
      const saved = readPersisted(ownerId);
      const next = saved ?? { version: 1 as const, skills: makeStarterSkills(), traits: makeStarterTraits(), awards: [] };
      set({ ownerId, hydrated: true, skills: next.skills, traits: next.traits, awards: next.awards, activeTab: "skills", filterCategory: "all", searchQuery: "" });
      if (!saved) persist(ownerId, next);
    },
    setActiveTab: (activeTab) => set({ activeTab }),
    setFilterCategory: (filterCategory) => set({ filterCategory }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    addSkill: (data) => {
      const ownerId = get().ownerId;
      if (!ownerId) return null;
      const parent = data.parentId ? get().skills.find((skill) => skill.id === data.parentId && skill.parentId === null) : null;
      if (data.parentId && !parent) return null;
      const skill: TrackedSkill = { ...data, id: makeId("skill"), parentId: parent?.id ?? null, level: 1, currentXp: 0, xpToNextLevel: xpRequiredForLevel(1), createdAt: Date.now() };
      set((current) => ({ skills: [...current.skills, skill] }));
      saveCurrent();
      return skill.id;
    },
    updateSkill: (id, updates) => {
      const ownerId = get().ownerId;
      if (!ownerId) return;
      const target = get().skills.find((skill) => skill.id === id);
      if (!target) return;
      const requestedParentId = updates.parentId === undefined ? target.parentId : updates.parentId;
      if (requestedParentId && (!get().skills.some((skill) => skill.id === requestedParentId && skill.parentId === null) || requestedParentId === id)) return;
      const update: Partial<TrackedSkill> = { ...updates, parentId: requestedParentId };
      if (updates.level !== undefined) update.level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(updates.level)));
      set((current) => ({ skills: current.skills.map((skill) => skill.id === id ? { ...skill, ...update, xpToNextLevel: xpRequiredForLevel(update.level ?? skill.level) } : skill) }));
      saveCurrent();
    },
    deleteSkill: (id, childMode = "promote-children") => {
      const ownerId = get().ownerId;
      if (!ownerId) return;
      set((current) => {
        const children = current.skills.filter((skill) => skill.parentId === id);
        const skills = current.skills.filter((skill) => skill.id !== id && !(childMode === "delete-children" && skill.parentId === id))
          .map((skill) => childMode === "promote-children" && skill.parentId === id ? { ...skill, parentId: null } : skill);
        const awards = current.awards.map((award) => ({ ...award, amounts: award.amounts.filter((item) => item.skillId !== id && !(childMode === "delete-children" && children.some((child) => child.id === item.skillId))) })).filter((award) => award.amounts.length > 0);
        return { skills, awards };
      });
      saveCurrent();
    },
    addTrait: (data) => {
      const ownerId = get().ownerId;
      if (!ownerId) return null;
      const trait = { ...data, id: makeId("trait") };
      set((current) => ({ traits: [...current.traits, trait] }));
      saveCurrent();
      return trait.id;
    },
    updateTrait: (id, updates) => {
      if (!get().ownerId) return;
      set((current) => ({ traits: current.traits.map((trait) => trait.id === id ? { ...trait, ...updates, id } : trait) }));
      saveCurrent();
    },
    deleteTrait: (id) => {
      if (!get().ownerId) return;
      set((current) => ({ traits: current.traits.filter((trait) => trait.id !== id) }));
      saveCurrent();
    },
    awardSkillXp: (ownerId, skillId, earnedXp, awardId) => {
      const before = get();
      if (!ownerId || before.ownerId !== ownerId || !before.hydrated || !Number.isFinite(earnedXp) || earnedXp <= 0 || before.awards.some((award) => award.id === awardId)) {
        return { awarded: false, childLevels: 0, parentLevels: 0 };
      }
      const target = before.skills.find((skill) => skill.id === skillId);
      if (!target) return { awarded: false, childLevels: 0, parentLevels: 0 };
      const parent = target.parentId ? before.skills.find((skill) => skill.id === target.parentId) : undefined;
      const amounts = [{ skillId, amount: Math.floor(earnedXp) }];
      if (parent) amounts.push({ skillId: parent.id, amount: Math.round(Math.floor(earnedXp) * 0.3) });
      let childLevels = 0;
      let parentLevels = 0;
      set((current) => ({
        skills: current.skills.map((skill) => {
          const amount = amounts.find((entry) => entry.skillId === skill.id)?.amount ?? 0;
          if (!amount) return skill;
          const advanced = withTotalXp(skill, totalSkillXp(skill) + amount);
          if (skill.id === skillId) childLevels = advanced.level - skill.level;
          if (parent && skill.id === parent.id) parentLevels = advanced.level - skill.level;
          return advanced;
        }),
        awards: [...current.awards, { id: awardId, amounts }],
      }));
      saveCurrent();
      return { awarded: true, childLevels, parentLevels };
    },
    undoSkillXp: (ownerId, awardId) => {
      const before = get();
      if (before.ownerId !== ownerId || !before.hydrated) return false;
      const record = before.awards.find((award) => award.id === awardId);
      if (!record) return false;
      set((current) => ({
        skills: current.skills.map((skill) => {
          const amount = record.amounts.find((entry) => entry.skillId === skill.id)?.amount ?? 0;
          return amount ? withTotalXp(skill, Math.max(0, totalSkillXp(skill) - amount)) : skill;
        }),
        awards: current.awards.filter((award) => award.id !== awardId),
      }));
      saveCurrent();
      return true;
    },
  } as SkillTreeStore & { awards: SkillXpAward[] };
});

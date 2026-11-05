import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LobbySkillTreeWidget, { skillTreePreview } from "../../src/components/game/LobbySkillTreeWidget";
import { SKILL_NODES } from "../../src/domain/catalog";
import { createInitialState } from "../../src/domain/engine";

describe("LobbySkillTreeWidget", () => {
  it("uses saved XP and prerequisites to show only skills available to unlock", () => {
    const state = createInitialState("owner", "2026-10-27T00:00:00.000Z");
    state.character.skillXp.knowledge = 400;
    state.character.skillXp.health = 50;

    const before = skillTreePreview(state);
    expect(before.ready).toBe(1);
    expect(before.branches.find(branch => branch.skill === "health")?.percent).toBe(50);
    expect(before.branches.find(branch => branch.skill === "knowledge")?.percent).toBe(100);

    state.character.skillNodes.push("clear-mind");
    const after = skillTreePreview(state);
    expect(after.ready).toBe(1);
    expect(after.unlocked).toBe(1);
    expect(after.branches.find(branch => branch.skill === "knowledge")?.target).toBe(350);
  });

  it("renders the two latest saved unlocks and links to the skill tree without apartment content", () => {
    const state = createInitialState("owner", "2026-10-27T00:00:00.000Z");
    state.character.skillNodes = ["steady-body", "clear-mind", "craftsmanship"];
    const preview = skillTreePreview(state);
    expect(preview.recent.map(node => node.id)).toEqual(["craftsmanship", "clear-mind"]);

    const html = renderToStaticMarkup(createElement(LobbySkillTreeWidget, {
      state, level: 4, onNavigate: vi.fn(),
    }));
    expect(html).toContain("Cây kỹ năng");
    expect(html).toMatch(/<button[^>]*class="[^"]*\bvref-heading-link\b/);
    expect(html).not.toContain("Xem chi tiết cây kỹ năng");
    expect(html).toContain("Cấp 4");
    expect(html).toContain(SKILL_NODES.find(node => node.id === "craftsmanship")?.name);
    expect(html).not.toContain("Căn hộ của tôi");
    expect(html).not.toContain("Vật phẩm nổi bật");
    expect(html).not.toContain("<canvas");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LobbyAchievementsWidget from "../../src/components/game/LobbyAchievementsWidget";
import { ACHIEVEMENTS } from "../../src/domain/catalog";
import { createInitialState } from "../../src/domain/engine";

describe("LobbyAchievementsWidget", () => {
  it("shows earned progress and the next locked achievement from saved game state", () => {
    const state = createInitialState("owner", "2026-10-27T00:00:00.000Z");
    state.achievements = [ACHIEVEMENTS[0].id, ACHIEVEMENTS[1].id];
    const html = renderToStaticMarkup(createElement(LobbyAchievementsWidget, {
      state, achievements: ACHIEVEMENTS, onNavigate: vi.fn(),
    }));
    expect(html).toContain(`2/${ACHIEVEMENTS.length}`);
    expect(html).toContain(`Mới đạt: ${ACHIEVEMENTS[1].name}`);
    expect(html).toContain(`Tiếp theo: ${ACHIEVEMENTS[2].name}`);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bvref-heading-link\b/);
    expect(html).not.toContain("Xem tất cả thành tựu");
    expect(html).not.toContain("Tài chính");
  });
});

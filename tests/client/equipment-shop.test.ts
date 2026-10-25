import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildEquipmentArtworkProjection, EquipmentArtwork } from "@/components/equipment/EquipmentArtwork";
import { ItemArtwork, ReferenceShop } from "@/components/game/ReferencePanels";
import { getEquipmentDisplayLayout } from "@/components/world/ItemShowcase";
import { ITEMS } from "@/domain/catalog";
import { applyAction, createInitialState, levelProgress } from "@/domain/engine";
import { EQUIPMENT_CATALOG, EQUIPMENT_MODEL_IDS } from "@/equipment/catalog";

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicPreviewStub({ item }: { item?: { id: string; name: string } }) {
      return createElement("div", {
        className: "item-3d-showcase-stub",
        "data-preview-id": item?.id,
      });
    },
}));

describe("equipment storefront visuals and level gate", () => {
  it("projects unique recipe-driven SVG artwork for every catalog item across all 74 equipment definitions", () => {
    expect(EQUIPMENT_CATALOG.length).toBeGreaterThanOrEqual(66);
    expect(ITEMS.length).toBe(EQUIPMENT_CATALOG.length);
    expect(EQUIPMENT_MODEL_IDS.length).toBe(EQUIPMENT_CATALOG.length);

    const signatures = new Set<string>();
    const markups = new Set<string>();

    for (const item of ITEMS) {
      const projection = buildEquipmentArtworkProjection(item);
      expect(projection.faces.length, `${item.id} has projected faces`).toBeGreaterThan(2);
      expect(signatures.has(projection.signature), `duplicate projection signature for ${item.id}`).toBe(false);
      signatures.add(projection.signature);

      const svgMarkup = renderToStaticMarkup(createElement(EquipmentArtwork, { item }));
      expect(svgMarkup).toContain(`aria-label="${item.name}"`);
      expect(svgMarkup).toContain(`data-item-id="${item.id}"`);
      expect(svgMarkup).toContain("<polygon");
      expect(svgMarkup).not.toMatch(/NaN|Infinity/);

      const normalizedMarkup = svgMarkup
        .replace(/aria-label="[^"]*"/g, "")
        .replace(/data-item-id="[^"]*"/g, "")
        .replace(/id="[^"]*"/g, "")
        .replace(/url\(#[^)]*\)/g, "");
      expect(markups.has(normalizedMarkup), `duplicate SVG silhouette markup for ${item.id}`).toBe(false);
      markups.add(normalizedMarkup);

      const delegatedMarkup = renderToStaticMarkup(createElement(ItemArtwork, { item }));
      expect(delegatedMarkup).toContain(`data-item-id="${item.id}"`);
    }
  });

  it("computes finite display-layout bounds and fitted camera coordinates for all weapons, armor, and accessories", () => {
    for (const item of ITEMS) {
      const layout = getEquipmentDisplayLayout(item.id, 32, 1.25);
      expect(layout.radius, `${item.id} radius`).toBeGreaterThan(0.05);
      expect(layout.cameraDistance, `${item.id} cameraDistance`).toBeGreaterThan(layout.radius);
      for (const value of [
        ...layout.min,
        ...layout.max,
        ...layout.size,
        ...layout.center,
        ...layout.modelPosition,
        ...layout.cameraPosition,
        ...layout.cameraTarget,
        layout.pedestalRadius,
        layout.pedestalY,
      ]) {
        expect(Number.isFinite(value), `${item.id} finite layout metric`).toBe(true);
      }
      expect(layout.size[0]).toBeGreaterThan(0.01);
      expect(layout.size[1]).toBeGreaterThan(0.01);
      expect(layout.size[2]).toBeGreaterThan(0.005);
    }

    const showcaseSource = readFileSync(resolve(process.cwd(), "src/components/world/ItemShowcase.tsx"), "utf8");
    expect(showcaseSource.match(/<Canvas\b/g)?.length).toBe(1);
    expect(showcaseSource).toContain('<EquipmentModel itemId={item.id} presentation="display" />');
    expect(showcaseSource).not.toContain("octahedronGeometry");
    expect(showcaseSource).not.toContain("capsuleGeometry");
    expect(showcaseSource).not.toMatch(/<Canvas[^>]*\bkey=/);
  });

  it("enforces server item.buy level gate in ReferenceShop while allowing free preview", () => {
    const state = createInitialState("shop-level-gate-test");
    state.gold = 99999;
    state.character.xp = 0;
    const before = JSON.stringify(state);
    const currentLevel = levelProgress(state.character.xp).level;
    expect(currentLevel).toBe(1);

    const lockedCyberKatana = ITEMS.find((i) => i.id === "cyber-katana")!;
    expect(lockedCyberKatana.level).toBeGreaterThan(currentLevel);

    expect(() =>
      applyAction(
        state,
        {
          type: "item.buy",
          definitionId: lockedCyberKatana.id,
        },
        {
          userId: state.userId,
          now: new Date().toISOString(),
          random: () => 0.5,
          eventId: "test-buy-locked",
        },
      ),
    ).toThrow(/Requires level/);

    const act = vi.fn();
    const navigate = vi.fn();
    const lockedMarkup = renderToStaticMarkup(
      createElement(ReferenceShop, { state, act, busy: false, navigate }),
    );

    expect(JSON.stringify(state)).toBe(before);
    expect(act).not.toHaveBeenCalled();
    expect(lockedMarkup).toContain(`data-preview-id="${lockedCyberKatana.id}"`);
    expect(lockedMarkup).not.toContain("Có thể mua để dành");
    expect(lockedMarkup).toContain(`Yêu cầu cấp ${lockedCyberKatana.level}`);
    expect(lockedMarkup).toContain(
      `Yêu cầu đạt cấp ${lockedCyberKatana.level} để mua trang bị này; bạn vẫn có thể xem trước mô hình 3D miễn phí.`,
    );
    expect(lockedMarkup).toMatch(/<button[^>]*disabled=""[^>]*>Mua trang bị/);

    const shopCards = [...lockedMarkup.matchAll(/<button[^>]*class="ref-slot[^"]*"[\s\S]*?<\/button>/g)].map(
      (m) => m[0],
    );
    const purchasableItems = ITEMS.filter((i) => i.price > 0);
    expect(purchasableItems.length).toBeGreaterThan(12);
    expect(shopCards).toHaveLength(12);
    expect(shopCards.map(card => card.match(/data-shop-item-id="([^"]+)"/)?.[1])).toEqual(purchasableItems.slice(0, 12).map(item => item.id));
    expect(shopCards.every((card) => !card.includes("<canvas"))).toBe(true);
    expect(lockedMarkup.match(/class="item-3d-showcase-stub"/g)).toHaveLength(1);
    expect(lockedMarkup).toContain(`1–12 / ${purchasableItems.length} trang bị`);
    expect(lockedMarkup).toMatch(/<button[^>]*disabled=""[^>]*>Trang trước<\/button>/);
    expect(lockedMarkup).not.toMatch(/<button[^>]*disabled=""[^>]*>Trang sau<\/button>/);

    state.character.xp = 50000;
    const unlockedLevel = levelProgress(state.character.xp).level;
    expect(unlockedLevel).toBeGreaterThanOrEqual(lockedCyberKatana.level);

    const unlockedMarkup = renderToStaticMarkup(
      createElement(ReferenceShop, { state, act, busy: false, navigate }),
    );
    expect(unlockedMarkup).toContain(`Sau khi mua: ${state.gold - lockedCyberKatana.price} G`);
    expect(unlockedMarkup).not.toMatch(/<button[^>]*disabled=""[^>]*>Mua trang bị/);
  });
});

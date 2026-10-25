import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FURNITURE_CATALOG } from "../../src/furniture/catalog";
import { createInitialState } from "../../src/domain/engine";
import FurnitureShop from "../../src/components/furniture/FurnitureShop";
import { getFurnitureProjection } from "../../src/components/furniture/furniture-projection";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

function renderShop(options: { gold?: number; xp?: number; busy?: boolean; owned?: Record<string, number> } = {}) {
  const state = createInitialState("furniture-shop-test", "2026-01-01T00:00:00.000Z");
  state.gold = options.gold ?? 100000;
  state.character.xp = options.xp ?? 100000;
  state.ownedFurniture = options.owned ?? {};
  const before = JSON.stringify(state);
  const act = vi.fn();
  const onPlace = vi.fn();
  const html = renderToStaticMarkup(createElement(FurnitureShop, { state, act, onPlace, busy: options.busy }));
  return { html, state, before, act, onPlace };
}

const cards = (html: string) => [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match => match[0]);

describe("FurnitureShop", () => {
  it("renders every real catalog item with its own recipe projection", () => {
    const { html } = renderShop();
    const renderedCards = cards(html);
    expect(FURNITURE_CATALOG).toHaveLength(123);
    expect(renderedCards).toHaveLength(123);
    for (const item of FURNITURE_CATALOG) {
      expect(renderedCards.filter(card => card.includes(`class="furniture-card-name">${item.name}</span>`)), item.id).toHaveLength(1);
    }
    const projections = renderedCards.map(card => card.match(/<svg class="furniture-projection"[\s\S]*?<\/svg>/)?.[0]);
    expect(projections.every(projection => projection?.includes('<path') && projection.includes('fill-rule="evenodd"'))).toBe(true);
    expect(new Set(projections).size).toBe(FURNITURE_CATALOG.length);
    FURNITURE_CATALOG.forEach((item, index) => {
      const paths = [...projections[index]!.matchAll(/<path\b[^>]*>/g)].map(match => match[0]);
      expect(paths.every(path => path.includes('fill-rule="evenodd"')), item.id).toBe(true);
      expect(paths.map(path => path.match(/\bd="([^"]+)"/)?.[1]), item.id).toEqual(getFurnitureProjection(item).faces.map(face => face.path));
    });
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain("Tương tác sau khi đặt");
    expect(html).toContain("bản xem trước không kích hoạt tương tác");
  });

  it("keeps preview rendering side-effect free and owned counts read-only", () => {
    const result = renderShop({ owned: { [FURNITURE_CATALOG[0].id]: 3 } });
    expect(JSON.stringify(result.state)).toBe(result.before);
    expect(result.act).not.toHaveBeenCalled();
    expect(result.onPlace).not.toHaveBeenCalled();
    expect(result.html).toContain("3 món");
    expect(result.html).not.toContain("món trong kho");
    expect(cards(result.html).filter(card => card.includes("furniture-place-button"))).toHaveLength(1);
  });

  it("uses square-root XP level and disables level-locked purchases", () => {
    const lowLevel = renderShop({ xp: 0 });
    expect(lowLevel.html).toContain("CẤP 1");
    const lowCards = cards(lowLevel.html);
    FURNITURE_CATALOG.forEach((item, index) => {
      expect(/class="furniture-buy-button"[^>]* disabled=""/.test(lowCards[index])).toBe(item.level > 1);
    });
  });

  it("uses square-root XP progression at higher levels", () => {
    expect(renderShop({ xp: 400 }).html).toContain("CẤP 3");
  });

  it.each([{ gold: 0 }, { busy: true }])("disables all purchases when unavailable: %j", options => {
    expect(cards(renderShop(options).html).every(card => /class="furniture-buy-button"[^>]* disabled=""/.test(card))).toBe(true);
  });

  it("declares one persistent Canvas and reuses the home FurnitureModel without interaction handlers", () => {
    const source = readFileSync(resolve(__dirname, "../../src/components/world/FurniturePreview.tsx"), "utf8");
    expect(source.match(/<Canvas\b/g)).toHaveLength(1);
    expect(source).toContain('<FurnitureModel kind={kind} active />');
    expect(source).not.toContain("onInteract=");
    expect(source).not.toMatch(/<Canvas[^>]*\bkey=/);
    for (const label of ["Xoay trái", "Xoay phải", "Thu nhỏ", "Phóng to", "Khôi phục góc nhìn"]) expect(source).toContain(`aria-label="${label}"`);
  });
});

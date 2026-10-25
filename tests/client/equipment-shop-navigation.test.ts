import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceShop } from "@/components/game/ReferencePanels";
import { ITEMS } from "@/domain/catalog";
import { createInitialState, levelProgress } from "@/domain/engine";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
      return [hooks.values[index], (next: unknown) => {
        hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next;
      }];
    },
    useRef: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = { current: initial };
      return hooks.values[index];
    },
  };
});
vi.mock("next/dynamic", () => ({ default: () => () => null }));

type Props = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  value?: string;
  onClick?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
  [key: string]: unknown;
};
type Element = ReactElement<Props>;

function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Props>(child)) return [];
    const name = typeof child.type === "function" ? child.type.name : "";
    const expanded = ["Categories", "ActionButton", "Inspector", "Header", "Empty"].includes(name)
      ? (child.type as (props: Props) => ReactNode)(child.props)
      : child.props.children;
    return [child, ...elements(expanded)];
  });
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<Props>(child) ? text(child.props.children) : String(child)).join("");
}
function mountShop() {
  const state = createInitialState("shop-navigation", "2026-01-01T00:00:00.000Z");
  state.gold = 100000;
  state.character.xp = 50000;
  const act = vi.fn();
  const navigate = vi.fn();
  let busy = false;
  let tree: ReactNode;
  const render = () => {
    hooks.cursor = 0;
    tree = ReferenceShop({ state, act, navigate, busy });
  };
  render();
  const all = () => elements(tree);
  const button = (label: string) => {
    const found = all().find(node => node.type === "button" && text(node.props.children).trim() === label);
    expect(found, `button ${label}`).toBeDefined();
    return found!;
  };
  const cards = () => all().filter(node => node.type === "button" && node.props["data-shop-item-id"]);
  const ids = () => cards().map(node => node.props["data-shop-item-id"] as string);
  const inspector = () => all().find(node => typeof node.type === "function" && node.type.name === "Inspector")!;
  const selected = () => (inspector().props.item as { id: string }).id;
  const click = (label: string) => {
    const node = button(label);
    expect(node.props.disabled).not.toBe(true);
    node.props.onClick!();
    render();
  };
  const filter = (label: string, value: string) => {
    const field = all().find(node => node.type === "label" && text(node.props.children).startsWith(label));
    expect(field, `field ${label}`).toBeDefined();
    const control = elements(field!.props.children).find(node => node.type === "input" || node.type === "select")!;
    control.props.onChange!({ target: { value } });
    render();
  };
  const selectCard = (id: string) => {
    const card = cards().find(node => node.props["data-shop-item-id"] === id)!;
    expect(card).toBeDefined();
    card.props.onClick!();
    render();
  };
  return { state, act, navigate, render, all, button, cards, ids, selected, click, filter, selectCard, setBusy: (value: boolean) => { busy = value; render(); }, html: () => renderToStaticMarkup(tree) };
}

const catalog = ITEMS.filter(item => item.price > 0);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

beforeEach(() => { hooks.values = []; hooks.cursor = 0; });

describe("equipment shop navigation handlers", () => {
  it("covers the complete catalog in non-overlapping pages of twelve with exact bounds", () => {
    const shop = mountShop();
    const before = JSON.stringify(shop.state);
    const seen: string[] = [];
    const pageCount = Math.ceil(catalog.length / 12);
    for (let page = 1; page <= pageCount; page++) {
      expect(shop.ids()).toEqual(catalog.slice((page - 1) * 12, page * 12).map(item => item.id));
      expect(shop.button("Trang trước").props.disabled).toBe(page === 1);
      expect(shop.button("Trang sau").props.disabled).toBe(page === pageCount);
      expect(shop.html()).toContain(`Trang ${page} / ${pageCount}`);
      seen.push(...shop.ids());
      if (page < pageCount) shop.click("Trang sau");
    }
    expect(seen).toEqual(catalog.map(item => item.id));
    expect(new Set(seen).size).toBe(catalog.length);
    shop.click("Trang trước");
    expect(shop.ids()).toEqual(catalog.slice((pageCount - 2) * 12, (pageCount - 1) * 12).map(item => item.id));
    expect(shop.act).not.toHaveBeenCalled();
    expect(JSON.stringify(shop.state)).toBe(before);
  });

  it("matches Vietnamese accents, đ, uppercase, trimmed queries, and IDs", () => {
    const shop = mountShop();
    const accented = catalog.find(item => /đ/i.test(item.name))!;
    expect(accented).toBeDefined();
    shop.click("Trang sau");
    for (const query of [accented.name, `  ${normalize(accented.name).toUpperCase()}  `, accented.id]) {
      shop.filter("Tìm trang bị", query);
      const expected = catalog.filter(item => normalize(`${item.name} ${item.id}`).includes(normalize(query).trim()));
      expect(shop.ids()).toEqual(expected.slice(0, 12).map(item => item.id));
      expect(shop.ids()).toContain(accented.id);
      expect(shop.button("Trang trước").props.disabled).toBe(true);
    }
    expect(shop.act).not.toHaveBeenCalled();
  });

  it("combines category, rarity, ownership and level filters with current state", () => {
    const shop = mountShop();
    const target = catalog.find(item => item.slot === "weapon")!;
    shop.state.inventory = [{ id: "owned-target", definitionId: target.id, enhancement: 0, acquiredAt: "2026-01-01T00:00:00.000Z" }];
    shop.render();
    shop.click("Vũ khí");
    shop.filter("Độ hiếm", target.rarity);
    shop.filter("Sở hữu", "owned");
    shop.filter("Cấp yêu cầu", "available");
    expect(shop.ids()).toEqual([target.id]);
    shop.filter("Sở hữu", "unowned");
    expect(shop.ids()).toEqual(catalog.filter(item => item.slot === "weapon" && item.rarity === target.rarity && item.id !== target.id && item.level <= levelProgress(shop.state.character.xp).level).slice(0, 12).map(item => item.id));
    shop.click("Xóa bộ lọc");
    shop.state.character.xp = 0;
    shop.render();
    shop.filter("Cấp yêu cầu", "locked");
    expect(shop.ids()).toEqual(catalog.filter(item => item.level > 1).slice(0, 12).map(item => item.id));
    shop.click("Xóa bộ lọc");
    shop.click("Giáp & bảo hộ");
    expect(shop.ids()).toEqual(catalog.filter(item => ["head", "chest", "gloves", "boots"].includes(item.slot)).slice(0, 12).map(item => item.id));
    shop.click("Phụ kiện");
    expect(shop.ids()).toEqual(catalog.filter(item => item.slot.startsWith("accessory")).slice(0, 12).map(item => item.id));
  });

  it("keeps the selected inspector across pages, filters and empty results without actions", () => {
    const shop = mountShop();
    const before = JSON.stringify(shop.state);
    const selected = shop.ids()[1];
    shop.selectCard(selected);
    expect(shop.cards().find(card => card.props["data-shop-item-id"] === selected)?.props["aria-pressed"]).toBe(true);
    shop.click("Trang sau");
    expect(shop.selected()).toBe(selected);
    expect(shop.cards().every(card => !card.props["aria-pressed"])).toBe(true);
    shop.filter("Tìm trang bị", "no-such-equipment-xyz");
    expect(shop.ids()).toEqual([]);
    expect(shop.selected()).toBe(selected);
    expect(shop.html()).toContain("0 trang bị phù hợp");
    expect(shop.html()).toContain("Không có trang bị phù hợp");
    expect(shop.button("Trang trước").props.disabled).toBe(true);
    expect(shop.button("Trang sau").props.disabled).toBe(true);
    shop.click("Xóa bộ lọc");
    expect(shop.selected()).toBe(selected);
    expect(shop.cards().find(card => card.props["data-shop-item-id"] === selected)?.props["aria-pressed"]).toBe(true);
    expect(shop.act).not.toHaveBeenCalled();
    expect(JSON.stringify(shop.state)).toBe(before);
  });

  it("requires confirmation, cancels it during browsing, and dispatches only the selected buy", () => {
    const shop = mountShop();
    const selected = shop.ids()[0];
    shop.selectCard(selected);
    shop.click("Mua trang bị");
    expect(shop.act).not.toHaveBeenCalled();
    shop.click("Hủy");
    expect(shop.act).not.toHaveBeenCalled();
    for (const browse of [() => shop.click("Trang sau"), () => shop.filter("Tìm trang bị", selected), () => shop.selectCard(selected)]) {
      shop.click("Mua trang bị");
      browse();
      expect(shop.all().some(node => node.props["aria-label"] === "Xác nhận mua")).toBe(false);
      expect(shop.act).not.toHaveBeenCalled();
    }
    shop.click("Mua trang bị");
    shop.click("Xác nhận mua");
    expect(shop.act).toHaveBeenCalledExactlyOnceWith({ type: "item.buy", definitionId: selected });
    expect(shop.all().some(node => node.props["aria-label"] === "Xác nhận mua")).toBe(false);
    shop.click("Mở túi đồ");
    expect(shop.navigate).toHaveBeenCalledWith("inventory");
    for (const [label, destination] of [["Thời trang", "character"], ["Nội thất", "furniture"], ["Bạn đồng hành", "pets"]]) {
      shop.click(label);
      expect(shop.navigate).toHaveBeenCalledWith(destination);
    }
  });

  it("guards confirmation against changed gold, level and busy props including exact boundaries", () => {
    const shop = mountShop();
    const item = catalog.find(entry => entry.id === "cyber-katana")!;
    let xp = 0;
    while (levelProgress(xp).level < item.level) xp++;
    shop.state.character.xp = xp;
    shop.state.gold = item.price;
    shop.render();
    expect(shop.button("Mua trang bị").props.disabled).toBe(false);
    shop.click("Mua trang bị");
    for (const gate of ["gold", "level", "busy"]) {
      shop.state.gold = gate === "gold" ? item.price - 1 : item.price;
      shop.state.character.xp = gate === "level" ? xp - 1 : xp;
      shop.setBusy(gate === "busy");
      const confirm = shop.button("Xác nhận mua");
      expect(confirm.props.disabled).toBe(true);
      confirm.props.onClick!();
      expect(shop.act).not.toHaveBeenCalled();
    }
    shop.state.character.xp = xp;
    shop.state.gold = item.price;
    shop.setBusy(false);
    shop.click("Xác nhận mua");
    expect(shop.act).toHaveBeenCalledExactlyOnceWith({ type: "item.buy", definitionId: item.id });
  });

  it("keeps one unkeyed preview and scopes responsive layout without changing other panels", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/game/ReferencePanels.tsx"), "utf8");
    const shopSource = source.slice(source.indexOf("export function ReferenceShop"), source.indexOf("export function ReferenceCrafting"));
    expect(shopSource.match(/<Inspector\b/g)).toHaveLength(1);
    expect(shopSource).not.toMatch(/<Inspector[^>]*\bkey=/);
    expect(shopSource).not.toContain("<Canvas");
    expect(shopSource.indexOf('className="equipment-shop-preview"')).toBeLessThan(shopSource.indexOf('className="ref-collection"'));
    const css = readFileSync(resolve(process.cwd(), "src/components/equipment/equipment-shop.css"), "utf8");
    expect(css).toContain("overflow: clip");
    expect(css).toContain("position: sticky");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("position: static");
    expect(css).toContain("max-height: 200px");
    expect(css).not.toMatch(/^\s*\.ref-panel\s*\{/m);
  });
});

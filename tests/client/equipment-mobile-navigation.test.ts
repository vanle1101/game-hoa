import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Children, createElement as actualReactCreateElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceShop } from "@/components/game/ReferencePanels";
import { ITEMS } from "@/domain/catalog";
import { createInitialState } from "@/domain/engine";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) {
        hooks.values[index] = typeof initial === "function" ? initial() : initial;
      }
      return [
        hooks.values[index],
        (next: unknown) => {
          hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) {
        hooks.values[index] = { current: initial };
      }
      return hooks.values[index];
    },
  };
});

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicShowcaseStub({ item }: { item?: { id: string; name: string } }) {
      return actualReactCreateElement("div", {
        className: "item-3d-showcase",
        "data-preview-id": item?.id,
      });
    },
}));

type ElementProps = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  value?: string;
  tabIndex?: number;
  ref?: { current: HTMLElement | null } | ((instance: HTMLElement | null) => void);
  onClick?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
  [key: string]: unknown;
};

type TraversalElement = ReactElement<ElementProps>;

function collectElements(node: ReactNode): TraversalElement[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<ElementProps>(child)) return [];
    const name = typeof child.type === "function" ? child.type.name : "";
    const expanded = ["Categories", "ActionButton", "Inspector", "Header", "Empty"].includes(name)
      ? (child.type as (props: ElementProps) => ReactNode)(child.props)
      : child.props.children;
    return [child, ...collectElements(expanded)];
  });
}

function extractText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => (isValidElement<ElementProps>(child) ? extractText(child.props.children) : String(child)))
    .join("");
}

function mountMobileShop(options?: { reducedMotion?: boolean; mediaReducedMotion?: boolean }) {
  const state = createInitialState("shop-mobile-nav", "2026-01-01T00:00:00.000Z");
  state.gold = 100000;
  state.character.xp = 50000;
  state.settings.reducedMotion = Boolean(options?.reducedMotion);

  const scrollIntoView = vi.fn();
  const focus = vi.fn();
  const previewDomStub = { scrollIntoView, focus } as unknown as HTMLElement;

  if (options?.mediaReducedMotion !== undefined) {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion") ? options.mediaReducedMotion : false,
      })),
    });
  } else {
    vi.unstubAllGlobals();
  }

  const act = vi.fn();
  const navigate = vi.fn();
  let tree: ReactNode;

  const render = () => {
    hooks.cursor = 0;
    tree = ReferenceShop({ state, act, navigate, busy: false });
    const previewAside = collectElements(tree).find(
      (el) => el.type === "aside" && el.props.className === "equipment-shop-preview",
    );
    const refTarget = previewAside?.props?.ref;
    if (typeof refTarget === "function") {
      refTarget(previewDomStub);
    } else if (refTarget && typeof refTarget === "object") {
      refTarget.current = previewDomStub;
    }
  };

  render();

  const all = () => collectElements(tree);
  const button = (label: string) => {
    const found = all().find((node) => node.type === "button" && extractText(node.props.children).trim() === label);
    expect(found, `button ${label}`).toBeDefined();
    return found!;
  };
  const cards = () => all().filter((node) => node.type === "button" && node.props["data-shop-item-id"]);
  const mobileBar = () => {
    const found = all().find((node) => node.type === "div" && node.props.className === "equipment-shop-mobile-bar");
    expect(found, "mobile sticky selected-item bar").toBeDefined();
    return found!;
  };
  const selectCard = (id: string) => {
    const card = cards().find((node) => node.props["data-shop-item-id"] === id);
    expect(card, `card ${id}`).toBeDefined();
    card!.props.onClick!();
    render();
  };
  const click = (label: string) => {
    const target = button(label);
    expect(target.props.disabled).not.toBe(true);
    target.props.onClick!();
    render();
  };
  const filter = (label: string, value: string) => {
    const field = all().find((node) => node.type === "label" && extractText(node.props.children).startsWith(label));
    expect(field, `field ${label}`).toBeDefined();
    const control = collectElements(field!.props.children).find(
      (node) => node.type === "input" || node.type === "select",
    )!;
    control.props.onChange!({ target: { value } });
    render();
  };

  return {
    state,
    act,
    navigate,
    scrollIntoView,
    focus,
    render,
    all,
    button,
    cards,
    mobileBar,
    selectCard,
    click,
    filter,
    html: () => renderToStaticMarkup(tree),
  };
}

const catalog = ITEMS.filter((item) => item.price > 0);

beforeEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
  vi.unstubAllGlobals();
});

describe("equipment shop mobile sticky selected-item bar and explicit inspector jump", () => {
  it("updates selected item name in the mobile bar on card tap without auto-scrolling, then scrolls inspector into view on 'Xem mô hình đã chọn'", () => {
    const shop = mountMobileShop({ reducedMotion: false, mediaReducedMotion: false });
    const before = JSON.stringify(shop.state);

    const initialItem = catalog.find((item) => item.id === "cyber-katana") || catalog[0];
    expect(shop.mobileBar().props["role"]).toBe("region");
    expect(shop.mobileBar().props["aria-label"]).toBe("Trang bị đang chọn");
    expect(shop.mobileBar().props["data-selected-item-id"]).toBe(initialItem.id);
    expect(extractText(shop.mobileBar().props.children)).toContain(initialItem.name);

    const secondItem = catalog[3];
    shop.selectCard(secondItem.id);

    expect(shop.scrollIntoView).not.toHaveBeenCalled();
    expect(shop.focus).not.toHaveBeenCalled();
    expect(shop.mobileBar().props["data-selected-item-id"]).toBe(secondItem.id);
    expect(extractText(shop.mobileBar().props.children)).toContain(secondItem.name);
    expect(extractText(shop.mobileBar().props.children)).toContain(`${secondItem.price} G · CẤP ${secondItem.level}`);

    shop.click("Xem mô hình đã chọn");
    expect(shop.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth", block: "start" });
    expect(shop.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });

    expect(shop.act).not.toHaveBeenCalled();
    expect(JSON.stringify(shop.state)).toBe(before);
  });

  it("respects reduced motion preferences from either game settings or prefers-reduced-motion media query", () => {
    const settingShop = mountMobileShop({ reducedMotion: true, mediaReducedMotion: false });
    settingShop.click("Xem mô hình đã chọn");
    expect(settingShop.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "auto", block: "start" });

    hooks.values = [];
    hooks.cursor = 0;
    const mediaShop = mountMobileShop({ reducedMotion: false, mediaReducedMotion: true });
    mediaShop.click("Xem mô hình đã chọn");
    expect(mediaShop.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "auto", block: "start" });
  });

  it("persists the selected item and mobile jump bar across pagination, filters, and empty search results with a single preview", () => {
    const shop = mountMobileShop({ reducedMotion: true });
    const targetItem = catalog[2];
    shop.selectCard(targetItem.id);

    shop.click("Trang sau");
    expect(shop.mobileBar().props["data-selected-item-id"]).toBe(targetItem.id);
    expect(extractText(shop.mobileBar().props.children)).toContain(targetItem.name);

    shop.filter("Tìm trang bị", "khong-co-trang-bi-xyz");
    expect(shop.cards()).toHaveLength(0);
    expect(shop.mobileBar().props["data-selected-item-id"]).toBe(targetItem.id);
    expect(extractText(shop.mobileBar().props.children)).toContain(targetItem.name);

    shop.click("Xem mô hình đã chọn");
    expect(shop.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "auto", block: "start" });
    expect(shop.html().match(/class="item-3d-showcase"/g)).toHaveLength(1);
    expect(shop.act).not.toHaveBeenCalled();
  });

  it("keeps desktop layout unchanged while avoiding bottom-nav and screen-keyboard overlaps in mobile CSS rules", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/equipment/equipment-shop.css"), "utf8");

    expect(css).toMatch(/\.equipment-shop-mobile-bar\s*\{\s*display:\s*none;/);
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".equipment-shop-mobile-jump");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("scroll-margin-top: 72px");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("bottom: calc(74px + env(safe-area-inset-bottom, 0px))");
    expect(css).toContain("@media (max-width: 760px) and (max-height: 520px)");
    expect(css).toContain(".equipment-shop:has(.equipment-shop-search input:focus) .equipment-shop-mobile-bar");
  });
});

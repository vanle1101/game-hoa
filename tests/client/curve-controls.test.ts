import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConstructionEditor from "@/components/construction/ConstructionEditor";
import { createInitialState, applyAction } from "@/domain/engine";
import { getBuilding, quoteConstruction } from "@/construction";
import { createCurve, CURVE_FRAMES, CURVE_MATERIALS, CURVE_PROFILE_LIMITS } from "@/construction/curves";
import type { BuildingPlan, GridPoint } from "@/construction/types";
import type { Action } from "@/domain/types";
import { retainCommand, type CommandStorage } from "@/components/game/command-client";

// Curve controls are rendered with a minimal hook harness; apartment-store
// subscriptions are covered separately with the real Zustand store.
vi.mock("@/components/construction/apartment-store", () => ({
  useApartmentPlan: () => null,
  useApartmentStore: { getState: () => ({ edit: () => {}, discard: () => {} }) },
}));

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  type Effect = { deps?: unknown[]; cleanup?: () => void };
  const effect = (callback: () => void | (() => void), deps?: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.values[index] as Effect | undefined;
    if (previous && deps && previous.deps?.every((value, i) => Object.is(value, deps[i]))) return;
    hooks.values[index] = { deps };
    hooks.effects.push(() => {
      previous?.cleanup?.();
      (hooks.values[index] as Effect).cleanup = callback() || undefined;
    });
  };
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
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = hooks.cursor++;
      const previous = hooks.values[index] as { callback: unknown; deps: unknown[] } | undefined;
      if (!previous || !previous.deps.every((value, i) => Object.is(value, deps[i]))) hooks.values[index] = { callback, deps };
      return (hooks.values[index] as { callback: unknown }).callback;
    },
    useEffect: effect,
    useLayoutEffect: effect,
  };
});
vi.mock("next/dynamic", () => ({ default: () => () => null }));

type Props = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => unknown;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault: () => void; currentTarget: Record<string, string> }) => void;
  onGesture?: (a: GridPoint, b: GridPoint) => void;
  onSelect?: (selection: { kind: "curve"; id: string }) => void;
  [key: string]: unknown;
};
type Element = ReactElement<Props>;
const text = (node: ReactNode): string => Children.toArray(node).map(child => isValidElement<Props>(child) ? text(child.props.children) : String(child)).join("");
const elements = (node: ReactNode): Element[] => Children.toArray(node).flatMap(child => isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function memory(): CommandStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
let storage: CommandStorage;
let listeners: Map<string, Set<(event: unknown) => void>>;
beforeEach(() => {
  hooks.values = []; hooks.cursor = 0; hooks.effects = [];
  storage = memory(); listeners = new Map();
  vi.stubGlobal("window", {
    localStorage: storage, sessionStorage: memory(),
    addEventListener: (name: string, callback: (event: unknown) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); },
    removeEventListener: (name: string, callback: (event: unknown) => void) => listeners.get(name)?.delete(callback),
  });
  vi.stubGlobal("navigator", { locks: { request: async (name: string, _options: unknown, callback: (lock: { name: string }) => unknown) => callback({ name }) } });
  vi.stubGlobal("HTMLElement", class {});
  vi.stubGlobal("FormData", class { constructor(private values: Record<string, string>) {} get(key: string) { return this.values[key] ?? null; } });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  for (const entry of hooks.values) if (entry && typeof entry === "object" && "cleanup" in entry) (entry as { cleanup?: () => void }).cleanup?.();
  vi.unstubAllGlobals();
});

async function editor(options: { pending?: boolean; startMode?: "build" | "buy"; initialFurnitureId?: string } = {}) {
  const state = createInitialState("curve-controls-owner", "2026-10-16T08:00:00.000Z");
  state.gold = 10000; state.character.xp = 3600;
  const building = getBuilding(state);
  building.plan = {
    floors: Array.from({ length: 64 }, (_, i) => ({ x: i % 8 - 4, z: Math.floor(i / 8) - 4, level: 0, materialId: "floor-concrete" })),
    walls: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
    curves: [createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "selected-curve")],
  };
  state.building = building;
  if (options.pending) retainCommand(storage, state.userId, { type: "construction.commit", expectedRevision: building.revision, plan: structuredClone(building.plan) }, () => "pending-curve", "2026-10-16T08:00:00.000Z");
  let currentState = state;
  const onState = vi.fn(next => { currentState = next; });
  let tree: ReactNode;
  const render = () => {
    hooks.cursor = 0;
    const wrapper = ConstructionEditor({ state: currentState, onState, onExit: vi.fn(), onInteract: vi.fn(), startMode: options.startMode, initialFurnitureId: options.initialFurnitureId });
    tree = (wrapper.type as (props: typeof wrapper.props) => ReactNode)(wrapper.props);
    hooks.effects.splice(0).forEach(effect => effect());
  };
  render(); await flush(); render();
  const all = () => elements(tree);
  const world = () => all().find(node => node.props.onGesture)!;
  const plan = () => world().props.plan as BuildingPlan;
  const button = (label: string) => {
    const result = all().find(node => node.type === "button" && (node.props["aria-label"] === label || text(node.props.children).trim() === label));
    expect(result, label).toBeDefined(); return result!;
  };
  const field = (label: string) => {
    const result = all().find(node => (node.type === "input" || node.type === "select") && node.props["aria-label"] === label);
    expect(result, label).toBeDefined(); return result!;
  };
  const click = (label: string) => { const result = button(label).props.onClick!(); render(); return result; };
  const edit = (label: string, value: string) => { field(label).props.onChange!({ target: { value } }); render(); };
  const key = (key: string, modifiers = {}) => { listeners.get("keydown")?.forEach(callback => callback({ key, target: {}, preventDefault: vi.fn(), ...modifiers })); render(); };
  const select = () => { world().props.onSelect!({ kind: "curve", id: "selected-curve" }); render(); };
  const quote = () => {
    const footer = all().find(node => node.props.className === "construction-cost")!;
    return text(elements(footer.props.children).find(node => node.type === "strong")!.props.children);
  };
  return { state, onState, render, all, world, plan, button, field, click, edit, key, select, quote };
}
const numeric = [["Bán kính kính cong", "radius", "2"], ["Góc cung kính cong", "angle", "120"], ["Chiều cao kính cong", "height", "2.4"], ["Độ dày kính cong", "thickness", "0.08"]] as const;

describe("selected curved-glass editor controls", () => {
  it("edits each canonical dimension locally and recalculates the actual quote without submitting", async () => {
    const ui = await editor(); ui.select();
    const before = structuredClone(ui.state);
    for (const [label, key, value] of numeric) {
      expect(ui.field(label).props.min).toBe(CURVE_PROFILE_LIMITS[key].min);
      expect(ui.field(label).props.max).toBe(CURVE_PROFILE_LIMITS[key].max);
      ui.edit(label, value);
      expect(ui.plan().curves![0][key]).toBe(Number(value));
      expect(ui.quote()).toBe(`${quoteConstruction(getBuilding(ui.state), ui.plan(), ui.state.gold).netCost} G`);
    }
    expect(ui.plan().curves![0]).toMatchObject({ radius: 2, angle: 120, height: 2.4, thickness: 0.08 });
    expect(ui.state).toEqual(before); expect(ui.onState).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(ui.button("Lưu công trình").props.disabled).toBe(false);
  });

  it("offers only canonical material and frame choices and preserves identity", async () => {
    const ui = await editor(); ui.select();
    for (const [label, key, choices] of [["Vật liệu kính cong", "material", CURVE_MATERIALS], ["Khung kính cong", "frame", CURVE_FRAMES]] as const) {
      expect(elements(ui.field(label).props.children).map(option => option.props.value)).toEqual([...choices]);
      for (const choice of choices) { ui.edit(label, choice); expect(ui.plan().curves![0][key]).toBe(choice); }
      const before = structuredClone(ui.plan()); ui.edit(label, "invalid-choice"); expect(ui.plan()).toEqual(before);
    }
    expect(ui.plan().curves![0]).toMatchObject({ id: "selected-curve", catalogId: "curve-bay", x: 0, z: 0, level: 0, rotation: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["", "NaN", "Infinity", "-1", "999"])("keeps invalid radius %j out of the plan and blocks save until corrected", async value => {
    const ui = await editor(); ui.select(); ui.edit("Chiều cao kính cong", "2.4");
    const before = structuredClone(ui.plan());
    ui.edit("Bán kính kính cong", value);
    expect(ui.plan()).toEqual(before); expect(ui.field("Bán kính kính cong").props["aria-invalid"]).toBe(true);
    expect(ui.button("Lưu công trình").props.disabled).toBe(true);
    ui.edit("Bán kính kính cong", "2");
    expect(ui.field("Bán kính kính cong").props["aria-invalid"]).toBe(false);
    expect(ui.button("Lưu công trình").props.disabled).toBe(false); expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects off-step angles and unsupported thickness and recalculates footprint validation", async () => {
    const ui = await editor(); ui.select(); const before = structuredClone(ui.plan());
    ui.edit("Góc cung kính cong", "121"); ui.edit("Độ dày kính cong", "0.01");
    expect(ui.plan()).toEqual(before);
    ui.edit("Góc cung kính cong", "120"); ui.edit("Độ dày kính cong", "0.08");
    ui.edit("Bán kính kính cong", "4");
    expect(ui.plan().curves![0].radius).toBe(4);
    expect(ui.button("Lưu công trình").props.disabled).toBe(true);
    expect(ui.all().some(node => node.props.role === "status")).toBe(true);
    ui.edit("Bán kính kính cong", "2"); expect(ui.button("Lưu công trình").props.disabled).toBe(false);
  });

  it("supports undo, redo and selected rotation without touching persisted state", async () => {
    const ui = await editor(); ui.click("Chọn"); ui.select(); const before = structuredClone(ui.state);
    ui.edit("Bán kính kính cong", "2"); ui.key("z", { ctrlKey: true });
    expect(ui.plan().curves![0].radius).toBe(before.building!.plan.curves![0].radius);
    ui.key("y", { ctrlKey: true }); expect(ui.plan().curves![0].radius).toBe(2);
    ui.key("r"); expect(ui.plan().curves![0].rotation).toBe(15);
    ui.click("Hoàn tác bản nháp"); expect(ui.plan().curves![0].rotation).toBe(0);
    ui.click("Làm lại bản nháp"); expect(ui.plan().curves![0].rotation).toBe(15);
    expect(ui.state).toEqual(before); expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the edited snapshot only after confirmation and reconciles the canonical response", async () => {
    const ui = await editor(); ui.select();
    for (const [label, , value] of numeric) ui.edit(label, value);
    const submitted = structuredClone(ui.plan());
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      if (init?.method !== "POST") return new Response(JSON.stringify({ state: ui.state }));
      const { action } = JSON.parse(String(init.body)) as { action: Action };
      const result = applyAction(ui.state, action, { userId: ui.state.userId, now: "2026-10-16T08:00:00.000Z", random: () => 0.5, eventId: "curve-commit" });
      return new Response(JSON.stringify(result));
    });
    ui.click("Lưu công trình"); expect(fetch).not.toHaveBeenCalled();
    await ui.click("Xác nhận lưu"); ui.render();
    const posts = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]!.body)).action.plan).toEqual(submitted);
    expect(ui.onState).toHaveBeenCalledOnce(); expect(ui.plan()).toEqual(submitted);
    expect(ui.button("Lưu công trình").props.disabled).toBe(true);
  });

  it("locks mutations, forms, undo/redo and R during flight and after an uncertain saved receipt", async () => {
    const ui = await editor(); ui.click("Chọn"); ui.select(); ui.click("Nhập tọa độ chính xác");
    ui.edit("Bán kính kính cong", "2");
    let rejectPost!: (reason: Error) => void;
    vi.mocked(fetch).mockImplementation(async (_url, init) => init?.method !== "POST" ? new Response(JSON.stringify({ state: ui.state })) : new Promise((_resolve, reject) => { rejectPost = reject; }));
    ui.click("Lưu công trình"); const saving = ui.click("Xác nhận lưu"); await flush(); ui.render();
    const before = structuredClone(ui.plan());
    const attemptEdits = () => {
      expect(ui.all().find(node => node.type === "fieldset")!.props.disabled).toBe(true);
      for (const label of ["Hoàn tác bản nháp", "Làm lại bản nháp", "Hủy bản nháp", "Lưu công trình"]) expect(ui.button(label).props.disabled).toBe(true);
      ui.edit("Bán kính kính cong", "3"); ui.edit("Khung kính cong", "brass");
      for (const [key, modifiers] of [["z", { ctrlKey: true }], ["y", { ctrlKey: true }], ["z", { ctrlKey: true, shiftKey: true }], ["r", {}]] as const) ui.key(key, modifiers);
      ui.click("Hoàn tác bản nháp"); ui.click("Làm lại bản nháp"); ui.click("Tháo cấu kiện"); ui.click("Xoay kính đã chọn tiến 15 độ");
      ui.world().props.onGesture!({ x: 1, z: 1, level: 0 }, { x: 2, z: 2, level: 0 });
      for (const form of ui.all().filter(node => node.type === "form")) form.props.onSubmit!({ preventDefault: vi.fn(), currentTarget: { "curve-x": "1", "curve-z": "1", x1: "1", z1: "1", x2: "2", z2: "2", edge: "x" } });
      ui.render(); expect(ui.plan()).toEqual(before);
    };
    attemptEdits(); rejectPost(new Error("lost response")); await saving; ui.render();
    const retained = storage.getItem(`lifelevel-pending-command:${ui.state.userId}`);
    expect(retained).not.toBeNull(); attemptEdits();
    expect(storage.getItem(`lifelevel-pending-command:${ui.state.userId}`)).toBe(retained);
    expect(ui.button("Thử lại giao dịch đang chờ").props.disabled).toBe(false);
  });

  it("locks an already persisted pending snapshot on mount without losing its receipt", async () => {
    const ui = await editor({ pending: true }); const before = structuredClone(ui.plan());
    const receipt = storage.getItem(`lifelevel-pending-command:${ui.state.userId}`);
    expect(receipt).not.toBeNull();
    expect(ui.button("Thử lại giao dịch đang chờ").props.disabled).toBe(false);
    expect(ui.all().find(node => node.type === "fieldset")!.props.disabled).toBe(true);
    ui.click("Kính cong"); ui.key("r"); ui.key("z", { ctrlKey: true });
    ui.world().props.onGesture!({ x: 0, z: 0, level: 0 }, { x: 0, z: 0, level: 0 }); ui.render();
    expect(ui.plan()).toEqual(before); expect(storage.getItem(`lifelevel-pending-command:${ui.state.userId}`)).toBe(receipt);
    expect(fetch).not.toHaveBeenCalled();
  });
});

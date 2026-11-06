import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Matrix4, Vector3, type Camera, type Light, type Mesh, type MeshStandardMaterial, type Object3D, type Scene } from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";
import { constructionContext, validateConstruction } from "../../src/construction/engine";
import type { BuildingFurniture, BuildingPlan } from "../../src/construction/types";
import { getFurnitureDefinition, getFurnitureRecipe } from "../../src/furniture/catalog";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";
const BLOCKED = "Đồ vật chưa có lối tiếp cận. Di chuyển nội thất hoặc thêm cửa.";
const CANVAS = ".world-canvas canvas";
const DESTINATIONS = ["Phục hồi sau một ngày dài", "Tập trung sâu", "Bộ trang bị", "Xưởng chế tạo"];

type Entry = {
  id: string;
  part: string;
  width: number;
  depth: number;
  toggle?: true;
  heading?: string;
  scope?: string;
  pose?: "sleeping" | "working";
};
const TOGGLES: Entry[] = [
  { id: "neon-floor-lamp", part: "light-ring", width: 1, depth: 1, toggle: true },
  { id: "flat-tv", part: "picture", width: 3, depth: 1, toggle: true },
  { id: "v7-paper-lantern", part: "diffuser", width: 1, depth: 1, toggle: true },
  { id: "v7-info-terminal", part: "display", width: 1, depth: 1, toggle: true },
];
const ROUTES: Entry[] = [
  { id: "cloud-bed", part: "blanket-0.4", width: 3, depth: 4, heading: "Phục hồi sau một ngày dài", pose: "sleeping" },
  { id: "workstation", part: "desktop", width: 3, depth: 1, heading: "Tập trung sâu", scope: ".focus-panel", pose: "working" },
  { id: "wardrobe", part: "door-1", width: 2, depth: 1, heading: "Bộ trang bị" },
  { id: "tool-bench", part: "worktop", width: 3, depth: 1, heading: "Xưởng chế tạo", scope: ".ref-workshop", pose: "working" },
];

type Placement = BuildingFurniture & { width: number; depth: number };
type PartState = {
  name: string;
  mesh: string;
  geometry: string;
  material: string;
  color: number[];
  emissive: number[];
  intensity: number;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  visible: boolean;
  matrix: number[];
};
type Frame = {
  at: number;
  canvas: boolean;
  avatar: { uuid: string; x: number; y: number; z: number; rotationX: number; rotationY: number } | null;
  destinations: string[];
  intensities: Record<string, number[]>;
};
type Snapshot = {
  scene: string;
  avatar: Frame["avatar"];
  models: Record<string, { uuid: string; parts: PartState[] }>;
  lights: { uuid: string; type: string; intensity: number; color: number[] }[];
  view: number[];
  projection: number[];
};
type ObservedScene = Scene & { __r3f?: { root: { getState: () => { gl: { domElement: HTMLCanvasElement }; camera: Camera } } } };
type Observer = {
  scenes: ObservedScene[];
  frames: Frame[];
  stop: boolean;
  snapshot: () => Snapshot | null;
  start: () => void;
};
type ProbeWindow = Window & { __THREE_DEVTOOLS__?: EventTarget; __furnitureV7: Observer };

async function installObserver(page: Page, placements: Placement[]) {
  await page.addInitScript(({ placements, destinations, canvasSelector }) => {
    localStorage.setItem("lifelevel-entered", "true");
    const host = window as unknown as ProbeWindow;
    const observer: Observer = { scenes: [], frames: [], stop: true, snapshot: () => null, start: () => {} };
    host.__furnitureV7 = observer;
    const tools = host.__THREE_DEVTOOLS__ ?? new EventTarget();
    host.__THREE_DEVTOOLS__ = tools;
    tools.addEventListener("observe", event => {
      const object = (event as CustomEvent).detail as ObservedScene | undefined;
      if (object?.isScene && !observer.scenes.includes(object)) observer.scenes.push(object);
    });
    const flatten = (root: Object3D): Object3D[] => [root, ...root.children.flatMap(flatten)];
    const locate = () => {
      const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
      if (!canvas) return null;
      const candidates = observer.scenes.filter(scene => scene.__r3f?.root.getState().gl.domElement === canvas);
      if (candidates.length !== 1) return null;
      const scene = candidates[0];
      const nodes = flatten(scene);
      const rigs = nodes.filter(node => node.name === "character-rig");
      if (rigs.length !== 1 || !rigs[0].parent) return null;
      const groups: Record<string, Object3D> = {};
      for (const item of placements) {
        const matches = nodes.filter(node => node.name === `furniture:${item.furnitureId}`
          && Math.abs(node.matrixWorld.elements[12] - item.x - item.width / 2) < .001
          && Math.abs(node.matrixWorld.elements[14] - item.z - item.depth / 2) < .001);
        if (matches.length !== 1) return null;
        groups[item.id] = matches[0];
      }
      return { canvas, scene, nodes, groups, avatar: rigs[0].parent };
    };
    const avatarState = (node: Object3D): NonNullable<Frame["avatar"]> => ({
      uuid: node.uuid, x: node.position.x, y: node.position.y, z: node.position.z,
      rotationX: node.rotation.x, rotationY: node.rotation.y,
    });
    const meshes = (group: Object3D) => flatten(group).filter(node => (node as Mesh).isMesh) as Mesh[];
    observer.snapshot = () => {
      const found = locate();
      if (!found) return null;
      const camera = found.scene.__r3f!.root.getState().camera;
      const models: Snapshot["models"] = {};
      for (const [id, group] of Object.entries(found.groups)) {
        const parts = meshes(group).map(mesh => {
          if (Array.isArray(mesh.material)) throw new Error(`Unexpected material array: ${mesh.name}`);
          const material = mesh.material as MeshStandardMaterial;
          if (!material.isMeshStandardMaterial) throw new Error(`Unexpected material type: ${mesh.name}`);
          return {
            name: mesh.name, mesh: mesh.uuid, geometry: mesh.geometry.uuid, material: material.uuid,
            color: material.color.toArray(), emissive: material.emissive.toArray(), intensity: material.emissiveIntensity,
            roughness: material.roughness, metalness: material.metalness, opacity: material.opacity,
            transparent: material.transparent, visible: mesh.visible && group.visible,
            matrix: [...mesh.matrixWorld.elements],
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        models[id] = { uuid: group.uuid, parts };
      }
      return {
        scene: found.scene.uuid, avatar: avatarState(found.avatar), models,
        lights: found.nodes.filter(node => (node as Light).isLight).map(node => {
          const light = node as Light;
          return { uuid: light.uuid, type: light.type, intensity: light.intensity, color: light.color.toArray() };
        }).sort((a, b) => a.uuid.localeCompare(b.uuid)),
        view: [...camera.matrixWorldInverse.elements], projection: [...camera.projectionMatrix.elements],
      };
    };
    observer.start = () => {
      const found = locate();
      if (!found) throw new Error("Unique live world, furniture instances, and avatar are required");
      observer.stop = false;
      const frames: Frame[] = [];
      observer.frames = frames;
      const started = performance.now();
      const tracked = Object.fromEntries(Object.entries(found.groups).map(([id, group]) => [id, meshes(group)]));
      const record = () => {
        if (observer.stop || observer.frames !== frames) return;
        const headings = [...document.querySelectorAll("h1,h2,h3")].map(node => node.textContent?.trim());
        frames.push({
          at: performance.now() - started, canvas: found.canvas.isConnected,
          avatar: avatarState(found.avatar), destinations: destinations.filter(text => headings.includes(text)),
          intensities: Object.fromEntries(Object.entries(tracked).map(([id, items]) => [id, items.map(mesh => (mesh.material as MeshStandardMaterial).emissiveIntensity)])),
        });
        if (frames.length < 900 && performance.now() - started < 12_000 && found.canvas.isConnected) requestAnimationFrame(record);
      };
      record();
    };
  }, { placements, destinations: DESTINATIONS, canvasSelector: CANVAS });
}

async function snapshot(page: Page): Promise<Snapshot> {
  const result = await page.evaluate(() => (window as unknown as ProbeWindow).__furnitureV7.snapshot());
  expect(result, "Passive Three observer must identify the live world without fallback").not.toBeNull();
  return result!;
}

async function startTrace(page: Page) {
  await page.evaluate(() => (window as unknown as ProbeWindow).__furnitureV7.start());
}

async function trace(page: Page, stop = false): Promise<Frame[]> {
  return page.evaluate(stop => {
    const observer = (window as unknown as ProbeWindow).__furnitureV7;
    if (stop) observer.stop = true;
    return observer.frames;
  }, stop);
}

async function clickPart(page: Page, scene: Snapshot, item: Placement, partName: string, info: TestInfo) {
  const parts = scene.models[item.id].parts.filter(part => part.name === partName);
  expect(parts, `Exact named part ${item.id}/${partName}`).toHaveLength(1);
  const part = parts[0];
  const box = await page.locator(CANVAS).boundingBox();
  expect(box).not.toBeNull();
  const projected = new Vector3(part.matrix[12], part.matrix[13], part.matrix[14])
    .applyMatrix4(new Matrix4().fromArray(scene.view)).applyMatrix4(new Matrix4().fromArray(scene.projection));
  expect(Math.abs(projected.x)).toBeLessThan(1);
  expect(Math.abs(projected.y)).toBeLessThan(1);
  expect(Math.abs(projected.z)).toBeLessThan(1);
  const x = box!.x + (projected.x + 1) * box!.width / 2;
  const y = box!.y + (1 - projected.y) * box!.height / 2;
  expect(await page.evaluate(({ x, y, selector }) => document.elementFromPoint(x, y) === document.querySelector(selector), { x, y, selector: CANVAS }), "Projected furniture click must not hit an HTML overlay").toBe(true);
  await info.attach(`click-${item.id}-${partName}`, { body: JSON.stringify({ item, part, x, y, box, projected }), contentType: "application/json" });
  await page.mouse.click(x, y);
}

function perimeter(item: Placement) {
  const cells: { x: number; z: number }[] = [];
  for (let x = item.x; x < item.x + item.width; x++) {
    cells.push({ x: x + .5, z: item.z - .5 }, { x: x + .5, z: item.z + item.depth + .5 });
  }
  for (let z = item.z; z < item.z + item.depth; z++) {
    cells.push({ x: item.x - .5, z: z + .5 }, { x: item.x + item.width + .5, z: z + .5 });
  }
  return cells.filter(point => point.x >= -4.5 && point.x <= 4.5 && point.z >= -4.5 && point.z <= 4.5);
}

function distanceToArrival(frame: Frame, item: Placement) {
  if (!frame.avatar) return Infinity;
  return Math.min(...perimeter(item).map(point => Math.hypot(frame.avatar!.x - point.x, frame.avatar!.z - point.z)));
}

function assertTravel(frames: Frame[], item: Placement) {
  expect(frames.length).toBeGreaterThan(4);
  const start = frames[0].avatar!;
  expect(frames.every(frame => frame.avatar?.uuid === start.uuid)).toBe(true);
  expect(frames.some(frame => frame.avatar && Math.hypot(frame.avatar.x - start.x, frame.avatar.z - start.z) > .15 && distanceToArrival(frame, item) > .12), "Must observe real movement before reaching furniture").toBe(true);
  expect(frames.some(frame => distanceToArrival(frame, item) <= .06), "Must reach a legal orthogonal perimeter cell").toBe(true);
  for (const frame of frames) {
    expect(frame.avatar!.x).toBeGreaterThanOrEqual(-4.501);
    expect(frame.avatar!.x).toBeLessThanOrEqual(4.501);
    expect(frame.avatar!.z).toBeGreaterThanOrEqual(-4.501);
    expect(frame.avatar!.z).toBeLessThanOrEqual(4.501);
    if (frame.destinations.length) expect(distanceToArrival(frame, item), "Destination UI must not activate before arrival").toBeLessThanOrEqual(.06);
  }
}

function assertPower(after: Snapshot, baseline: Snapshot, item: Placement, active: boolean) {
  const recipe = getFurnitureRecipe(item.furnitureId)!;
  const expectedParts = [...recipe.parts].sort((a, b) => a.id.localeCompare(b.id));
  const before = baseline.models[item.id];
  const actual = after.models[item.id];
  expect(actual.uuid).toBe(before.uuid);
  expect(actual.parts.map(part => part.name)).toEqual(expectedParts.map(part => part.id));
  let luminous = 0;
  let dark = 0;
  actual.parts.forEach((part, index) => {
    const original = before.parts[index];
    const definition = expectedParts[index];
    const isLuminous = definition.material === "glow" || definition.material === "screen" || definition.surface === "display";
    expect({ ...part, emissive: original.emissive, intensity: original.intensity }).toEqual(original);
    if (isLuminous) {
      luminous++;
      expect(original.intensity).toBe(definition.surface === "display" ? .7 : 1.25);
      expect(Math.max(...original.emissive)).toBeGreaterThan(0);
      expect(part.intensity).toBe(active ? original.intensity : 0);
      expect(part.emissive).toEqual(active ? original.emissive : [0, 0, 0]);
    } else {
      dark++;
      expect(part.intensity).toBe(0);
      expect(part.emissive).toEqual([0, 0, 0]);
    }
    expect(part.visible).toBe(true);
  });
  expect(luminous, "Fixture must contain an actual emissive control").toBeGreaterThan(0);
  expect(dark, "Fixture must contain a non-luminous negative control").toBeGreaterThan(0);
  expect(after.lights).toEqual(baseline.lights);
  expect(after.scene).toBe(baseline.scene);
}

function conserved(state: GameState) {
  return {
    gold: state.gold, ledger: state.ledger, character: state.character, journal: state.journal,
    inventory: state.inventory, materials: state.materials, equipment: state.equipment,
    building: state.building, ownedFurniture: state.ownedFurniture, tasks: state.tasks,
    occurrences: state.occurrences, rewardBudgets: state.rewardBudgets,
  };
}

type Game = {
  state: () => GameState;
  placements: Placement[];
  commands: Action[];
  baseline: ReturnType<typeof conserved>;
  traces: { label: string; frames: Frame[] }[];
  screenshots: (label: string) => Promise<void>;
  assertUntouched: () => void;
};

async function scenario(page: Page, info: TestInfo, entry: Entry, blocked: boolean, run: (game: Game) => Promise<void>) {
  let state = createInitialState(`furniture-behavior-v7-${entry.id}-${blocked ? "blocked" : "open"}-not-live-db`, NOW);
  state = applyAction(state, { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() }).state;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  Object.assign(state.character, { hp: 60, energy: 50, mood: 55 });
  const definition = getFurnitureDefinition(entry.id)!;
  expect(Math.ceil(definition.width)).toBe(entry.width);
  expect(Math.ceil(definition.depth)).toBe(entry.depth);
  expect(getFurnitureRecipe(entry.id)!.parts.filter(part => part.id === entry.part)).toHaveLength(1);
  const placements: Placement[] = [{ id: "target", furnitureId: entry.id, x: 2, z: 1, level: 0, rotation: 0, width: entry.width, depth: entry.depth }];
  if (entry.toggle && !blocked) placements.push({ ...placements[0], id: "control", x: -3 });
  state.ownedFurniture[entry.id] = placements.length;
  const plan: BuildingPlan = {
    floors: Array.from({ length: 100 }, (_, index) => ({ x: index % 10 - 5, z: Math.floor(index / 10) - 5, level: 0, materialId: "floor-concrete" })),
    walls: blocked ? Array.from({ length: 10 }, (_, index) => ({ x: 1, z: index - 5, level: 0, orientation: "z" as const, materialId: "wall-basic" })) : [],
    furniture: placements.map(({ id, furnitureId, x, z, level, rotation }) => ({ id, furnitureId, x, z, level, rotation })),
    curves: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
  };
  state.building!.plan = validateConstruction(state.building!, plan, constructionContext(state));
  const commands: Action[] = [];
  const errors: string[] = [];
  const rejected: string[] = [];
  const requests: { method: string; path: string; action?: string }[] = [];
  const traces: Game["traces"] = [];
  const responses = new Map<string, ReturnType<typeof applyAction>>();
  page.on("pageerror", error => errors.push(error.message));
  await installObserver(page, placements);
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    const url = new URL(request.url());
    const record: (typeof requests)[number] = { method: request.method(), path: url.pathname };
    requests.push(record);
    if (url.pathname !== "/api/game" || !["GET", "POST"].includes(request.method())) {
      rejected.push(`${record.method} ${record.path}`);
      await route.fulfill({ status: 503, json: { error: "Unrelated API disabled in isolated fixture" } });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ json: { state, mode: "local" } });
      return;
    }
    const body = request.postDataJSON() as { action: Action; expectedOwnerId: string; key: string };
    record.action = body.action.type;
    commands.push(body.action);
    if (body.expectedOwnerId !== state.userId) {
      rejected.push("OWNER_CHANGED");
      await route.fulfill({ status: 409, json: { code: "OWNER_CHANGED" } });
      return;
    }
    try {
      if (!body.key) throw new Error("Missing game command idempotency key");
      const key = body.key;
      const result = responses.get(key) ?? applyAction(state, body.action, { userId: state.userId, now: NOW, random: () => .5, eventId: key });
      responses.set(key, result);
      state = result.state;
      await route.fulfill({ json: result });
    } catch (error) {
      rejected.push(String(error));
      await route.fulfill({ status: 422, json: { error: String(error) } });
    }
  });
  let baseline = structuredClone(conserved(state));
  const game: Game = {
    state: () => state, placements, commands, baseline, traces,
    screenshots: async label => {
      const path = info.outputPath(`${label}.png`);
      await page.screenshot({ path });
      await info.attach(label, { path, contentType: "image/png" });
    },
    assertUntouched: () => {
      expect(conserved(state)).toEqual(baseline);
      expect(commands.filter(action => action.type !== "reconcile")).toEqual([]);
      expect(errors).toEqual([]);
      expect(rejected).toEqual([]);
    },
  };
  try {
    await page.goto("/");
    await expect(page.locator(CANVAS)).toHaveCount(1);
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect(page.locator(".world-controls > span")).toHaveText(/^\d+ FPS$/);
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as ProbeWindow).__furnitureV7.snapshot())), { timeout: 15_000 }).toBe(true);
    const first = await snapshot(page);
    expect(first.avatar!.x).toBeCloseTo(.5, 5);
    expect(first.avatar!.z).toBeCloseTo(.5, 5);
    expect(first.lights.length).toBeGreaterThan(0);
    expect(commands.filter(action => action.type !== "reconcile")).toEqual([]);
    baseline = structuredClone(conserved(state));
    game.baseline = baseline;
    await info.attach("isolated-fixture", { body: JSON.stringify({ source: "createInitialState + applyAction housing.settle; all /api intercepted; not database-backed", now: NOW, plan, baseline }), contentType: "application/json" });
    await run(game);
    expect(errors).toEqual([]);
    expect(rejected).toEqual([]);
  } finally {
    let finalObservation: unknown;
    try {
      finalObservation = await page.evaluate(() => {
        const observer = (window as unknown as ProbeWindow).__furnitureV7;
        observer.stop = true;
        return { frames: observer.frames, snapshot: observer.snapshot() };
      });
    } catch (error) { finalObservation = { unavailable: String(error) }; }
    await info.attach("acceptance-observations", { body: JSON.stringify({ entry, blocked, requests, commands, errors, rejected, traces, finalObservation, state }), contentType: "application/json" });
  }
}

test.describe("bounded furniture behavior v7", () => {
  test.describe.configure({ mode: "default", timeout: 60_000 });

  for (const entry of TOGGLES) {
    test(`${entry.id}: arrival-gated same-mesh power and independent instances`, async ({ page }, info) => {
      await scenario(page, info, entry, false, async game => {
        const initial = await snapshot(page);
        const [target, control] = game.placements;
        assertPower(initial, initial, target, true);
        assertPower(initial, initial, control, true);
        expect(initial.models.target.uuid).not.toBe(initial.models.control.uuid);
        expect(initial.models.target.parts[0].material).not.toBe(initial.models.control.parts[0].material);
        await game.screenshots("both-on");
        const active = { target: true, control: true };
        for (const [index, item] of [target, control, target, control].entries()) {
          const before = await snapshot(page);
          await startTrace(page);
          await clickPart(page, before, item, entry.part, info);
          active[item.id as keyof typeof active] = !active[item.id as keyof typeof active];
          const expected = active[item.id as keyof typeof active] ? 1.25 : 0;
          await expect.poll(async () => (await snapshot(page)).models[item.id].parts.find(part => part.name === entry.part)!.intensity, { timeout: 9_000 }).toBe(expected);
          await expect.poll(async () => {
            const observed = await trace(page);
            return observed.some(frame => JSON.stringify(frame.intensities[item.id]) !== JSON.stringify(observed[0].intensities[item.id]));
          }, { timeout: 2_000 }).toBe(true);
          const frames = await trace(page, true);
          game.traces.push({ label: `toggle-${index}-${item.id}`, frames });
          assertTravel(frames, item);
          const startingIntensities = frames[0].intensities[item.id];
          const changed = frames.find(frame => JSON.stringify(frame.intensities[item.id]) !== JSON.stringify(startingIntensities));
          expect(changed, "A rendered material change must be observed").toBeDefined();
          expect(distanceToArrival(changed!, item), "Power may change only at the approach destination").toBeLessThanOrEqual(.06);
          for (const frame of frames) {
            if (distanceToArrival(frame, item) > .06) expect(frame.intensities[item.id]).toEqual(startingIntensities);
            expect(frame.destinations).toEqual([]);
            expect(frame.canvas).toBe(true);
          }
          const after = await snapshot(page);
          assertPower(after, initial, target, active.target);
          assertPower(after, initial, control, active.control);
          game.assertUntouched();
          await game.screenshots(`toggle-${index}-${item.id}`);
        }
        expect((await snapshot(page)).models).toEqual(initial.models);
        await expect(page.locator(CANVAS)).toBeVisible();
      });
    });
  }

  for (const entry of ROUTES) {
    test(`${entry.id}: walk and arrive before opening the exact destination`, async ({ page }, info) => {
      await scenario(page, info, entry, false, async game => {
        const item = game.placements[0];
        await startTrace(page);
        await clickPart(page, await snapshot(page), item, entry.part, info);
        const heading = (entry.scope ? page.locator(entry.scope) : page).getByRole("heading", { name: entry.heading!, exact: true });
        await expect(heading).toHaveCount(1);
        await expect(heading).toBeVisible();
        await expect(page.locator(CANVAS)).toHaveCount(0);
        await expect.poll(async () => (await trace(page)).some(frame => frame.destinations.includes(entry.heading!)), { timeout: 2_000 }).toBe(true);
        const frames = await trace(page, true);
        game.traces.push({ label: "destination-arrival", frames });
        assertTravel(frames, item);
        const activation = frames.find(frame => frame.destinations.includes(entry.heading!));
        expect(activation, "Passive frame trace must include actual destination UI").toBeDefined();
        expect(distanceToArrival(activation!, item)).toBeLessThanOrEqual(.06);
        expect(frames.filter(frame => frame.destinations.length).every(frame => frame.destinations.every(text => text === entry.heading))).toBe(true);
        if (entry.pose) {
          expect(frames.some(frame => distanceToArrival(frame, item) <= .06 && Math.abs(frame.avatar!.y - (entry.pose === "sleeping" ? .86 : -.27)) < .001 && Math.abs(frame.avatar!.rotationX - (entry.pose === "sleeping" ? -Math.PI / 2 : 0)) < .001), "Arrival must expose the expected avatar pose before UI routing").toBe(true);
        }
        game.assertUntouched();
        await game.screenshots("destination-before-any-confirmation");
        if (entry.id === "cloud-bed") {
          await expect(page.getByText("Nghỉ ngơi ngoài đời rồi ghi nhận hồi phục trong hồ sơ nhân vật.", { exact: true })).toBeVisible();
          const confirm = page.getByRole("button", { name: "Ghi nhận đã nghỉ ngơi", exact: true });
          await expect(confirm).toHaveCount(1);
          await expect(confirm).toBeEnabled();
          expect(game.state().character).toEqual(game.baseline.character);
          await confirm.click();
          await expect.poll(() => game.commands.filter(action => action.type !== "reconcile")).toEqual([{ type: "character.rest" }]);
          await expect.poll(() => game.state().character.energy).toBe(75);
          expect(game.state().character.hp).toBe(70);
          expect(game.state().character.mood).toBe(65);
          expect(game.state().gold).toBe(game.baseline.gold);
          expect(game.state().ledger).toEqual(game.baseline.ledger);
          expect(game.state().journal.filter(event => event.type === "character.rest")).toHaveLength(1);
          await expect(page.getByText("HP 70 · Năng lượng 75 · Tâm trạng 65", { exact: true })).toBeVisible();
          await game.screenshots("explicit-rest-confirmed");
        }
      });
    });
  }

  for (const entry of [...TOGGLES, ...ROUTES]) {
    test(`${entry.id}: solid partition prevents movement and activation`, async ({ page }, info) => {
      await scenario(page, info, entry, true, async game => {
        const initial = await snapshot(page);
        const item = game.placements[0];
        if (entry.toggle) assertPower(initial, initial, item, true);
        await startTrace(page);
        await clickPart(page, initial, item, entry.part, info);
        await expect(page.getByText(BLOCKED, { exact: true })).toBeVisible();
        await expect.poll(async () => (await trace(page)).at(-1)?.at ?? 0, { timeout: 5_000 }).toBeGreaterThanOrEqual(2_000);
        const frames = await trace(page, true);
        game.traces.push({ label: "blocked-two-second-window", frames });
        expect(frames.length).toBeGreaterThan(10);
        for (const frame of frames) {
          expect(frame.canvas).toBe(true);
          expect(frame.destinations).toEqual([]);
          expect(frame.avatar).toEqual(frames[0].avatar);
          expect(frame.intensities).toEqual(frames[0].intensities);
        }
        const after = await snapshot(page);
        expect(after.models).toEqual(initial.models);
        expect(after.lights).toEqual(initial.lights);
        await expect(page.locator(CANVAS)).toBeVisible();
        await expect(page.getByRole("button", { name: "Ghi nhận đã nghỉ ngơi", exact: true })).toHaveCount(0);
        game.assertUntouched();
        await game.screenshots("blocked-no-activation");
      });
    });
  }
});

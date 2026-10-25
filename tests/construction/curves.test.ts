import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { gameCommand, readGame } from "../../src/server/store";
import { createInitialState } from "../../src/domain/engine";
import { CURVED_GLASS_CATALOG, buildingItem } from "../../src/construction/catalog";
import { createCurve, curveBounds, curveContainsPoint, curveFootprint, curveIntersectsRect, curveIntersectsSegment, curvePoint, curvesIntersect, snapCurveRotation } from "../../src/construction/curves";
import { commitConstruction, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { cellKey, emptyPlan, rectangleRoom } from "../../src/construction/grid";
import { findBuildingPath, occupiedCells, safeSpawn, walkableNeighbors } from "../../src/construction/navigation";
import { buildingPlanSchema, buildingStateSchema } from "../../src/construction/schema";
import { detectRooms } from "../../src/construction/topology";
import type { BuildingPlan, BuildingState, ConstructionContext } from "../../src/construction/types";
import { addCurveDraft, moveCurveDraft, removeCurveDraft, rotateCurveDraft, pushDraft, undoDraft, redoDraft, type DraftHistory } from "../../src/components/construction/draft";
import { curveGeometry, curveFrameGeometry, residenceCityOffset } from "../../src/components/construction/render-geometry";

const point = (x = 0, z = 0, level = 0) => ({ x, z, level });
const context: ConstructionContext = { gold: 100000, characterLevel: 10, ownedFurniture: { "haven-sofa": 1 }, defeatedCampaign: true };
function platform(): BuildingPlan {
  const plan = emptyPlan();
  for (let x = -5; x < 5; x++) for (let z = -5; z < 5; z++) plan.floors.push({ ...point(x, z), materialId: "floor-concrete" });
  return plan;
}
function building(plan = platform()): BuildingState { return { version: 1, revision: 0, plot: { minX: -8, maxX: 8, minZ: -8, maxZ: 8, maxLevel: 2, cellSize: 1 }, plan, paid: {}, starterGrantApplied: true, migratedAt: "2026-10-15T12:00:00.000Z", legacyPlacementsPreserved: true }; }
function withCurve(catalogId = "curve-bay", rotation = 0): BuildingPlan { return { ...platform(), curves: [createCurve(catalogId, point(), "glass-1", rotation)] }; }

describe("bounded analytic curved-glass geometry", () => {
  it("defines exactly six distinct bounded archetypes and snaps rotations in both directions", () => {
    expect(CURVED_GLASS_CATALOG).toHaveLength(6);
    expect(new Set(CURVED_GLASS_CATALOG.map(item => JSON.stringify(item.curve))).size).toBe(6);
    expect([snapCurveRotation(8), snapCurveRotation(352), snapCurveRotation(359), snapCurveRotation(-16)]).toEqual([15, 345, 0, 345]);
    expect(() => createCurve("wall-basic", point(), "bad")).toThrow(/archetype/);
  });
  it.each(CURVED_GLASS_CATALOG.map(item => [item.id]))("validates %s at every snapped angle", id => {
    for (let rotation = 0; rotation < 360; rotation += 15) {
      const plan = withCurve(id, rotation), curve = plan.curves![0];
      expect(buildingPlanSchema.safeParse(plan).success).toBe(true);
      expect(validateConstruction(building(), plan, context).curves).toEqual(plan.curves);
      expect(curveFootprint(curve).length).toBeGreaterThan(0);
      expect(curveContainsPoint(curve, curvePoint(curve, curve.rotation + curve.angle / 2))).toBe(true);
    }
  });
  it("uses analytic extrema rather than endpoint-only bounds and excludes the hollow center", () => {
    const curve = createCurve("curve-alcove", point(), "a", 315);
    expect(curveBounds(curve).maxX).toBeCloseTo(1.57);
    expect(curveBounds(curve).maxZ).toBeCloseTo(1.57);
    expect(curveIntersectsRect(curve, { minX: -.2, maxX: .2, minZ: -.2, maxZ: .2 })).toBe(false);
    expect(curveContainsPoint(curve, point())).toBe(false);
  });
  it("detects tangency, radial end caps and chord crossings without box approximations", () => {
    const curve = createCurve("curve-bay", point(), "a");
    expect(curveIntersectsSegment(curve, { x: 1.5, z: -.2 }, { x: 1.5, z: .2 })).toBe(true);
    expect(curveIntersectsSegment(curve, { x: 0, z: 1.56 }, { x: 2, z: 1.56 })).toBe(true);
    expect(curveIntersectsSegment(curve, { x: -.1, z: -.1 }, { x: .1, z: .1 })).toBe(false);
    expect(curveIntersectsSegment(curve, { x: .8, z: .8 }, { x: 1.4, z: 1.4 })).toBe(true);
    expect(curveIntersectsSegment(curve, { x: 1.5, z: 0 }, { x: 1.5, z: 0 })).toBe(true);
  });
  it("distinguishes concentric separated shells, crossing shells and separate levels", () => {
    const a = createCurve("curve-bay", point(), "a"), b = createCurve("curve-corner", point(), "b");
    expect(curvesIntersect(a, b)).toBe(false);
    expect(curvesIntersect(a, { ...a, id: "copy", rotation: 30 })).toBe(true);
    expect(curvesIntersect(a, { ...a, id: "copy", x: 1, rotation: 90 })).toBe(true);
    expect(curvesIntersect(a, { ...a, id: "upstairs", level: 1 })).toBe(false);
    expect(curvesIntersect(a, { ...a, id: "far", x: 5 })).toBe(false);
  });
});

describe("curve persistence and authoritative construction checks", () => {
  it("preserves absent optional curves in old plans and round-trips curves in building state", () => {
    const old = building(); expect(buildingStateSchema.parse(old)).toEqual(old);
    expect(buildingPlanSchema.parse(emptyPlan())).not.toHaveProperty("curves");
    const updated = building(withCurve()); expect(buildingStateSchema.parse(JSON.parse(JSON.stringify(updated)))).toEqual(updated);
  });
  it("rejects non-snapped rotations, unknown fields, oversized arrays and forged profiles", () => {
    const plan = withCurve();
    for (const changes of [{ rotation: 16 }, { rotation: 360 }, { radius: Infinity }, { price: 0 }, { x: .5 }]) expect(buildingPlanSchema.safeParse({ ...plan, curves: [{ ...plan.curves![0], ...changes }] }).success).toBe(false);
    expect(buildingPlanSchema.safeParse({ ...plan, curves: Array.from({ length: 129 }, () => plan.curves![0]) }).success).toBe(false);
    for (const changes of [{ radius: 4.1 }, { angle: 61 }, { thickness: .31 }, { height: 2.9 }, { material: "free-glass" }, { frame: "none" }, { catalogId: "wall-basic" }]) expect(() => validateConstruction(building(), { ...plan, curves: [{ ...plan.curves![0], ...changes }] }, context)).toThrow();
    for (const changes of [{ radius: 2 }, { angle: 60 }, { thickness: .2 }, { height: 1.5 }]) expect(validateConstruction(building(), { ...plan, curves: [{ ...plan.curves![0], ...changes }] }, context).curves![0]).toMatchObject(changes);
    expect(() => validateConstruction(building(), { ...plan, curves: [plan.curves![0], plan.curves![0]] }, context)).toThrow(/Duplicate/);
  });
  it("enforces curve unlocks, plot limits, arc-extrema limits and complete supporting floors", () => {
    expect(() => validateConstruction(building(), withCurve("curve-bow"), { ...context, characterLevel: 1 })).toThrow(/not unlocked/);
    const plan = withCurve(); plan.curves![0].x = 7;
    expect(() => validateConstruction(building(), plan, context)).toThrow(/outside/);
    plan.curves![0] = createCurve("curve-alcove", point(), "a", 315);
    expect(() => validateConstruction({ ...building(), plot: { ...building().plot, maxZ: 1 } }, plan, context)).toThrow(/outside/);
    const supported = withCurve(), missing = cellKey(curveFootprint(supported.curves![0])[0]);
    supported.floors = supported.floors.filter(cell => cellKey(cell) !== missing);
    expect(() => validateConstruction(building(), supported, context)).toThrow(/floor support/);
    expect(() => validateConstruction(building(), { ...withCurve(), curves: [createCurve("curve-bay", point(0, 0, 1), "up")] }, { ...context, characterLevel: 1 })).toThrow(/outside/);
  });
  it("rejects overlaps with walls, openings, furniture and other curved glass", () => {
    const walls = withCurve(); walls.walls.push({ ...point(1, 0), orientation: "z", materialId: "wall-basic" });
    expect(() => validateConstruction(building(), walls, context)).toThrow(/straight wall/);
    walls.walls[0].opening = { kind: "door", catalogId: "door-standard" };
    expect(() => validateConstruction(building(), walls, context)).toThrow(/straight wall/);
    const furniture = withCurve(); furniture.furniture.push({ ...point(0, 0), furnitureId: "haven-sofa", id: "sofa", rotation: 0 });
    expect(() => validateConstruction(building(), furniture, context)).toThrow(/furniture or a staircase/);
    const overlap = withCurve(); overlap.curves!.push({ ...overlap.curves![0], id: "second", rotation: 15 });
    expect(() => validateConstruction(building(), overlap, context)).toThrow(/overlap/);
  });
  it("rejects glass crossing supported staircase landings", () => {
    const plan = withCurve(); plan.floors.push(...platform().floors.map(cell => ({ ...cell, level: 1 })));
    plan.stairs.push({ ...point(1, 0), orientation: "z", catalogId: "stairs-basic" });
    expect(() => validateConstruction(building(), plan, context)).toThrow(/staircase/);
  });
  it("charges server catalog price, preserves payment for moves, caps refunds and checks revision/funds", () => {
    const base = building(), plan = withCurve(), price = buildingItem("curve-bay")!.price;
    expect(quoteConstruction(base, plan, context.gold)).toMatchObject({ cost: price, refund: 0, added: 1 });
    const saved = commitConstruction(base, plan, 0, context).building;
    const moved = structuredClone(plan); moved.curves![0].x = -1; moved.curves![0].rotation = 15;
    expect(commitConstruction(saved, moved, 1, context).quote).toMatchObject({ cost: 0, refund: 0 });
    const capped = { ...saved, paid: { ...saved.paid, "curve:glass-1": 999999 } };
    expect(quoteConstruction(capped, platform(), context.gold).refund).toBe(Math.floor(price * .5));
    expect(quoteConstruction(building(plan), platform(), context.gold).refund).toBe(0);
    expect(() => commitConstruction(base, plan, 0, { ...context, gold: price - 1 })).toThrow(/more Gold/);
    expect(() => commitConstruction(saved, moved, 0, context)).toThrow(/another tab/);
  });
});

describe("curve transactions through the isolated real local store", () => {
  it("persists optional curves, charges once, moves freely and refunds only paid Gold", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lifelevel-curves-test-"));
    try {
      vi.stubEnv("LOCAL_DEV_MODE", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOCAL_DATA_DIR", directory);
      const owner = "curves-owner", state = createInitialState(owner, "2026-10-15T12:00:00.000Z");
      state.gold = context.gold; state.character.xp = 10000; state.building = building();
      const file = path.join(directory, `${owner}.json`);
      await writeFile(file, JSON.stringify({ game: state, finance: { sentinel: "unchanged" }, proposals: {}, commands: {} }));
      expect((await readGame(owner)).building!.plan).not.toHaveProperty("curves");
      const plan = withCurve(), action = { type: "construction.commit" as const, expectedRevision: 0, plan };
      const first = await gameCommand(owner, "curve-add", action);
      const retry = await gameCommand(owner, "curve-add", action);
      expect(retry.state.gold).toBe(first.state.gold);
      expect((await readGame(owner)).building!.plan.curves).toEqual(plan.curves);
      expect(first.state.gold).toBe(context.gold - buildingItem("curve-bay")!.price);
      const moved = structuredClone(plan); moved.curves![0].rotation = 30; moved.curves![0].x = -1;
      const move = await gameCommand(owner, "curve-move", { type: "construction.commit", expectedRevision: 1, plan: moved });
      expect(move.state.gold).toBe(first.state.gold);
      expect((await readGame(owner)).building!.plan.curves).toEqual(moved.curves);
      const invalid = structuredClone(moved); invalid.curves![0].thickness = .31;
      await expect(gameCommand(owner, "curve-forged", { type: "construction.commit", expectedRevision: 2, plan: invalid })).rejects.toThrow();
      expect((await readGame(owner)).gold).toBe(move.state.gold);
      expect((await readGame(owner)).building!.revision).toBe(2);
      const removed = await gameCommand(owner, "curve-remove", { type: "construction.commit", expectedRevision: 2, plan: platform() });
      expect(removed.state.gold).toBe(context.gold - buildingItem("curve-bay")!.price / 2);
      const disk = JSON.parse(await readFile(file, "utf8"));
      expect(disk.finance).toEqual({ sentinel: "unchanged" });
      expect(disk.game.building.revision).toBe(3);
      expect(Object.keys(disk.commands)).toHaveLength(3);
    } finally {
      vi.unstubAllEnvs();
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith("lifelevel-curves-test-")) throw new Error("Unsafe cleanup");
      await rm(resolved, { recursive: true, force: true });
    }
  });
});

describe("curved-glass rendering and draft editing", () => {
  it.each(CURVED_GLASS_CATALOG.map(item => [item.id]))("extrudes a curved shell and bounded frame for %s", id => {
    const curve = createCurve(id, point(3, -2, 1), "mesh", 45);
    const local = { ...curve, x: 0, z: 0 }, bounds = curveBounds(local);
    const glass = curveGeometry(curve), frames = curveFrameGeometry(curve);
    expect(glass.getAttribute("position").count).toBeGreaterThan(24);
    expect(frames.length).toBeGreaterThan(0);
    for (const geometry of [glass, ...frames]) {
      const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
      expect(normal.count).toBe(position.count);
      let withinBounds = true, withinShell = true, finiteNormals = true;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i), radius = Math.hypot(x, z);
        withinBounds &&= x >= bounds.minX - 1e-5 && x <= bounds.maxX + 1e-5 && z >= bounds.minZ - 1e-5 && z <= bounds.maxZ + 1e-5 && y >= -1e-5 && y <= curve.height + 1e-5;
        withinShell &&= radius >= curve.radius - curve.thickness / 2 - 1e-5 && radius <= curve.radius + curve.thickness / 2 + 1e-5;
        finiteNormals &&= [normal.getX(i), normal.getY(i), normal.getZ(i)].every(Number.isFinite);
      }
      expect({ withinBounds, withinShell, finiteNormals }).toEqual({ withinBounds: true, withinShell: true, finiteNormals: true });
      geometry.dispose();
    }
  });
  it("adds, moves, snaps, removes and restores curved glass through immutable undo/redo", () => {
    const source = platform();
    const added = addCurveDraft(source, "curve-bay", point(), "edit", 8);
    expect(source).not.toHaveProperty("curves"); expect(added.curves![0].rotation).toBe(15);
    let history: DraftHistory = pushDraft({ past: [], present: source, future: [] }, added);
    const moved = moveCurveDraft(history.present, "edit", point(-1, -1));
    expect(added.curves![0].x).toBe(0); expect(moved.curves![0]).toMatchObject({ x: -1, z: -1, id: "edit" });
    history = pushDraft(history, moved);
    history = pushDraft(history, rotateCurveDraft(history.present, "edit", 359));
    expect(history.present.curves![0].rotation).toBe(0);
    history = pushDraft(history, removeCurveDraft(history.present, "edit"));
    expect(history.present.curves ?? []).toHaveLength(0);
    history = undoDraft(history); expect(history.present.curves![0]).toMatchObject({ x: -1, z: -1, rotation: 0 });
    history = undoDraft(history); expect(history.present.curves![0].rotation).toBe(15);
    history = redoDraft(history); expect(history.present.curves![0].rotation).toBe(0);
    history = redoDraft(history); expect(history.present.curves ?? []).toHaveLength(0);
    expect(history.present.walls).toEqual(source.walls);
  });
  it("changes actual city altitude while leaving local construction levels unchanged", () => {
    const plan = withCurve(), snapshot = structuredClone(plan);
    expect(residenceCityOffset()).toBe(-3);
    // City ground is authored at -48 m; each residence is (floor - 1) × 3.4 m above it.
    for (const floor of [8, 16, 24] as const) {
      expect(residenceCityOffset(floor) - 48).toBeCloseTo(-(floor - 1) * 3.4);
    }
    expect(plan).toEqual(snapshot);
    expect(plan.curves![0].level).toBe(0);
  });
});

describe("curves as navigation barriers without room topology claims", () => {
  it("blocks traversing an arc and avoids spawning inside glass", () => {
    const plan = withCurve(), curve = plan.curves![0];
    expect(walkableNeighbors(plan, point(0, 0)).map(cellKey)).not.toContain(cellKey(point(1, 0)));
    const route = findBuildingPath(plan, point(0, 0), point(2, 0));
    expect(route.length).toBeGreaterThan(0);
    for (let i = 1; i < route.length; i++) expect(curveIntersectsSegment(curve, { x: route[i - 1].x + .5, z: route[i - 1].z + .5 }, { x: route[i].x + .5, z: route[i].z + .5 })).toBe(false);
    const blocked = occupiedCells(plan); expect(blocked.size).toBeGreaterThan(0);
    const preferred = plan.floors.find(cell => blocked.has(cellKey(cell)))!;
    expect(safeSpawn(plan, preferred)).not.toEqual(preferred);
    expect(blocked.has(cellKey(safeSpawn(plan)!))).toBe(false);
  });
  it("leaves canonical straight-wall room topology unchanged", () => {
    const room = rectangleRoom(emptyPlan(), point(-3, -3), point(3, 3));
    const before = detectRooms(room);
    const after = { ...room, curves: [createCurve("curve-alcove", point(), "alcove")] };
    expect(detectRooms(after)).toEqual(before);
    expect(detectRooms(withCurve()).every(region => !region.enclosed)).toBe(true);
  });
});

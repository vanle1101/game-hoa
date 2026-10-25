import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { gameCommand, readGame, readPrivate, type DataEnvelope } from "@/server/store";
import { createInitialState } from "@/domain";
import type { GameState } from "@/domain/types";
import { getBuilding, quoteConstruction, constructionContext, validateConstruction } from "@/construction/engine";
import { buildingPlanSchema } from "@/construction/schema";
import { commandSchema } from "@/server/validation";
import { detectRooms } from "@/construction/topology";
import type { BuildingPlan } from "@/construction/types";
import { emptyPlan } from "@/construction/grid";
import { GET, POST } from "@/app/api/game/route";

const owner = "construction-test-owner";
let directory: string;
const savePath = () => path.join(directory, `${owner}.json`);
const disk = async () => JSON.parse(await readFile(savePath(), "utf8")) as DataEnvelope;
async function seed(state: GameState) { await writeFile(savePath(), JSON.stringify({ game: state, finance: { version: 1, privateSentinel: "never-touch-finance" }, proposals: {}, commands: {} }), "utf8"); }
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "lifelevel-construction-test-"));
  vi.stubEnv("LOCAL_DEV_MODE", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOCAL_DATA_DIR", directory);
  const state = createInitialState(owner); state.gold = 2000; state.character.xp = 400; state.ownedFurniture = { "biolume-plant": 1 }; await seed(state);
});
afterEach(async () => {
  vi.unstubAllEnvs(); const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith("lifelevel-construction-test-")) throw new Error("Unsafe cleanup");
  await rm(resolved, { recursive: true, force: true });
});
async function draft(): Promise<BuildingPlan> { return structuredClone(getBuilding(await readGame(owner)).plan); }
function paint(plan: BuildingPlan, index = 0) { plan.floors[index].materialId = "floor-wood"; return plan; }
const commit = (plan: BuildingPlan, expectedRevision: number, key = randomUUID()) => gameCommand(owner, key, { type: "construction.commit", expectedRevision, plan });

describe("construction persistence and economy with real isolated local store", () => {
  it("stores walls, door/window, floors, furniture and room name and reloads exactly", async () => {
    const plan = await draft(); plan.walls[0].opening = { kind: "window", catalogId: "window-small" };
    plan.furniture = [{ id: "plant-1", furnitureId: "biolume-plant", x: -2, z: -2, level: 0, rotation: 90 }];
    plan.roomNames[detectRooms(plan)[0].id] = "Haven"; paint(plan);
    const before = await readGame(owner); const quote = quoteConstruction(getBuilding(before), plan, before.gold);
    const saved = await commit(plan, 0); const loaded = await readGame(owner);
    expect(loaded.building?.plan).toEqual(plan); expect(loaded.building?.revision).toBe(1); expect(loaded.gold).toBe(before.gold - quote.netCost);
    expect(loaded.ledger.filter(entry => entry.reason === "Construction commit")).toHaveLength(1);
    expect(loaded.journal.filter(event => event.type === "construction.commit")).toHaveLength(1);
    expect(saved.state.building).toEqual(loaded.building); expect(await readPrivate(owner, "finance")).toEqual({ version: 1, privateSentinel: "never-touch-finance" });
  });
  it("duplicate save uses one charge and returns current game state", async () => {
    const plan = paint(await draft()); const key = randomUUID(); const first = await commit(plan, 0, key);
    await gameCommand(owner, randomUUID(), { type: "character.rename", name: "Current Name" });
    const retry = await commit(plan, 0, key);
    expect(retry.state.gold).toBe(first.state.gold); expect(retry.state.building?.revision).toBe(1); expect(retry.state.character.name).toBe("Current Name");
    expect(retry.state.ledger.filter(entry => entry.reason === "Construction commit")).toHaveLength(1);
  });
  it("simultaneous revisions permit exactly one draft without lost update or double spend", async () => {
    const a = paint(await draft(), 0); const b = paint(await draft(), 1);
    const results = await Promise.allSettled([commit(a, 0), commit(b, 0)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("REVISION_CONFLICT");
    const saved = await readGame(owner); expect(saved.building?.revision).toBe(1); expect(saved.gold).toBe(1982); expect(saved.ledger).toHaveLength(1);
  });
  it("insufficient funds rejects architecture, ledger, journal and receipt atomically", async () => {
    const state = await readGame(owner); state.gold = 0; await seed(state); const before = await disk();
    await expect(commit(paint(await draft()), 0)).rejects.toMatchObject({ code: "INSUFFICIENT_GOLD" }); expect(await disk()).toEqual(before);
  });
  it("malformed topology and reused key content cannot alter a saved plan", async () => {
    const plan = paint(await draft()); const key = randomUUID(); await commit(plan, 0, key); const before = await disk();
    await expect(commit(paint(structuredClone(plan), 1), 1, key)).rejects.toMatchObject({ status: 409 }); expect(await disk()).toEqual(before);
    const duplicate = structuredClone(plan); duplicate.walls.push({ ...duplicate.walls[0] });
    await expect(commit(duplicate, 1)).rejects.toThrow("Duplicate wall"); expect(await disk()).toEqual(before);
  });
  it("starter demolition provides no free refund and paid build/demolish cannot mint Gold", async () => {
    const initial = await readGame(owner); const plan = await draft();
    plan.floors.push({ x: 2, z: 0, level: 0, materialId: "floor-concrete" });
    const built = await commit(plan, 0); expect(built.state.gold).toBe(initial.gold - 10);
    plan.floors = plan.floors.filter(cell => !(cell.x === 2 && cell.z === 0));
    const demolished = await commit(plan, 1); expect(demolished.state.gold).toBe(initial.gold - 5);
    const oldWallCount = plan.walls.length; plan.walls.pop();
    const removeStarter = await commit(plan, 2); expect(removeStarter.state.gold).toBe(demolished.state.gold); expect(removeStarter.state.building?.plan.walls).toHaveLength(oldWallCount - 1);
  });
  it("local draft edits do not affect server state until commit", async () => {
    const before = await disk(); const plan = paint(await draft()); plan.walls.pop();
    expect(plan).not.toEqual(getBuilding(before.game).plan); expect(await disk()).toEqual(before);
  });
  it("legacy save gains construction without losing gameplay or finance", async () => {
    const legacy = await readGame(owner); legacy.placements = [{ id: "legacy-plant", furnitureId: "biolume-plant", roomId: "living", x: 1, z: 1, rotation: 0 }];
    delete legacy.building; await seed(legacy); const preview = getBuilding(legacy);
    expect(legacy.building).toBeUndefined(); expect(preview.revision).toBe(0);
    const saved = await commit(preview.plan, 0);
    expect(saved.state.placements).toEqual(legacy.placements); expect(saved.state.ownedFurniture).toEqual(legacy.ownedFurniture); expect(saved.state.inventory).toEqual(legacy.inventory);
    expect(saved.state.gold).toBe(legacy.gold); expect(await readPrivate(owner, "finance")).toEqual({ version: 1, privateSentinel: "never-touch-finance" });
  });
  it("migration of valid legacy outer-room placements produces an editable valid plan or keeps objects in storage", async () => {
    const legacy = await readGame(owner); legacy.ownedFurniture = { "biolume-plant": 1, "haven-sofa": 1 };
    legacy.placements = [
      { id: "legacy-outer", furnitureId: "biolume-plant", roomId: "living", x: 4, z: 1, rotation: 0 },
      { id: "legacy-sofa", furnitureId: "haven-sofa", roomId: "living", x: 0, z: 0, rotation: 0 },
    ]; delete legacy.building;
    const upgraded = getBuilding(legacy);
    expect(() => validateConstruction(upgraded, upgraded.plan, constructionContext(legacy))).not.toThrow();
    expect(legacy.placements).toHaveLength(2); expect(legacy.ownedFurniture["haven-sofa"]).toBe(1);
  });
  it("one owned furniture copy cannot be installed through both house and legacy placement paths", async () => {
    const plan = await draft(); plan.furniture = [{ id: "house-plant", furnitureId: "biolume-plant", x: -2, z: -2, level: 0, rotation: 0 }];
    await commit(plan, 0);
    await expect(gameCommand(owner, randomUUID(), { type: "furniture.place", furnitureId: "biolume-plant", roomId: "living", x: 0, z: 0, rotation: 0 })).rejects.toThrow();
    const saved = await readGame(owner); expect(saved.building?.plan.furniture).toHaveLength(1); expect(saved.ownedFurniture["biolume-plant"]).toBe(1);
  });
});

describe("construction schema and trust boundary", () => {
  it("accepts a valid supported three-floor save larger than the old 64 KB route limit", async () => {
    const local = createInitialState("local-player"); local.gold = 1_000_000; local.character.xp = 3600;
    const plan = emptyPlan();
    for(let level=0;level<3;level++)for(let x=-8;x<8;x++)for(let z=-8;z<8;z++){
      plan.floors.push({x,z,level,materialId:"floor-concrete"});
      if(level===2)plan.roofs.push({x,z,level,materialId:"roof-flat"});
      else if(!(z===-8&&(x===-8||x===-7)))plan.ceilings.push({x,z,level,materialId:"ceiling-basic"});
    }
    plan.stairs.push({x:-8,z:-8,level:0,orientation:"x",catalogId:"stairs-basic"});
    // The next staircase occupies a different landing on the shared middle floor.
    plan.stairs.push({x:-6,z:-8,level:1,orientation:"x",catalogId:"stairs-basic"});
    plan.ceilings=plan.ceilings.filter(cell=>!(cell.level===1&&cell.z===-8&&(cell.x===-6||cell.x===-5)));
    const body=JSON.stringify({key:randomUUID(),action:{type:"construction.commit",expectedRevision:0,plan}});
    expect(Buffer.byteLength(body)).toBeGreaterThan(64_000); expect(Buffer.byteLength(body)).toBeLessThan(1_000_000);
    await writeFile(path.join(directory,"local-player.json"),JSON.stringify({game:local,finance:null,proposals:{},commands:{}}),"utf8");
    const response=await POST(new Request("https://game.example.com/api/game",{method:"POST",headers:{origin:"https://game.example.com","content-type":"application/json"},body}));
    expect(response.status).toBe(200);const saved=await response.json();expect(saved.state.building.plan.floors).toHaveLength(768);expect(saved.state.building.revision).toBe(1);
  });
  it("real API route commits and reloads the authenticated local player's plan", async () => {
    const localPath = path.join(directory, "local-player.json");
    const local = createInitialState("local-player"); local.gold = 100;
    await writeFile(localPath, JSON.stringify({ game: local, finance: null, proposals: {}, commands: {} }), "utf8");
    const plan = paint(structuredClone(getBuilding(local).plan)); const key = randomUUID();
    const send = (expectedRevision: number, requestKey = key) => POST(new Request("https://game.example.com/api/game", { method: "POST", headers: { origin: "https://game.example.com", "content-type": "application/json" }, body: JSON.stringify({ key: requestKey, action: { type: "construction.commit", expectedRevision, plan } }) }));
    const response = await send(0); expect(response.status).toBe(200); expect((await response.json()).state.gold).toBe(82);
    expect((await send(0)).status).toBe(200);
    const conflict = await send(0, randomUUID()); expect(conflict.status).toBe(422); expect((await conflict.json()).error).toContain("another tab");
    const read = await GET(); expect(read.status).toBe(200); const body = await read.json();
    expect(body.state.building.plan).toEqual(plan); expect(body.state.building.revision).toBe(1); expect(body.state.gold).toBe(82);
    const saved = JSON.parse(await readFile(localPath, "utf8")); expect(Object.keys(saved.commands)).toHaveLength(1);
  });
  it("real API rejects cross-origin construction before touching the local save", async () => {
    const response = await POST(new Request("https://game.example.com/api/game", { method: "POST", headers: { origin: "https://attacker.example.com", "content-type": "application/json" }, body: JSON.stringify({ key: randomUUID(), action: { type: "construction.commit", expectedRevision: 0, plan: await draft() } }) }));
    expect(response.status).toBe(403); expect((await disk()).game.building).toBeUndefined();
  });
  it("rejects forged costs, ownership, refunds and arbitrary save fields", async () => {
    const plan = await draft();
    for (const extra of [{ cost: 0 }, { refund: 999999 }, { ownerId: "victim" }, { paid: {} }, { gold: 999999 }]) {
      expect(commandSchema.safeParse({ key: randomUUID(), action: { type: "construction.commit", expectedRevision: 0, plan, ...extra } }).success).toBe(false);
    }
  });
  it("rejects invalid coordinate/version/rotation payloads", async () => {
    const plan = await draft(); expect(buildingPlanSchema.safeParse({ ...plan, version: 999 }).success).toBe(false);
    expect(buildingPlanSchema.safeParse({ ...plan, floors: [{ ...plan.floors[0], x: 0.5 }] }).success).toBe(false);
    expect(buildingPlanSchema.safeParse({ ...plan, furniture: [{ id: "x", furnitureId: "biolume-plant", x: 0, z: 0, level: 0, rotation: 45 }] }).success).toBe(false);
  });
  it("rejects floating walls/openings, locked materials, unowned furniture and unsupported upper floors", async () => {
    const state = await readGame(owner); const building = getBuilding(state); const context = constructionContext(state);
    const floating = await draft(); floating.walls.push({ x: 20, z: 20, level: 0, orientation: "x", materialId: "wall-basic", opening: { kind: "door", catalogId: "door-standard" } });
    expect(() => validateConstruction(building, floating, context)).toThrow();
    const locked = await draft(); locked.floors[0].materialId = "floor-luxury"; expect(() => validateConstruction(building, locked, context)).toThrow();
    const unowned = await draft(); unowned.furniture.push({ id: "sofa", furnitureId: "haven-sofa", x: -2, z: -2, level: 0, rotation: 0 }); expect(() => validateConstruction(building, unowned, context)).toThrow("own");
    const upper = await draft(); upper.floors.push({ x: 3, z: 3, level: 1, materialId: "floor-concrete" }); expect(() => validateConstruction(building, upper, context)).toThrow("support");
  });
  it("domain cannot mutate a house owned by another player", async () => {
    const state = await readGame(owner); state.userId = "other-owner"; await seed(state);
    await expect(commit(getBuilding(state).plan, 0)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

import { describe, expect, it } from "vitest";
import { COSMETICS } from "../../src/character/catalog";
import { BUILDING_CATALOG } from "../../src/construction/catalog";
import { FURNITURE_CATALOG, furnitureGeometrySignature, getFurnitureRecipe } from "../../src/furniture/catalog";
import { EQUIPMENT_CATALOG, getEquipmentRecipe } from "../../src/equipment/catalog";
import { wearableGeometrySignature, wearableShape } from "../../src/components/world/wearable-shapes";
import { ASSET_REGISTRY, createAssetRegistry, findAssetsBySource, getAsset, validateAssetRegistry } from "../../src/assets/registry";
import { ASSET_COVERAGE_TARGETS, assetMetrics, calculateAssetCoverage } from "../../src/assets/coverage";
import type { AssetCoverageTarget, AssetRecord } from "../../src/assets/types";

const fixture = (overrides: Partial<AssetRecord> = {}): AssetRecord => ({
  id: "fixture.one", name: "Fixture", family: "cosmetic", category: "top", status: "INTEGRATING",
  source: { path: "fixture.ts", exportName: "FIXTURES", id: overrides.id ?? "one" },
  geometry: { source: { path: "recipe.ts", exportName: "RECIPES", id: "shape" }, signature: "same-shape" },
  price: 10, materialSignature: "red", evidence: [], limitations: [], ...overrides,
});
const target: AssetCoverageTarget = { id: "fixture", family: "cosmetic", category: "top", purchase: "paid", target: 2, unit: "entries" };

describe("source-backed asset registry", () => {
  it("has unique IDs, complete references and valid metadata", () => {
    expect(validateAssetRegistry()).toEqual([]);
    expect(createAssetRegistry()).toEqual(ASSET_REGISTRY);
  });

  it("resolves every cosmetic to its actual catalog and geometry recipe", () => {
    for (const cosmetic of COSMETICS) {
      const matches = findAssetsBySource(cosmetic.id);
      expect(matches).toHaveLength(1);
      const asset = matches[0];
      expect(asset.source).toEqual({ path: "src/character/catalog.ts", exportName: "COSMETICS", id: cosmetic.id });
      expect(asset.price).toBe(cosmetic.price);
      expect(asset.level).toBe(cosmetic.level);
      expect(asset.slot).toBe(cosmetic.slot);
      expect(asset.geometry?.source.id).toBe(cosmetic.model);
      expect(asset.geometry?.signature).toBe(wearableGeometrySignature(cosmetic.model));
      expect(asset.geometry?.primitiveCount).toBe(wearableShape(cosmetic.model)?.parts.length);
      expect(asset.rigAnchors).toEqual([...new Set(wearableShape(cosmetic.model)?.parts.map(part => part.anchor))]);
      expect(getAsset(asset.id)).toBe(asset);
    }
    expect(getAsset("missing")).toBeUndefined();
  });

  it("keeps all construction references and excludes finish definitions from unique geometry", () => {
    for (const item of BUILDING_CATALOG) {
      const asset = getAsset(`construction.${item.id}`);
      expect(asset?.source.id).toBe(item.id);
      expect(asset?.price).toBe(item.price);
      expect(asset?.level).toBe(item.level);
      if (["floor", "wall", "ceiling", "roof"].includes(item.category)) {
        expect(asset?.family).toBe("material");
        expect(asset?.geometry).toBeUndefined();
      }
      if (item.category === "curve") expect(asset?.geometry).toBeDefined();
    }
  });

  it("resolves every furniture entry to its generated geometry recipe", () => {
    for (const item of FURNITURE_CATALOG) {
      const asset = getAsset(`furniture.${item.id}`);
      expect(asset?.source).toEqual({ path: "src/furniture/catalog.ts", exportName: "FURNITURE_CATALOG", id: item.id });
      expect(asset?.geometry?.source).toEqual({ path: "src/furniture/catalog.ts", exportName: "getFurnitureRecipe", id: item.id });
      expect(asset?.geometry?.signature).toBe(furnitureGeometrySignature(item.id));
      expect(asset?.geometry?.primitiveCount).toBe(getFurnitureRecipe(item.id)?.parts.length);
      expect(asset?.category).toBe(item.category === "light" ? "lights" : item.category);
      expect(asset?.price).toBe(item.price);
      expect(asset?.level).toBe(item.level);
    }
  });

  it("resolves every equipment recipe and preserves price level and rig metadata", () => {
    for (const item of EQUIPMENT_CATALOG) {
      const asset = getAsset(`equipment.${item.id}`);
      const recipe = getEquipmentRecipe(item.modelId);
      expect(asset?.source).toEqual({ path: "src/equipment/catalog.ts", exportName: "EQUIPMENT_CATALOG", id: item.id });
      expect(asset?.geometry?.source).toEqual({ path: "src/equipment/catalog.ts", exportName: "getEquipmentRecipe", id: item.modelId });
      expect(asset?.geometry?.primitiveCount).toBe(recipe?.parts.length);
      expect(asset?.geometry?.signature).toBeTruthy();
      expect(asset?.family).toBe(item.slot === "weapon" ? "weapon" : ["head", "chest", "gloves", "boots"].includes(item.slot) ? "armor" : "equipment-accessory");
      expect(asset?.category).toBe(item.category === "relic-weapon" ? "relic" : item.category);
      expect(asset?.price).toBe(item.price);
      expect(asset?.level).toBe(item.level);
      expect(asset?.rigAnchors).toEqual(item.rigAnchors);
    }
  });

  it("does not invent GLB paths or verified runtime acceptance", () => {
    expect(JSON.stringify(ASSET_REGISTRY)).not.toMatch(/\.glb\b/i);
    expect(ASSET_REGISTRY.some(asset => asset.status === "VERIFIED")).toBe(false);
    expect(calculateAssetCoverage(ASSET_REGISTRY).status).toBe("INCOMPLETE");
    expect(calculateAssetCoverage(ASSET_REGISTRY).metrics.runtimeVerifiedEntries).toBe(0);
  });

  it("rejects duplicate IDs and unsupported VERIFIED assertions", () => {
    const invalid = fixture({ status: "VERIFIED" });
    expect(validateAssetRegistry([invalid, invalid]).map(issue => issue.message)).toContain("Missing or duplicate asset id.");
    expect(validateAssetRegistry([invalid]).map(issue => issue.message)).toContain("VERIFIED requires passing runtime evidence.");
  });
});

describe("asset coverage", () => {
  it("preserves exact V7 totals and category partitions", () => {
    const total = (id: string) => ASSET_COVERAGE_TARGETS.find(row => row.id === id)?.target;
    expect([total("cosmetic.paid"), total("cosmetic.starter"), total("furniture"), total("weapon"), total("armor"), total("curved-glass"), total("straight-glass"), total("material"), total("door")]).toEqual([94, 21, 120, 36, 30, 6, 6, 12, 8]);
    for (const [family, sum] of [["cosmetic", 94], ["furniture", 120], ["weapon", 36]] as const) {
      expect(ASSET_COVERAGE_TARGETS.filter(row => row.family === family && row.category).reduce((count, row) => count + row.target, 0)).toBe(sum);
    }
  });

  it("separates catalog entries, shared geometry and material variants", () => {
    const first = fixture();
    const second = fixture({ id: "fixture.two", materialSignature: "blue" });
    const third = fixture({ id: "fixture.three", materialSignature: "blue" });
    expect(assetMetrics([first, second, third])).toMatchObject({ entries: 3, geometryEntries: 3, uniqueGeometries: 1, repeatedGeometryEntries: 2, additionalMaterialVariants: 1 });
  });

  it("does not inflate counts with duplicate asset IDs", () => {
    const report = calculateAssetCoverage([fixture(), fixture()], [target]);
    expect(report.rows[0]).toMatchObject({ entries: 1, remainingEntries: 1, entryTargetMet: false });
    expect(report.issues).toEqual(["Duplicate asset id: fixture.one"]);
  });

  it("excludes aliased duplicate and missing source references from coverage", () => {
    const first = fixture();
    const report = calculateAssetCoverage([first, { ...first, id: "alias" }, fixture({ id: "missing", source: { path: "", exportName: "", id: "" } })], [target]);
    expect(report.rows[0].entries).toBe(1);
    expect(report.issues).toHaveLength(2);
    expect(report.status).toBe("INCOMPLETE");
  });

  it("requires both starter flag and zero price; paid and slots remain separate", () => {
    const starterTarget: AssetCoverageTarget = { ...target, purchase: "starter", category: undefined };
    const report = calculateAssetCoverage([
      fixture({ id: "free", price: 0, starter: true }),
      fixture({ id: "not-starter", price: 0 }),
      fixture({ id: "paid-starter", price: 10, starter: true }),
      fixture({ id: "other-slot", category: "face" }),
    ], [target, starterTarget]);
    expect(report.rows[0].entries).toBe(1);
    expect(report.rows[1].entries).toBe(1);
  });

  it("does not equate entry completeness or static tests with runtime verification", () => {
    const report = calculateAssetCoverage([
      fixture({ status: "VERIFIED", evidence: [{ kind: "static", reference: "unit-test", result: "passed" }] }),
      fixture({ id: "fixture.two" }),
    ], [target]);
    expect(report.rows[0]).toMatchObject({ entries: 2, entryTargetMet: true, remainingEntries: 0, remainingRuntimeVerified: 2, status: "INCOMPLETE" });
    expect(report.status).toBe("INCOMPLETE");
  });

  it("does not verify malformed metadata even with a passing runtime reference", () => {
    const record = fixture({ status: "VERIFIED", evidence: [{ kind: "runtime", reference: "fixture://runtime-result", result: "passed" }] });
    for (const invalid of [
      { ...record, id: " " },
      { ...record, price: Infinity },
      { ...record, level: 0 },
      { ...record, geometry: { ...record.geometry!, signature: "" } },
    ]) {
      const report = calculateAssetCoverage([invalid], [{ ...target, target: 1 }]);
      expect(report.status).toBe("INCOMPLETE");
      expect(report.metrics.entries).toBe(0);
      expect(report.issues.length).toBeGreaterThan(0);
    }
  });

  it("recognizes explicitly source-bound fixture evidence without promoting other records", () => {
    const hash = "a".repeat(64);
    const record = fixture({ status: "VERIFIED", source: { path: "fixture.ts", exportName: "FIXTURES", id: "one", sha256: hash }, evidence: [{ kind: "runtime", reference: "fixture://runtime-result", result: "passed", binding: { assetId: "fixture.one", sourceSha256: hash, observedSourceSha256: hash, environment: "synthetic unit fixture", testCase: "fixture acceptance", artifacts: [{ reference: "fixture://capture", sha256: "b".repeat(64) }] } }] });
    expect(calculateAssetCoverage([record], [{ ...target, target: 1 }]).status).toBe("VERIFIED");
    expect(calculateAssetCoverage([{ ...record, evidence: [...record.evidence, { kind: "runtime", reference: "fixture://failed", result: "failed" }] }], [{ ...target, target: 1 }]).status).toBe("INCOMPLETE");
    expect(calculateAssetCoverage([{ ...record, evidence: [{ kind: "runtime", reference: "", result: "passed" }] }], [{ ...target, target: 1 }]).status).toBe("INCOMPLETE");
  });
});

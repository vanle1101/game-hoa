import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, BOSSES, CAREERS, CONSUMABLES, MATERIALS, PET_ACCESSORIES, PETS, RECIPES, ROOMS, SKILL_NODES } from "../../src/domain/catalog";
import { localizedCatalogText } from "../../src/domain/catalog-labels";

const groups = { BOSSES, MATERIALS, RECIPES, ROOMS, PETS, CONSUMABLES, PET_ACCESSORIES, CAREERS, SKILL_NODES, ACHIEVEMENTS };

describe("Vietnamese legacy catalog text", () => {
  it.each(Object.entries(groups))("covers every %s identifier without changing catalog data", (_name, entries) => {
    const before = structuredClone(entries);
    for (const entry of entries) {
      const value = localizedCatalogText(entry.id);
      expect(value, entry.id).toBeDefined(); expect(value!.name.trim()).not.toBe("");
      expect(value!.name).toMatch(/[À-ỹđĐ]/);
      expect(entry.name).toBe(value!.name);
      if ("description" in entry) expect(entry.description).toBe(value!.description);
      expect(Object.keys(value!).every(key => key === "name" || key === "description")).toBe(true);
      if ("description" in entry) expect(value!.description?.trim()).toBeTruthy();
    }
    expect(entries).toEqual(before);
  });
  it.each(["missing-id", "", "constructor", "toString", "__proto__"])("returns undefined for unmapped identifier %s", id => {
    expect(localizedCatalogText(id)).toBeUndefined();
  });
  it("returns independent values so consumers cannot modify the lookup", () => {
    const value = localizedCatalogText("living")!; value.name = "Changed";
    expect(localizedCatalogText("living")?.name).toBe("Chốn bình yên");
  });
  it("preserves consumable amounts and duration in translated descriptions", () => {
    expect(localizedCatalogText("recovery-kit")?.description).toContain("30");
    expect(localizedCatalogText("energy-cell")?.description).toContain("25");
    expect(localizedCatalogText("focus-serum")?.description).toContain("10");
    expect(localizedCatalogText("focus-serum")?.description).toContain("3 lần");
  });
});

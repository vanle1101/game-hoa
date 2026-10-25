import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, getFurnitureRecipe } from "./catalog";

describe("furniture recipe lookup", () => {
  it("keeps the shop usable when a GLB-only item has no procedural recipe", () => {
    for (const item of FURNITURE_CATALOG) {
      expect(() => getFurnitureRecipe(item.id)).not.toThrow();
    }
    expect(getFurnitureRecipe("ceiling-neon")).toBeUndefined();
    expect(getFurnitureRecipe("unknown-furniture")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { APARTMENT_ASSETS, resolveApartmentAssetId } from "@/components/apartment-v21/asset-registry";
import { APARTMENT_ASSETS as HOME_ASSETS } from "@/components/world/apartment-assets";

describe("V21 unified apartment asset registry", () => {
  it("has the complete production GLB set", () => {
    for (const asset of Object.values(APARTMENT_ASSETS)) {
      expect(asset.url).toMatch(/^\/assets\/apartment\/[^/]+\/[^/]+\.glb$/);
    }
    expect(Object.keys(APARTMENT_ASSETS)).toEqual(expect.arrayContaining([
      "bed", "wardrobe", "desk", "chair", "sofa", "kitchen", "stool", "bathroom", "plant", "coffee", "lamp", "rug",
    ]));
  });

  it("resolves persisted Home fixture ids without changing save data", () => {
    expect(resolveApartmentAssetId("cloud-bed")).toBe("bed");
    expect(resolveApartmentAssetId("workstation")).toBe("desk");
    expect(resolveApartmentAssetId("corner-sofa")).toBe("sofa");
    expect(resolveApartmentAssetId("biolume-plant")).toBe("plant");
    expect(resolveApartmentAssetId("unknown-fixture")).toBeUndefined();
  });

  it("keeps Home hero URLs bound to the same production registry", () => {
    for (const id of Object.keys(HOME_ASSETS) as (keyof typeof HOME_ASSETS)[]) {
      expect(HOME_ASSETS[id].url).toBe(APARTMENT_ASSETS[id].url);
    }
  });
});


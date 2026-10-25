import { describe, expect, it } from "vitest";
import { buildResidentialArchitecture, architectureCutaway, residenceElevation, RESIDENTIAL_FLOOR_HEIGHT } from "@/components/construction/building-architecture";
import { buildCityScene } from "@/components/world/ApartmentCity";
import { residenceCityOffset } from "@/components/construction/render-geometry";

const plot = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 };

describe("V16 real residential building and surrounding district", () => {
  it.each([8, 16, 24] as const)("anchors floor %i above the street with a roof above all homes", floor => {
    const building = buildResidentialArchitecture(plot, floor);
    expect(building.groundY).toBe(-residenceElevation(floor));
    expect(-48 + residenceCityOffset(floor)).toBeCloseTo(building.groundY);
    expect(building.elevation).toBeCloseTo((floor - 1) * RESIDENTIAL_FLOOR_HEIGHT);
    expect(building.roofY).toBeGreaterThan(3.4);
    expect(building.roofY - building.groundY).toBeCloseTo(28 * 3.4);
    expect(building.lower.glass.length).toBeGreaterThan(0);
    expect(building.upper.glass.length).toBeGreaterThan(0);
    // No solid tower body can fill the inhabited apartment slice.
    for (const box of [...building.lower.structure, ...building.upper.structure]) {
      const intersectsApartment = box.position[0] - box.size[0] / 2 < 5.8 && box.position[0] + box.size[0] / 2 > -5.8 &&
        box.position[2] - box.size[2] / 2 < 4.8 && box.position[2] + box.size[2] / 2 > -4.8 &&
        box.position[1] - box.size[1] / 2 < 2.8 && box.position[1] + box.size[1] / 2 > 0;
      expect(intersectsApartment).toBe(false);
      expect(box.size.every(value => value > 0 && Number.isFinite(value))).toBe(true);
    }
    expect(building.corridorBounds.minZ).toBe(5);
    expect(building.corridorBounds.maxZ).toBeGreaterThan(7);
    expect(building.corridor.structure.some(box => box.position[1] < 0 && box.position[2] > 5)).toBe(true);
  });

  it("restores architecture in follow and exterior views, opening only the plan cutaway", () => {
    expect(architectureCutaway({ x: 12, y: 12, z: 14 }, plot, "build", true)).toBe(true);
    expect(architectureCutaway({ x: 12, y: 12, z: 14 }, plot, "free", false)).toBe(true);
    expect(architectureCutaway({ x: 0, y: 1.6, z: 0 }, plot, "follow", false)).toBe(false);
    expect(architectureCutaway({ x: 40, y: -20, z: 45 }, plot, "free", false)).toBe(false);
    expect(architectureCutaway({ x: 0, y: 50, z: 0 }, plot, "free", false)).toBe(false);
  });

  it("has residential skyline coverage in every 45 degree sector", () => {
    const { towers } = buildCityScene("balanced");
    const sectors = Array.from({ length: 8 }, () => 0);
    towers.forEach(tower => {
      const theta = (Math.atan2(tower.x, tower.z) + Math.PI * 2) % (Math.PI * 2);
      sectors[Math.floor(theta / (Math.PI / 4))]++;
    });
    expect(sectors.every(count => count >= 3)).toBe(true);
  });
});

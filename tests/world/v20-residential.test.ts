import { describe, expect, it } from "vitest";
import { buildResidentialArchitecture, RESIDENTIAL_CORRIDOR_DEPTH, NEIGHBOR_ROOM_DEPTH } from "@/components/construction/building-architecture";

const plot = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 };

describe("V20 residential circulation and physical envelope", () => {
  it.each([8, 16, 24] as const)("keeps floor %i circulation and save footprint clear while adding occupied rooms behind it", floor => {
    const input = structuredClone(plot);
    const building = buildResidentialArchitecture(input, floor);
    expect(input).toEqual(plot);
    expect(building.corridorBounds).toEqual({ minX: -6, maxX: 6, minZ: 5, maxZ: 7.4 });
    expect(building.neighborRooms.map(room => room.number)).toEqual([`${floor}02`, `${floor}03`]);
    for (const room of building.neighborRooms) {
      expect(room.doorZ).toBe(plot.maxZ + RESIDENTIAL_CORRIDOR_DEPTH);
      expect(room.rearZ - room.doorZ).toBeCloseTo(NEIGHBOR_ROOM_DEPTH);
      expect(building.corridor.structure.some(box => box.position[1] < 0 &&
        box.position[2] - box.size[2] / 2 <= room.doorZ && box.position[2] + box.size[2] / 2 >= room.rearZ)).toBe(true);
    }
    // No furniture proxy or wall may block the clear corridor walking lane.
    for (const box of building.corridor.structure) {
      const overlapsLane = box.position[0] - box.size[0] / 2 < 5.7 && box.position[0] + box.size[0] / 2 > -5.7 &&
        box.position[2] - box.size[2] / 2 < 7 && box.position[2] + box.size[2] / 2 > 5.3 &&
        box.position[1] - box.size[1] / 2 < 2 && box.position[1] + box.size[1] / 2 > .1;
      expect(overlapsLane).toBe(false);
    }
  });

  it("covers the complete rear residential wing with roof and floor structure", () => {
    const building = buildResidentialArchitecture(plot, 16);
    const rear = plot.maxZ + RESIDENTIAL_CORRIDOR_DEPTH + NEIGHBOR_ROOM_DEPTH;
    const roof = building.upper.structure.find(box => Math.abs(box.position[1] - building.roofY) < .001)!;
    expect(roof.position[2] + roof.size[2] / 2).toBeGreaterThan(rear);
    expect(roof.position[2] - roof.size[2] / 2).toBeLessThan(plot.minZ);
    expect(building.corridor.glass.some(box => box.position[2] > rear)).toBe(true);
    expect(building.exteriorBounds.maxZ).toBeGreaterThan(rear + 2);
  });
});

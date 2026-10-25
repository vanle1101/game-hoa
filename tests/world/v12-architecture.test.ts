import { describe, expect, it } from "vitest";
import { LEVEL_HEIGHT } from "@/construction/catalog";
import { createFixedApartment } from "@/construction/migration";
import { validateConstruction } from "@/construction/engine";
import type { ConstructionContext, WallSegment } from "@/construction/types";
import { createStarterHome } from "@/housing/engine";
import {
  buildExteriorTowerAttachment,
  buildPanoramaCurtainWallAssembly,
  classifyApartmentShellWall,
  isFixedApartmentShell,
  nearestEdge,
  residenceCityOffset,
  shellWallParts,
  wallKey,
  wallParts,
} from "@/components/construction/render-geometry";
import {
  classifyApartmentFloorZone,
  clipWallPart,
  computeApartmentLightingRig,
  computeArchitecturalFloorTransitions,
  computeFloorCellTint,
  computeInteriorAccentZones,
  computeRoomBounds,
  computeSlabProfile,
  createFloorPatternPixels,
  createWallPatternPixels,
  evaluateWallCutaway,
  getFloorMaterialSpec,
  getWallMaterialSpec,
  resolveApartmentFloorMaterial,
  resolveApartmentWallMaterial,
} from "@/components/construction/architectural-materials";
import { computeV9ApartmentCameraFraming } from "@/components/construction/v9-framing";

const now = "2026-10-17T00:00:00.000Z";

describe("V12 apartment architecture, panorama facade, exterior tower attachment, and framing", () => {
  it("recognizes the 12x10 ground-floor shell and preserves structural validation", () => {
    const fixed = createFixedApartment(now);
    const starter = createStarterHome("studio", now);
    const context: ConstructionContext = {
      gold: 0,
      characterLevel: 1,
      defeatedCampaign: false,
      ownedFurniture: Object.fromEntries(starter.plan.furniture.map(item => [item.furnitureId, 1])),
    };

    for (const building of [fixed, starter]) {
      expect(building.plan.floors).toHaveLength(120);
      expect(isFixedApartmentShell(building.plan, building.plot)).toBe(true);
      expect(isFixedApartmentShell(building.plan.floors, building.plot)).toBe(true);
      expect(validateConstruction(building, building.plan, context)).toEqual(building.plan);
    }

    expect(isFixedApartmentShell(fixed.plan, { ...fixed.plot, maxX: 5 })).toBe(false);
    expect(isFixedApartmentShell(fixed.plan.floors.filter(cell => cell.x !== -6), fixed.plot)).toBe(false);
    expect(isFixedApartmentShell(fixed.plan.floors.slice(0, 99), fixed.plot)).toBe(false);
    expect(isFixedApartmentShell(fixed.plan.floors.map(cell => ({ ...cell, level: 1 })), fixed.plot)).toBe(false);
    expect(() => validateConstruction(fixed, { ...fixed.plan, floors: fixed.plan.floors.slice(1) }, context))
      .toThrow("The original apartment floor must remain supported");
    expect(() => validateConstruction(fixed, { ...fixed.plan, walls: fixed.plan.walls.slice(1) }, context))
      .not.toThrow();
  });

  it("classifies the complete shell into panorama, headboard, entry gallery, and cutaway edges", () => {
    const fixed = createFixedApartment(now);
    const counts = new Map<string, number>();
    for (const wall of fixed.plan.walls) {
      const role = classifyApartmentShellWall(wall, fixed.plot, true);
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      "panorama-north": 8,
      "panorama-east-return": 3,
      "headboard-feature": 4,
      "entry-gallery": 10,
      "cutaway-balustrade": 18,
      standard: 1,
    });

    const north: WallSegment = { x: -2, z: -5, level: 0, orientation: "x", materialId: "wall-basic" };
    expect(classifyApartmentShellWall(north, fixed.plot)).toBe("panorama-north");
    expect(classifyApartmentShellWall({ ...north, x: -3 }, fixed.plot)).toBe("headboard-feature");
    expect(classifyApartmentShellWall({ ...north, x: 6, orientation: "z", z: -3 }, fixed.plot)).toBe("panorama-east-return");
    expect(classifyApartmentShellWall({ ...north, x: 6, orientation: "z", z: -2 }, fixed.plot)).toBe("cutaway-balustrade");
    expect(classifyApartmentShellWall({ ...north, opening: { kind: "door", catalogId: "door-standard" } }, fixed.plot)).toBe("standard");
    for (const materialId of ["wall-brick", "wall-neon", "wall-metal"]) {
      expect(classifyApartmentShellWall({ ...north, materialId }, fixed.plot)).toBe("standard");
    }
    expect(classifyApartmentShellWall({ ...north, level: 1 }, fixed.plot)).toBe("standard");
    expect(classifyApartmentShellWall(north, fixed.plot, false)).toBe("standard");
    expect(classifyApartmentShellWall({ ...north, z: 0 }, fixed.plot)).toBe("standard");
  });

  it("leaves actual north and east glass openings instead of full opaque backing walls", () => {
    const fixed = createFixedApartment(now);
    const before = structuredClone(fixed.plan);
    const panoramaWalls = fixed.plan.walls.filter(wall => {
      const role = classifyApartmentShellWall(wall, fixed.plot);
      return role === "panorama-north" || role === "panorama-east-return";
    });
    expect(panoramaWalls).toHaveLength(11);
    for (const wall of panoramaWalls) {
      const parts = shellWallParts(wall, fixed.plot);
      expect(parts).toHaveLength(4);
      expect(parts.map(part => part.width)).toEqual([expect.closeTo(0.03), expect.closeTo(0.03), 0.94, 0.94]);
      expect(parts[2]).toMatchObject({ x: 0, y: 0.08, height: 0.16 });
      expect(parts[3]!.y - parts[3]!.height / 2).toBeCloseTo(2.64);
      expect(parts[3]!.y + parts[3]!.height / 2).toBeCloseTo(2.8);
      for (const part of parts) {
        const crossesOpeningX = part.x + part.width / 2 > -0.47 + 1e-9 && part.x - part.width / 2 < 0.47 - 1e-9;
        const crossesOpeningY = part.y + part.height / 2 > 0.16 + 1e-9 && part.y - part.height / 2 < 2.64 - 1e-9;
        expect(crossesOpeningX && crossesOpeningY).toBe(false);
      }
      expect(shellWallParts(wall, fixed.plot, false)).toEqual(wallParts(wall));
    }
    const entryDoor = fixed.plan.walls.find(wall => wall.opening?.kind === "door")!;
    expect(shellWallParts(entryDoor, fixed.plot)).toEqual(wallParts(entryDoor));
    const customWall = { ...panoramaWalls[0]!, materialId: "wall-metal" };
    expect(shellWallParts(customWall, fixed.plot)).toEqual(wallParts(customWall));
    expect(fixed.plan).toEqual(before);
  });

  it("assembles an 8m north curtain wall and 3m east return with shared corner, mullions, and split glass bays", () => {
    const fixed = createFixedApartment(now);
    const assembly = buildPanoramaCurtainWallAssembly(fixed.plot, 0);
    expect(assembly.northSpan).toEqual({ centerX: 2, z: -5, width: 8, height: 2.82, sillHeight: 0.16, headerHeight: 0.16, transomY: 2.45 });
    expect(assembly.eastReturnSpan).toEqual({ x: 6, centerZ: -3.5, depth: 3, height: 2.82, sillHeight: 0.16, headerHeight: 0.16, transomY: 2.45 });
    expect(assembly.columns).toHaveLength(7);
    expect(assembly.columns.map(column => [column.position[0], column.position[2]])).toEqual([
      [-2, -5], [0, -5], [2, -5], [4, -5], [6, -5], [6, -3.5], [6, -2],
    ]);
    expect(assembly.columns.filter(column => column.position[0] === 6 && column.position[2] === -5)).toHaveLength(1);
    for (const column of assembly.columns) {
      expect(column.position[1]).toBeCloseTo(1.41);
      expect(column.size[1]).toBeCloseTo(2.86);
      expect(column.trimSize[1]).toBeCloseTo(2.7);
      expect(column.trimPosition[1]).toBe(column.position[1]);
    }
    const northBays = assembly.bays.filter(bay => bay.orientation === "x");
    const eastBays = assembly.bays.filter(bay => bay.orientation === "z");
    expect(northBays.map(bay => bay.position)).toEqual([[-1, 0, -5], [1, 0, -5], [3, 0, -5], [5, 0, -5]]);
    expect(eastBays.map(bay => bay.position)).toEqual([[6, 0, -4.25], [6, 0, -2.75]]);
    for (const bay of assembly.bays) {
      expect(bay.width).toBeCloseTo(bay.orientation === "x" ? 1.92 : 1.42);
      expect(bay.rotationY).toBe(bay.orientation === "x" ? 0 : Math.PI / 2);
      expect(bay.lowerY - bay.lowerHeight / 2).toBeCloseTo(0.16);
      expect(bay.lowerY + bay.lowerHeight / 2).toBeCloseTo(bay.transomY - 0.03);
      expect(bay.upperY - bay.upperHeight / 2).toBeCloseTo(bay.transomY + 0.03);
      expect(bay.upperY + bay.upperHeight / 2).toBeCloseTo(2.66);
    }
    const upperAssembly = buildPanoramaCurtainWallAssembly(fixed.plot, 1);
    expect(upperAssembly.columns[0]!.position[1] - assembly.columns[0]!.position[1]).toBe(LEVEL_HEIGHT);
    expect(upperAssembly.bays[0]!.position[1]).toBe(LEVEL_HEIGHT);
  });

  it("connects a podium, continuous exterior pilasters, tiered shaft, and warm facade below the slab", () => {
    const fixed = createFixedApartment(now);
    const bounds = computeRoomBounds(fixed.plan.floors, 0, fixed.plot);
    const attachment = buildExteriorTowerAttachment(bounds, fixed.plot, 16);
    const shaftTop = attachment.shaftCenterY + attachment.shaftHeight / 2;
    const shaftBottom = attachment.shaftCenterY - attachment.shaftHeight / 2;
    expect([attachment.centerX, attachment.centerZ]).toEqual([bounds.centerX, bounds.centerZ]);
    expect(attachment.podiumWidth).toBeCloseTo(12.92);
    expect(attachment.podiumDepth).toBeCloseTo(10.92);
    expect(attachment.podiumThickness).toBe(0.56);
    expect(attachment.podiumTopY).toBe(-0.12);
    expect(attachment.shaftWidth).toBeCloseTo(12.36);
    expect(attachment.shaftDepth).toBeCloseTo(10.36);
    expect(attachment.shaftHeight).toBeCloseTo(13.6);
    expect(shaftTop).toBeCloseTo(attachment.podiumTopY - attachment.podiumThickness);
    expect(attachment.columns).toHaveLength(12);
    const corners = attachment.columns.filter(column => column.size[0] === 0.44 && column.size[2] === 0.44);
    expect(corners.map(column => [column.position[0], column.position[2]])).toEqual([
      [-6.18, -5.18], [-6.18, 5.18], [6.18, -5.18], [6.18, 5.18],
    ]);
    for (const column of attachment.columns) {
      expect(column.size[1]).toBeCloseTo(14.1);
      expect(column.position[1] + column.size[1] / 2).toBeGreaterThan(shaftTop);
      expect(column.position[1] + column.size[1] / 2).toBeLessThan(attachment.podiumTopY);
      expect(column.position[1] - column.size[1] / 2).toBeLessThan(shaftBottom);
    }
    expect(attachment.spandrelTiers).toHaveLength(5);
    attachment.spandrelTiers.forEach((tier, index) => {
      expect(tier.y).toBeCloseTo(shaftTop - index * 3.4);
      expect(tier.width).toBeGreaterThan(attachment.shaftWidth);
      expect(tier.depth).toBeGreaterThan(attachment.shaftDepth);
      expect(tier.accentColor).toBe(index % 2 === 0 ? "#ffae58" : "#38d9f5");
    });
    expect(attachment.lowerWindowBays).toHaveLength(36);
    for (const face of ["north", "south", "east", "west"] as const) {
      expect(attachment.lowerWindowBays.filter(bay => bay.face === face)).toHaveLength(9);
    }
    expect(new Set(attachment.lowerWindowBays.map(bay => bay.warmth)).size).toBeGreaterThan(2);
    for (const bay of attachment.lowerWindowBays) {
      expect(bay.warmth).toBeGreaterThanOrEqual(0.45);
      expect(bay.warmth).toBeLessThanOrEqual(0.95);
      expect(bay.height).toBeCloseTo(2.78);
      expect(bay.width).toBeGreaterThan(0);
      expect(bay.position[1] + bay.height / 2).toBeLessThan(shaftTop);
      expect(bay.position[1] - bay.height / 2).toBeGreaterThan(shaftBottom);
      if (bay.face === "north" || bay.face === "south") {
        expect(bay.position[2]).toBeCloseTo(bay.face === "north" ? -5.19 : 5.19);
        expect(bay.rotationY).toBe(bay.face === "north" ? Math.PI : 0);
      } else {
        expect(bay.position[0]).toBeCloseTo(bay.face === "west" ? -6.19 : 6.19);
        expect(bay.rotationY).toBe(bay.face === "west" ? -Math.PI / 2 : Math.PI / 2);
      }
    }
    expect(attachment.ledApronStrips).toHaveLength(4);
    expect(attachment.ledApronStrips.map(strip => strip.color)).toEqual(["#ffae54", "#ffae54", "#38d9f5", "#ffae54"]);
    expect(attachment.ledApronStrips.every(strip => strip.position[1] < attachment.podiumTopY)).toBe(true);
    const highFloor = buildExteriorTowerAttachment(bounds, fixed.plot, 24);
    expect(highFloor.shaftHeight).toBeCloseTo(17);
    expect(highFloor.spandrelTiers).toHaveLength(6);
    expect(highFloor.podiumTopY).toBe(attachment.podiumTopY);
  });

  it("zones default concrete into warm wood, honed entry stone, and bath ceramic with merged transition strips", () => {
    const fixed = createFixedApartment(now);
    expect(classifyApartmentFloorZone(0, 0)).toBe("living-wood");
    expect(classifyApartmentFloorZone(-3, 0)).toBe("entry-stone");
    expect(classifyApartmentFloorZone(-3, -1)).toBe("living-wood");
    expect(classifyApartmentFloorZone(-2, 0)).toBe("living-wood");
    expect(classifyApartmentFloorZone(3, 1)).toBe("bath-ceramic");
    expect(classifyApartmentFloorZone(3, 0)).toBe("living-wood");
    expect(classifyApartmentFloorZone(2, 1)).toBe("living-wood");
    const materialCounts = new Map<string, number>();
    for (const cell of fixed.plan.floors) {
      const material = resolveApartmentFloorMaterial(cell, true);
      materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
    }
    expect(Object.fromEntries(materialCounts)).toEqual({ "floor-wood": 88, "floor-concrete": 20, "floor-ceramic": 12 });
    expect(getFloorMaterialSpec("floor-concrete").pattern).toBe("honed-stone");
    const livingCell = fixed.plan.floors.find(cell => cell.x === 0 && cell.z === 0)!;
    expect(resolveApartmentFloorMaterial({ ...livingCell, materialId: "floor-luxury" }, true)).toBe("floor-luxury");
    expect(resolveApartmentFloorMaterial(livingCell, false)).toBe("floor-concrete");
    expect(resolveApartmentFloorMaterial({ ...livingCell, level: 1 }, true)).toBe("floor-concrete");

    const transitions = computeArchitecturalFloorTransitions(fixed.plan.floors, 0, true);
    expect(transitions.map(strip => ({ orientation: strip.orientation, x: strip.x, z: strip.z, length: strip.length, from: strip.fromMaterialId, to: strip.toMaterialId }))).toEqual([
      { orientation: "x", x: -4, z: 0, length: 4, from: "floor-wood", to: "floor-concrete" },
      { orientation: "x", x: 4.5, z: 1, length: 3, from: "floor-wood", to: "floor-ceramic" },
      { orientation: "z", x: -2, z: 2.5, length: 5, from: "floor-concrete", to: "floor-wood" },
      { orientation: "z", x: 3, z: 3, length: 4, from: "floor-wood", to: "floor-ceramic" },
    ]);
    for (const strip of transitions) {
      expect(strip).toMatchObject({ level: 0, width: 0.044, height: 0.012, primaryColor: "#c29258", revealColor: "#202630" });
    }
    expect(computeArchitecturalFloorTransitions(fixed.plan.floors, 0, false)).toEqual([]);
    expect(computeArchitecturalFloorTransitions(fixed.plan.floors, 1, true)).toEqual([]);
  });

  it("preserves custom walls and uses warm fluted headboards and continuous warm floor tint", () => {
    const fixed = createFixedApartment(now);
    const bounds = computeRoomBounds(fixed.plan.floors, 0, fixed.plot);
    const headboardWall = fixed.plan.walls.find(wall => wall.orientation === "x" && wall.z === -5 && wall.x === -4)!;
    expect(resolveApartmentWallMaterial(headboardWall, true, fixed.plot)).toBe("wall-wood");
    expect(resolveApartmentWallMaterial(headboardWall, false, fixed.plot)).toBe("wall-basic");
    expect(resolveApartmentWallMaterial({ ...headboardWall, level: 1 }, true, fixed.plot)).toBe("wall-basic");
    expect(resolveApartmentWallMaterial({ ...headboardWall, materialId: "wall-metal" }, true, fixed.plot)).toBe("wall-metal");
    expect(resolveApartmentWallMaterial({ ...headboardWall, opening: { kind: "window", catalogId: "window-small" } }, true, fixed.plot)).toBe("wall-basic");
    const southWall = fixed.plan.walls.find(wall => wall.orientation === "x" && wall.z === 5 && wall.x === -2)!;
    expect(resolveApartmentWallMaterial(southWall, true, fixed.plot)).toBe("wall-basic");
    const tintA = computeFloorCellTint({ x: 0, z: 0, level: 0, materialId: "floor-wood" }, bounds);
    const tintB = computeFloorCellTint({ x: 1, z: 0, level: 0, materialId: "floor-wood" }, bounds);
    expect(Math.abs(tintA.r - tintB.r)).toBeLessThan(0.025);
    expect(tintA.r).toBeGreaterThan(tintA.b);
    const textures = ["floor-wood", "floor-concrete", "floor-ceramic"].map(id => createFloorPatternPixels(id, 32));
    for (const pixels of [...textures, createWallPatternPixels("wall-wood", 32)]) {
      expect(pixels.byteLength).toBe(32 * 32 * 4);
      expect(pixels.filter((_, index) => index % 4 === 3).every(alpha => alpha === 255)).toBe(true);
    }
    expect(new Set(textures.map(pixels => Array.from(pixels).join(","))).size).toBe(3);
    expect(getFloorMaterialSpec("floor-wood").pattern).toBe("warm-plank");
    expect(getWallMaterialSpec("wall-wood").pattern).toBe("warm-fluted-wood");
  });

  it("lights warm interior zones against cyan and violet skyline rims while respecting quality and furniture state", () => {
    const starter = createStarterHome("studio", now);
    const bounds = computeRoomBounds(starter.plan.floors, 0, starter.plot);
    const rig = computeApartmentLightingRig(bounds, 0, starter.plan.furniture, "high");
    expect(rig.background).toBe("#070b14");
    expect(rig.keyLight).toEqual({ color: "#ffe4c2", intensity: 0.95, position: [7.5, 15, 9.5] });
    expect(rig.cityRimLight).toEqual({ color: "#38d9f5", intensity: 0.52, position: [-11, 6.5, -14] });
    expect(rig.skylineVioletRim).toEqual({ color: "#a46bff", intensity: 0.48, position: [12, 5.5, -14] });
    expect(rig.pointLights.slice(0, 4).map(light => [light.id, light.kind, light.color, light.intensity])).toEqual([
      ["interior-warm-hearth", "warm-key", "#ffbe7a", 38],
      ["interior-bedroom-warmth", "warm-zone", "#ffa759", 29],
      ["interior-lounge-warmth", "warm-zone", "#ffd199", 26],
      ["interior-cyber-workstation", "cyber-accent", "#3ce8ff", 16],
    ]);
    expect(rig.pointLights.find(light => light.id === "furniture-bed:starter-home:bed")?.intensity).toBe(12);
    expect(rig.pointLights.find(light => light.id === "furniture-desk:starter-home:desk")?.intensity).toBe(11);
    expect(rig.pointLights.find(light => light.id === "furniture-light:starter-home:light")?.intensity).toBe(14);
    const inactive = computeApartmentLightingRig(bounds, 0, starter.plan.furniture, "high", { "starter-home:light": false });
    expect(inactive.pointLights.find(light => light.id === "furniture-light:starter-home:light")?.intensity).toBe(0);
    const low = computeApartmentLightingRig(bounds, 0, starter.plan.furniture, "performance");
    expect(low.pointLights.map(light => light.intensity)).toEqual([30, 22, 20, 10]);
    expect(low.cityRimLight).toEqual(rig.cityRimLight);
    const upperRig = computeApartmentLightingRig(bounds, 1, starter.plan.furniture, "high");
    expect(upperRig.pointLights).toHaveLength(4);
    expect(upperRig.keyLight.position[1]).toBe(rig.keyLight.position[1] + LEVEL_HEIGHT);
    expect(upperRig.pointLights[0]!.position[1]).toBe(rig.pointLights[0]!.position[1] + LEVEL_HEIGHT);

    const zones = computeInteriorAccentZones(starter.plan, 0);
    expect(zones.find(zone => zone.id === "zone:starter-home:bed")?.kind).toBe("bed-rug");
    expect(zones.find(zone => zone.id === "zone:starter-home:desk")?.kind).toBe("desk-mat");
    expect(computeInteriorAccentZones(starter.plan, 1)).toEqual([]);
    expect(computeSlabProfile(bounds, starter.plot, false).showPlotGuide).toBe(false);
    expect(computeSlabProfile(bounds, starter.plot, true).showPlotGuide).toBe(true);
  });

  it("cuts camera-facing south walls to balustrades but preserves north and east panorama height", () => {
    const fixed = createFixedApartment(now);
    const bounds = computeRoomBounds(fixed.plan.floors, 0, fixed.plot);
    const floorKeys = new Set(fixed.plan.floors.map(cell => `${cell.level}:${cell.x}:${cell.z}`));
    const input = { cutaway: true, selected: false, floorKeys, roomBounds: bounds, cameraPosition: { x: 11.5, y: 11.2, z: 13.5 } };
    const southWall = fixed.plan.walls.find(wall => wall.orientation === "x" && wall.z === 5 && wall.x === -2)!;
    const front = evaluateWallCutaway({ ...input, wall: southWall });
    expect(front).toMatchObject({ role: "perimeter", mode: "front-cutaway", cutawayActive: true, balustradeVisible: true });
    expect(front.capHeight).toBeCloseTo(0.42);
    expect(front.balustradeHeight).toBe(0.46);
    for (const wall of fixed.plan.walls.filter(wall => {
      const role = classifyApartmentShellWall(wall, fixed.plot);
      return role === "panorama-north" || role === "panorama-east-return";
    })) {
      const result = evaluateWallCutaway({ ...input, wall });
      expect(result).toMatchObject({ role: "perimeter", mode: "full", cutawayActive: false, balustradeVisible: false });
      expect(result.capHeight).toBeCloseTo(2.8);
    }
    expect(evaluateWallCutaway({ ...input, wall: southWall, selected: true }).mode).toBe("full");
    const clipped = clipWallPart(wallParts(southWall)[0]!, front.capHeight);
    expect(clipped.visible).toBe(true);
    expect(clipped.height).toBeCloseTo(front.capHeight);
    expect(clipped.y - clipped.height / 2).toBeCloseTo(0);
  });

  it("frames the apartment within the usable viewport target and anchors city height to the 16th floor", () => {
    const fixed = createFixedApartment(now);
    const bounds = computeRoomBounds(fixed.plan.floors, 0, fixed.plot);
    for (const mode of ["live", "build", "buy"] as const) {
      const framing = computeV9ApartmentCameraFraming({ mode, plot: fixed.plot, roomBounds: bounds, level: 0, aspect: 16 / 9 });
      expect(framing.dominantFillRatio).toBeGreaterThanOrEqual(0.7);
      expect(framing.dominantFillRatio).toBeLessThanOrEqual(0.85);
      expect(framing.position.x).toBeGreaterThan(bounds.centerX);
      expect(framing.position.z).toBeGreaterThan(bounds.centerZ);
    }
    expect(residenceCityOffset(8)).toBeCloseTo(48 - 7 * 3.4);
    expect(residenceCityOffset(16)).toBeCloseTo(48 - 15 * 3.4);
    expect(residenceCityOffset(24)).toBeCloseTo(48 - 23 * 3.4);
    expect(wallKey({ x: 0, z: 5, level: 0, orientation: "x" })).toBe("0:x:0:5");
    expect(nearestEdge({ x: 1.48, z: 2.1 }, 0)).toEqual({ x: 1, z: 2, level: 0, orientation: "x" });
    expect(nearestEdge({ x: 1.1, z: 2.48 }, 0)).toEqual({ x: 1, z: 2, level: 0, orientation: "z" });
  });
});

import type { Plot } from "@/construction/types";

/** The editable plan is apartment-local. This transform places its origin on a real storey. */
export const RESIDENTIAL_FLOOR_HEIGHT = 3.4;
export const RESIDENTIAL_FLOORS = 28;
export const APARTMENT_CEILING_Y = 2.82;
export const RESIDENTIAL_CORRIDOR_DEPTH = 2.4;
export const NEIGHBOR_ROOM_DEPTH = 4;

export type ArchitectureBox = {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};
export type BuildingSection = { structure: ArchitectureBox[]; glass: ArchitectureBox[]; lights: ArchitectureBox[] };

/** Recessed, non-interactive room modules, seen through real translucent facade glass.
 * These are distant architectural proxies, not replacements for player furniture. */
function occupiedBay(section: BuildingSection, x: number, y: number, z: number, width: number, side: number, variant: number) {
  const put = (kind: keyof BuildingSection, dx: number, dy: number, inward: number, size: ArchitectureBox["size"], color: string) =>
    section[kind].push({ position: [x + dx, y + dy, z - side * inward], size, color });
  const warm = variant % 4 !== 0;
  const wall = warm ? "#8b6b51" : "#374754";
  put("structure", 0, 1.45, 1.55, [width, 2.8, .12], wall);
  put("structure", 0, .08, .8, [width, .14, 1.6], "#665342");
  put("structure", -width / 2 + .06, 1.45, .8, [.12, 2.8, 1.6], "#675b51");
  put("structure", width / 2 - .06, 1.45, .8, [.12, 2.8, 1.6], "#675b51");
  if (warm) {
    // Illuminated back cove, not a flat glowing facade panel.
    put("lights", 0, 2.64, 1.42, [width - .2, .055, .08], variant % 3 ? "#efbd81" : "#c8c6e6");
    put("lights", -.38, 1.58, 1.46, [.56, .32, .018], variant % 3 === 1 ? "#5c91ac" : "#b68b65");
  }
  // Closed curtains, a console/work nook, or a low lounge seat make distinct occupied bays.
  if (variant % 3 === 0) {
    for (let fold = 0; fold < 9; fold++)
      put("structure", -width * .38 + fold * width * .095, 1.51, .22 + (fold % 2) * .04, [width * .1, 2.35, .07], warm ? "#b69b7f" : "#465465");
  } else if (variant % 3 === 1) {
    put("structure", -.1, .8, .94, [width * .66, .09, .6], "#8c7560");
    for (const dx of [-width * .27, width * .2]) put("structure", dx, .42, .94, [.07, .76, .45], "#45515b");
    put("structure", 0, 1.12, 1.13, [.58, .36, .05], "#121e2a");
    put("lights", 0, 1.12, 1.1, [.51, .29, .012], "#6d929d");
  } else {
    put("structure", 0, .42, .95, [width * .66, .38, .66], "#938373");
    put("structure", 0, .72, 1.25, [width * .66, .44, .16], "#ab947c");
    put("structure", width * .35, .33, .5, [.25, .5, .25], "#ab8865");
    put("structure", width * .35, .8, .5, [.46, .53, .4], "#38534a");
  }
}

export function residenceElevation(floor: 8 | 16 | 24 = 16) {
  return (floor - 1) * RESIDENTIAL_FLOOR_HEIGHT;
}

export function buildResidentialArchitecture(plot: Plot, residenceFloor: 8 | 16 | 24 = 16) {
  const elevation = residenceElevation(residenceFloor);
  const groundY = -elevation;
  const roofY = RESIDENTIAL_FLOORS * RESIDENTIAL_FLOOR_HEIGHT - elevation;
  const lower: BuildingSection = { structure: [], glass: [], lights: [] };
  const upper: BuildingSection = { structure: [], glass: [], lights: [] };
  const corridor: BuildingSection = { structure: [], glass: [], lights: [] };
  const cx = (plot.minX + plot.maxX) / 2, cz = (plot.minZ + plot.maxZ) / 2;
  const width = plot.maxX - plot.minX, depth = plot.maxZ - plot.minZ;
  const corridorDepth = RESIDENTIAL_CORRIDOR_DEPTH, corridorZ = plot.maxZ + corridorDepth / 2;
  const rear = plot.maxZ + corridorDepth + NEIGHBOR_ROOM_DEPTH;
  const towerDepth = depth + corridorDepth + NEIGHBOR_ROOM_DEPTH;
  const towerCenterZ = (plot.minZ + rear) / 2;
  const add = (list: ArchitectureBox[], position: ArchitectureBox["position"], size: ArchitectureBox["size"], color: string) => list.push({ position, size, color });

  for (let floor = 1; floor <= RESIDENTIAL_FLOORS; floor++) {
    const base = (floor - residenceFloor) * RESIDENTIAL_FLOOR_HEIGHT;
    const section = floor > residenceFloor ? upper : lower;
    // The apartment is the missing inhabited slice, never a rooftop stacked on a solid block.
    if (floor !== residenceFloor) {
      add(section.structure, [cx, base - .18, towerCenterZ], [width + .5, .36, towerDepth + .5], "#59616a");
      const mechanical = floor % 7 === 0;
      for (const side of [-1, 1]) {
        const z = side < 0 ? plot.minZ - .12 : rear + .12;
        add(section.structure, [cx, base + 2.98, z], [width + .5, .48, .4], "#555e69");
        for (let bay = 0; bay < 4; bay++) {
          const x = plot.minX + (bay + .5) * width / 4;
          const recess = (floor + bay) % 3 === 0 ? .1 : .035;
          const lit = (floor * 7 + bay * 3 + side) % 5 < 2;
          add(section.glass, [x, base + 1.45, z - side * recess], [width / 4 - .25, 2.5, .065], lit ? "#586974" : "#122637");
          add(section.structure, [x - width / 8, base + 1.45, z + side * .08], [.16, 2.95, .32], "#39434c");
          add(section.structure, [x, base + 1.04, z + side * .065], [width / 4 - .25, .045, .16], "#25313a");
          if (lit) add(section.lights, [x, base + 2.55, z + side * .01], [width / 4 - .5, .055, .045], (floor + bay) % 3 ? "#b88a58" : "#387991");
          if (!mechanical) occupiedBay(section, x, base, z, width / 4 - .27, side, floor * 3 + bay);
          // Alternating recessed loggias interrupt the flat curtain wall silhouette.
          if (!mechanical && (bay + floor) % 4 === 0) {
            add(section.structure, [x, base + .02, z + side * .65], [width / 4 - .08, .17, 1.45], "#646a70");
            add(section.glass, [x, base + .68, z + side * 1.3], [width / 4 - .24, 1.08, .045], "#879ba0");
            add(section.structure, [x, base + 1.23, z + side * 1.3], [width / 4 - .16, .045, .06], "#b8a68b");
            add(section.lights, [x, base - .06, z + side * 1.29], [width / 4 - .3, .025, .025], "#e5b27a");
          }
          if (mechanical) for (let fin = 0; fin < 5; fin++) add(section.structure, [x, base + .45 + fin * .45, z + side * .18], [width / 4 - .28, .12, .36], "#343c45");
        }
      }
      for (const side of [-1, 1]) {
        const x = side < 0 ? plot.minX - .12 : plot.maxX + .12;
        add(section.structure, [x, base + 2.98, towerCenterZ], [.4, .48, towerDepth + .5], "#555e69");
        for (let bay = 0; bay < 6; bay++) {
          const z = plot.minZ + (bay + .5) * towerDepth / 6;
          add(section.glass, [x, base + 1.45, z], [.065, 2.5, towerDepth / 6 - .28], (floor + bay) % 4 === 0 ? "#97846b" : "#395366");
          add(section.structure, [x + side * .12, base + 1.45, z], [.48, 2.95, .13], "#64707c");
          if ((bay + floor) % 3 !== 0) add(section.lights, [x + side * .16, base + 2.61, z], [.025, .035, towerDepth / 6 - .45], "#d0a274");
          if (bay > 0 && bay < 5 && !mechanical) {
            const room: BuildingSection = { structure: [], glass: [], lights: [] };
            occupiedBay(room, 0, base, 0, towerDepth / 6 - .28, 1, floor + bay * 2);
            for (const kind of ["structure", "glass", "lights"] as const) for (const part of room[kind]) {
              add(section[kind], [x + side * part.position[2], part.position[1], z - side * part.position[0]], [part.size[2], part.size[1], part.size[0]], part.color);
            }
          }
        }
      }
    }
    // Separate circulation strip continues behind every residential floor.
    if (floor !== residenceFloor) add(section.structure, [cx, base + 1.4, plot.maxZ + 2.25], [width, 2.8, .24], "#242b37");
    if (floor % 7 === 0) add(section.lights, [cx, base + 3.17, plot.minZ - .33], [width + .3, .035, .045], "#449da9");
  }

  add(lower.structure, [cx, groundY - .45, towerCenterZ], [width + 2.2, .9, towerDepth + 2], "#74767a");
  // Structural columns are split at the selected floor, so cutaway never alters saved geometry.
  for (const x of [plot.minX - .18, plot.maxX + .18]) for (const z of [plot.minZ - .18, rear + .18]) {
    add(lower.structure, [x, groundY / 2, z], [.52, -groundY, .52], "#37414c");
    add(upper.structure, [x, (roofY + 3.4) / 2, z], [.52, roofY - 3.4, .52], "#37414c");
  }
  // Roof, parapet, lift overrun, HVAC and a service mast above all residences.
  add(upper.structure, [cx, roofY, towerCenterZ], [width + .8, .42, towerDepth + .8], "#65717e");
  for (const x of [plot.minX - .25, plot.maxX + .25]) add(upper.structure, [x, roofY + .5, towerCenterZ], [.2, 1, towerDepth + .8], "#56616e");
  for (const z of [plot.minZ - .3, rear + .3]) {
    add(upper.structure, [cx, roofY + .5, z], [width + .7, 1, .2], "#56616e");
    add(upper.lights, [cx, roofY + .93, z], [width + .4, .035, .22], "#7ba4b6");
  }
  add(upper.structure, [plot.minX + 2, roofY + 1.2, plot.maxZ + 1], [3.2, 2.4, 2.5], "#46515a");
  for (const x of [-2, 1.5, 4]) {
    add(upper.structure, [x, roofY + .65, cz], [1.6, 1.1, 1.9], "#46515b");
    for (let vent = 0; vent < 6; vent++) add(upper.structure, [x - .65 + vent * .26, roofY + 1.22, cz], [.1, .04, 1.6], "#18252e");
  }
  add(upper.structure, [plot.minX + 1.3, roofY + 3.2, plot.maxZ + 1], [.12, 6.4, .12], "#78828a");
  add(upper.lights, [plot.minX + 1.3, roofY + 6.45, plot.maxZ + 1], [.16, .12, .16], "#e17585");

  // A real 2.4 m landing on the other side of the apartment's existing south door.
  add(corridor.structure, [cx, -.12, corridorZ], [width + .25, .24, corridorDepth], "#374048");
  const doorZ = plot.maxZ + corridorDepth;
  // Real rooms sit behind the numbered doors; the corridor remains a 2.4 m clear path.
  add(corridor.structure, [cx, -.12, doorZ + NEIGHBOR_ROOM_DEPTH / 2], [width + .25, .24, NEIGHBOR_ROOM_DEPTH], "#675b51");
  add(corridor.structure, [cx, 2.91, doorZ + NEIGHBOR_ROOM_DEPTH / 2], [width + .25, .22, NEIGHBOR_ROOM_DEPTH], "#72716e");
  add(corridor.structure, [cx, .18, rear], [width + .25, .36, .22], "#686c70");
  add(corridor.structure, [cx, 2.69, rear], [width + .25, .22, .22], "#686c70");
  add(corridor.structure, [cx, 1.4, rear], [2.8, 2.8, .22], "#686c70");
  for (const offset of [-3.5, 3.5]) {
    add(corridor.glass, [cx + offset, 1.45, rear + .03], [4.1, 2.3, .06], "#9b9f9d");
    for (const dx of [-2.05, 0, 2.05]) add(corridor.structure, [cx + offset + dx, 1.45, rear + .1], [.09, 2.45, .18], "#8a8f94");
    occupiedBay(corridor, cx + offset, 0, rear, 4.1, 1, offset < 0 ? 1 : 2);
  }
  for (const x of [plot.minX, cx - 1.4, cx + 1.4, plot.maxX])
    add(corridor.structure, [x, 1.4, doorZ + NEIGHBOR_ROOM_DEPTH / 2], [.2, 2.8, NEIGHBOR_ROOM_DEPTH], "#6c6863");
  for (const [x, w] of [[plot.minX + .85, 1.7], [cx - 2.005, 1.39], [cx + 2.005, 1.39], [plot.maxX - .85, 1.7]])
    add(corridor.structure, [x, 1.4, doorZ], [w, 2.8, .22], "#76736f");
  add(corridor.structure, [cx, 2.67, doorZ], [width, .28, .22], "#76736f");
  for (const x of [plot.minX, plot.maxX]) add(corridor.structure, [x, 1.4, corridorZ], [.24, 2.8, corridorDepth], "#343c48");
  add(corridor.structure, [cx, 2.91, corridorZ], [width + .25, .22, corridorDepth + .2], "#3b424a");
  for (const x of [cx - 3.5, cx + 3.5]) {
    add(corridor.structure, [x, 1.24, doorZ - .06], [1.6, 2.48, .19], "#b7a58c");
    add(corridor.structure, [x, 1.19, doorZ - .17], [1.4, 2.38, .1], "#55473e");
    add(corridor.structure, [x + .49, 1.06, doorZ - .25], [.04, .36, .06], "#c6b48d");
    // Recessed access panel and illuminated doorbell.
    add(corridor.structure, [x + .96, 1.32, doorZ - .15], [.14, .24, .08], "#29333d");
    add(corridor.lights, [x + .96, 1.3, doorZ - .195], [.055, .055, .016], "#9eb7a9");
    add(corridor.lights, [x, 2.53, doorZ - .15], [1.6, .035, .09], "#efcb94");
    add(corridor.structure, [x, 1.6, rear - .16], [1.2, .7, .06], "#9f8166");
  }
  // Central lift doors and actual lift shaft volume.
  add(corridor.structure, [cx, 1.24, doorZ - .07], [2.62, 2.48, .18], "#aba18f");
  for (const side of [-1, 1]) add(corridor.structure, [cx + side * .61, 1.18, doorZ - .18], [1.19, 2.36, .06], "#697a87");
  add(corridor.structure, [cx, 1.18, doorZ - .22], [.025, 2.36, .015], "#25303a");
  add(corridor.lights, [cx, 2.59, doorZ - .16], [.6, .12, .035], "#b2c9c3");
  for (const side of [-1, 1]) add(corridor.lights, [cx + side * 1.3, 1.3, doorZ - .16], [.025, 2.1, .025], "#e6c290");
  for (const x of [-4.5, 0, 4.5]) add(corridor.lights, [x, 2.77, corridorZ], [1.8, .025, .09], "#e3bd8a");

  // Stone portal, projecting canopy and warm glazed lobby at the street entrance.
  const entranceZ = rear + .36;
  add(lower.structure, [cx, groundY + 2.8, entranceZ + .8], [6.8, .32, 2.2], "#9b9181");
  add(lower.lights, [cx, groundY + 2.62, entranceZ + 1.55], [6.1, .04, .08], "#f0c998");
  for (const side of [-1, 1]) {
    add(lower.structure, [cx + side * 3.1, groundY + 1.3, entranceZ], [.46, 2.6, .5], "#aaa08f");
    add(lower.glass, [cx + side * 1.02, groundY + 1.2, entranceZ + .04], [1.96, 2.4, .08], "#b7ab98");
    add(lower.structure, [cx + side * .17, groundY + 1.1, entranceZ + .12], [.04, .75, .05], "#b4b6b4");
    add(lower.structure, [cx + side * 4.4, groundY + .35, entranceZ + .8], [1.25, .7, 1.25], "#686d70");
    add(lower.structure, [cx + side * 4.4, groundY + 1.05, entranceZ + .8], [1, .75, 1], "#3f6458");
  }

  return { lower, upper, corridor, groundY, roofY, elevation, floorHeight: RESIDENTIAL_FLOOR_HEIGHT,
    ceilingY: APARTMENT_CEILING_Y, apartmentOrigin: [0, elevation, 0] as const,
    exteriorBounds: { minX: plot.minX - 1.5, maxX: plot.maxX + 1.5, minZ: plot.minZ - 1.5, maxZ: rear + 2.3 },
    neighborRooms: [cx - 3.5, cx + 3.5].map((x, index) => ({ x, doorZ, rearZ: rear, number: `${residenceFloor}0${index + 2}` })),
    corridorBounds: { minX: plot.minX, maxX: plot.maxX, minZ: plot.maxZ, maxZ: plot.maxZ + corridorDepth } };
}

export function architectureCutaway(camera: { x: number; y: number; z: number }, plot: Plot, mode: string, editing: boolean) {
  if (editing || mode === "build") return true;
  // Exterior free inspection retains the complete tower; only the close overhead plan view opens it.
  return mode === "free" && camera.y > APARTMENT_CEILING_Y && camera.y < 28 &&
    Math.hypot(camera.x - (plot.minX + plot.maxX) / 2, camera.z - (plot.minZ + plot.maxZ) / 2) < 24;
}

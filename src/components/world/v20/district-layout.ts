/** Surveyed lots, in metres, relative to the player tower. No random placement.
 * Residential forecourt: 84m wide; northern canal vista remains below eye level.
 * Street centre lines are fixed independently from individual building meshes. */
export type DistrictZone = 'residential' | 'commercial' | 'skyline';
export type DistrictLot = {
  id: number; name: string; zone: DistrictZone; layer: number;
  x: number; z: number; width: number; depth: number; height: number;
  archetype: number; asset?: string;
};
export const DISTRICT_GROUND_Y = -48;
export const DISTRICT_ROADS = {
  eastWest: [-116, -60, 28, 84, 140],
  northSouth: [-130, -76, 38, 104, 160],
  width: 8,
} as const;
export const WATERFRONT = { x: 70, width: 30, length: 640 } as const;
// A broad 135 m reach joins the north-south canal. From the benchmark camera
// the earlier 50 m strip collapsed to a thin gridded rectangle at the top of
// the screen; the wider reach now sits directly behind the glazing.
export const NORTH_HARBOR = { x: -145, z: -117.5, width: 400, depth: 135 } as const;
export const PANORAMA_VIEW_CORRIDOR = { minX: -24, maxX: 24, minZ: -114, maxZ: -22, maxTopY: -18 } as const;

// Deliberately irregular silhouettes; spacing is a property of lots, never a noise function.
const survey: [number, number, number, number, number, number, DistrictZone, string][] = [
  // The apartment's west/north forecourt stays open; these towers previously
  // filled the benchmark frame despite passing the narrow central sightline.
  [-48,55,19,18,32,4,'residential','West Gardens'],
  [-102,-21,19,18,38,5,'residential','Atrium Residences'],
  [-102, 4,20,16,26,0,'residential','Cedar Apartments'],
  [-102,55,18,18,36,1,'residential','South Terraces'],
  [12,55,20,18,17,4,'commercial','District Market'],
  [-20,55,18,18,12,2,'commercial','Neighborhood Library'],
  [128, 0,20,21,43,0,'residential','Eastbank Residence'],
  [128,55,19,18,30,1,'residential','Marina Courts'],
  [128,-30,20,18,38,5,'commercial','Canal Offices'],
  [-107,-243,18,18,26,4,'commercial','Gallery Quarter'],
  [-155,-245,19,18,42,2,'commercial','Technology Exchange'],
  [140,-87,20,19,46,3,'commercial','Eastbank Exchange'],
  // Keep the central near quay open; low retail podiums here occluded the
  // newly widened water in the actual high three-quarter Home camera.
  [-102,112,20,18,48,1,'residential','Orchid Residences'],
  [-49,112,22,20,41,5,'residential','South Garden Tower'],
  [12,112,20,20,35,0,'commercial','South Arcade'],
  [128,112,20,18,50,4,'commercial','Media Campus'],
  [-163,-18,25,22,62,1,'skyline','West Corporate Twins'],
  [-163,55,24,22,49,5,'residential','West Horizon'],
  [-163,112,25,24,67,3,'skyline','Observatory'],
  [-210,-235,24,22,65,4,'skyline','West Beacon'],
  [-163,-280,24,24,78,2,'skyline','Signal Tower'],
  [-102,-315,24,24,93,1,'skyline','Meridian Twins'],
  [-49,-305,20,22,113,3,'skyline','Halo Spire'],
  [12,-320,22,22,74,5,'skyline','North Exchange'],
  // Set the east landmark on the far bank, leaving the apartment's diagonal
  // window view open across the canal instead of filling it with a tower wall.
  [128,-220,24,24,96,0,'skyline','Dawn Tower'],
  [193,-153,24,24,108,4,'skyline','Prism Crown'],
  [193,-87,22,22,75,2,'skyline','East Arc'],
  [193,-30,22,22,61,1,'skyline','East Terraces'],
  [193,55,24,22,69,3,'skyline','Marina Beacon'],
  [193,112,24,24,60,5,'skyline','Harbor Headquarters'],
  [193,178,24,24,81,0,'skyline','Southeast Exchange'],
  [128,178,22,24,66,4,'skyline','Harbor Prism'],
  [12,178,23,24,84,2,'skyline','Southern Gateway'],
  [-49,178,24,24,60,3,'skyline','Southern Observatory'],
  [-102,178,24,24,74,1,'skyline','South Corporate Twins'],
  [-163,178,24,24,79,5,'skyline','Sunset Crown'],
  [12,-390,22,24,108,3,'skyline','North Horizon'],
  // A second, genuinely distant bank of imported towers supplies the layered
  // silhouette seen across the water. The gaps are surveyed, not randomized:
  // the nearest skyline remains beyond the harbor and the central vista stays open.
  [-310,-378,26,28,116,4,'skyline','Vesper Gate'],
  [-245,-428,28,30,151,1,'skyline','Lumen House'],
  [-175,-380,30,28,138,0,'skyline','Northline Forum'],
  [-107,-455,28,32,169,2,'skyline','Aurora Needle'],
  [-40,-388,30,30,183,3,'skyline','Neon Haven Crown'],
  [0,-450,26,28,136,4,'skyline','Aster Relay'],
  [128,-395,28,30,145,1,'skyline','Cyan Quay'],
  [185,-450,28,28,176,2,'skyline','Opal Spire'],
  [255,-380,26,30,132,0,'skyline','Eastern Signal'],
  // A thin final silhouette behind the far bank supplies skyline continuity
  // without filling the apartment's immediate window with tall facades.
  [-340,-525,24,26,142,5,'skyline','Vesper Relay'],
  [-275,-545,27,28,178,3,'skyline','Amber Meridian'],
  [-205,-520,25,27,151,4,'skyline','North Harbor Crown'],
  [-155,-550,24,26,192,1,'skyline','Violet Needle'],
  [-50,-530,27,28,169,0,'skyline','Neon Haven Forum'],
  [15,-550,25,28,186,2,'skyline','Opal Landmark'],
  [128,-515,24,26,154,5,'skyline','Eastbank Crown'],
  [230,-535,26,28,171,3,'skyline','Prism Relay'],
];

export const DISTRICT_LOTS: readonly DistrictLot[] = survey.map(([x,z,width,depth,height,archetype,zone,name], i) => ({
  id: 20000 + i, name, zone, x, z, width, depth, height, archetype,
  layer: zone === 'skyline' ? 2 : Math.hypot(x,z) > 110 ? 1 : 0,
  asset: `/assets/world-v20/commercial/models/${zone === 'skyline' ? `building-skyscraper-${'abcde'[archetype % 5]}` : `building-${'abcdefghijklmn'[i % 14]}`}.glb`,
}));

export function lotFootprintGap(a: DistrictLot, b: DistrictLot): number {
  return Math.max(Math.abs(a.x-b.x)-(a.width+b.width)/2, Math.abs(a.z-b.z)-(a.depth+b.depth)/2);
}

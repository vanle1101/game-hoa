import type { EquipmentSlot, ItemDefinition, Rarity } from "../domain/types";

export type EquipmentCategory = "tactical" | "katana" | "energy" | "heavy" | "dual" | "relic-weapon" | "armor" | "accessory";
export type EquipmentAnchor = "rightHand" | "leftHand" | "head" | "torso" | "leftArm" | "rightArm" | "leftShin" | "rightShin";
export type EquipmentVector = [number, number, number];
export type EquipmentMaterial = "steel" | "dark" | "grip" | "edge" | "light" | "gold" | "cloth" | "glass";
export type EquipmentGeometry =
  | { kind: "box"; size: EquipmentVector }
  | { kind: "cylinder"; radiusTop: number; radiusBottom: number; height: number; segments?: number }
  | { kind: "sphere"; radius: number; thetaLength?: number }
  | { kind: "torus"; radius: number; tube: number; arc?: number }
  | { kind: "prism"; outline: [number, number][]; depth: number };
export interface EquipmentPart {
  id: string;
  anchor: EquipmentAnchor;
  geometry: EquipmentGeometry;
  position: EquipmentVector;
  rotation: EquipmentVector;
  material: EquipmentMaterial;
}
export interface EquipmentRecipe {
  id: string;
  slot: EquipmentSlot;
  category: EquipmentCategory;
  grip: EquipmentVector | null;
  parts: EquipmentPart[];
}
export interface EquipmentDefinition extends ItemDefinition {
  category: EquipmentCategory;
  modelId: string;
  icon: "Sword" | "Swords" | "Zap" | "Hammer" | "Sparkles" | "Shield" | "Glasses" | "Shirt" | "Hand" | "Footprints" | "Cpu" | "Gem";
  rigAnchors: EquipmentAnchor[];
  accent: string;
}

const p = (id: string, geometry: EquipmentGeometry, position: EquipmentVector, material: EquipmentMaterial = "steel", anchor: EquipmentAnchor = "rightHand", rotation: EquipmentVector = [0, 0, 0]): EquipmentPart => ({ id, geometry, position, rotation, material, anchor });
const box = (id: string, size: EquipmentVector, at: EquipmentVector, material: EquipmentMaterial = "steel", anchor: EquipmentAnchor = "rightHand", rotation: EquipmentVector = [0, 0, 0]) => p(id, { kind: "box", size }, at, material, anchor, rotation);
const cyl = (id: string, top: number, bottom: number, height: number, at: EquipmentVector, material: EquipmentMaterial = "steel", anchor: EquipmentAnchor = "rightHand", rotation: EquipmentVector = [0, 0, 0]) => p(id, { kind: "cylinder", radiusTop: top, radiusBottom: bottom, height, segments: 12 }, at, material, anchor, rotation);
const ring = (id: string, radius: number, tube: number, at: EquipmentVector, material: EquipmentMaterial = "gold", anchor: EquipmentAnchor = "rightHand", rotation: EquipmentVector = [0, 0, 0], arc?: number) => p(id, { kind: "torus", radius, tube, ...(arc === undefined ? {} : { arc }) }, at, material, anchor, rotation);
const poly = (id: string, outline: [number, number][], depth = .026, material: EquipmentMaterial = "edge", anchor: EquipmentAnchor = "rightHand", at: EquipmentVector = [0, 0, 0]) => p(id, { kind: "prism", outline, depth }, at, material, anchor);
const orb = (id: string, radius: number, at: EquipmentVector, material: EquipmentMaterial = "light", anchor: EquipmentAnchor = "rightHand") => p(id, { kind: "sphere", radius }, at, material, anchor);
const grip = (anchor: EquipmentAnchor = "rightHand", length = .2): EquipmentPart[] => [
  cyl("handle", .023, .027, length, [0, 0, 0], "grip", anchor),
  cyl("pommel", .033, .025, .032, [0, -length / 2 - .016, 0], "steel", anchor),
  ...[-.06, -.02, .02, .06].map((y, i) => ring(`wrap-${i}`, .025, .004, [0, y, 0], "dark", anchor, [Math.PI / 2, 0, 0])),
];
const blade = (outline: [number, number][], material: EquipmentMaterial = "edge") => poly("blade", outline, .026, material);
const guard = (width = .21) => box("guard", [width, .035, .065], [0, .125, 0], "dark");
const spike = (id: string, at: EquipmentVector, height: number, radius = .04, material: EquipmentMaterial = "edge", anchor: EquipmentAnchor = "rightHand", rotation: EquipmentVector = [0, 0, 0]) => cyl(id, 0, radius, height, at, material, anchor, rotation);

const weaponParts: Record<string, EquipmentPart[]> = {
  "starter-blade": [...grip(), guard(), blade([[-.035,.15],[-.045,.7],[0,.88],[.045,.7],[.035,.15]]), box("fuller", [.009,.5,.03], [0,.43,0], "light")],
  "breach-tanto": [...grip(), guard(.14), blade([[-.036,.15],[-.043,.52],[.013,.66],[.065,.54],[.065,.15]]), box("spine", [.018,.32,.04], [-.026,.32,0], "dark")],
  "rescue-hook": [...grip(), guard(.17), blade([[-.04,.15],[-.055,.65],[.09,.79],[.17,.68],[.13,.51],[.085,.56],[.095,.65],[.025,.65],[.055,.15]]), ring("lanyard", .03,.008,[0,-.14,0],"dark")],
  "sawback-machete": [...grip(), guard(.19), blade([[-.04,.15],[-.075,.75],[.02,.85],[.10,.73],[.08,.15]]), ...[.28,.38,.48,.58].map((y,i)=>poly(`tooth-${i}`,[[-.05,y],[-.105,y+.04],[-.06,y+.07]],.03,"steel"))],
  "trench-punch": [...grip(), guard(.25), blade([[-.025,.15],[-.045,.52],[0,.72],[.045,.52],[.025,.15]]), ring("knuckle-bow",.105,.015,[.1,0,0],"steel"), box("bow-bridge",[.1,.03,.04],[.08,-.1,0],"dark")],
  "field-kukri": [...grip(), guard(.12), blade([[-.025,.15],[-.07,.34],[-.16,.54],[-.09,.75],[.055,.7],[.04,.49],[.045,.32],[.035,.15]])],
  "cyber-katana": [...grip(), ring("tsuba",.085,.015,[0,.13,0],"dark","rightHand",[Math.PI/2,0,0]), blade([[-.026,.15],[-.024,.4],[0,.7],[.04,.96],[.09,1.04],[.082,.87],[.047,.65],[.02,.38],[.025,.15]]), box("collar",[.065,.07,.048],[0,.18,0],"gold")],
  "moon-nodachi": [...grip("rightHand",.24), guard(.14), blade([[-.035,.15],[-.04,.6],[.005,.98],[.08,1.22],[.1,1.13],[.07,.94],[.025,.58],[.025,.15]]), ring("moon-guard",.067,.011,[0,.13,0],"gold")],
  "storm-wakizashi": [...grip(), guard(.16), blade([[-.025,.15],[-.014,.5],[.06,.75],[.09,.68],[.046,.47],[.025,.15]]), ...[-1,1].map(s=>box(`wing-${s}`,[.085,.025,.035],[s*.09,.16,0],"light","rightHand",[0,0,s*.5]))],
  "split-tsuba": [...grip(), blade([[-.03,.15],[-.025,.64],[.03,.96],[.07,.91],[.04,.61],[.03,.15]]), ...[-1,1].map(s=>poly(`tsuba-${s}`,[[s*.03,.1],[s*.16,.13],[s*.09,.2],[s*.03,.16]],.055,"gold")), box("scabbard-clip",[.05,.12,.08],[0,.2,0],"dark")],
  "reed-shikomizue": [...grip(), cyl("cane-collar",.035,.035,.1,[0,.14,0],"gold"), blade([[-.017,.18],[-.012,.88],[.025,1.08],[.04,.88],[.018,.18]]), cyl("counterweight",.027,.04,.09,[0,-.13,0],"dark")],
  "serpent-odachi": [...grip("rightHand",.24), guard(.23), blade([[-.025,.15],[-.06,.4],[-.03,.62],[.015,.82],[.005,1.05],[.09,1.19],[.065,.96],[.075,.78],[.03,.58],[0,.39],[.035,.15]]), ...[-1,1].map(s=>spike(`fang-${s}`,[s*.11,.18,0],.12,.035,"gold"))],
  "plasma-sword": [...grip(), guard(.25), box("emitter",[.12,.13,.08],[0,.2,0],"dark"), blade([[-.045,.25],[-.075,.82],[0,1.03],[.075,.82],[.045,.25]],"light"), box("spine",[.018,.66,.04],[0,.57,0],"steel")],
  "arc-fork": [...grip(), box("capacitor",[.16,.13,.1],[0,.18,0],"dark"), ...[-1,1].flatMap(s=>[box(`rail-${s}`,[.028,.55,.05],[s*.075,.48,0],"steel"),spike(`arc-${s}`,[s*.075,.85,0],.35,.04,"light")]), ring("coil",.07,.018,[0,.26,0],"light")],
  "ion-saber": [...grip(), cyl("emitter",.048,.035,.15,[0,.16,0],"dark"), cyl("core",.012,.026,.72,[0,.58,0],"light"), orb("tip",.016,[0,.94,0]), ...[.2,.25].map((y,i)=>ring(`heat-ring-${i}`,.052,.008,[0,y,0],"steel","rightHand",[Math.PI/2,0,0]))],
  "photon-halo": [...grip(), box("stem",[.045,.27,.05],[0,.24,0],"dark"), ring("halo",.28,.022,[0,.61,0],"light"), ...[-1,1].map(s=>box(`brace-${s}`,[.035,.3,.04],[s*.1,.38,0],"steel","rightHand",[0,0,-s*.5])), orb("focus",.06,[0,.61,0],"glass")],
  "flux-cleaver": [...grip(), guard(.22), poly("frame",[[-.09,.15],[-.13,.73],[.16,.85],[.16,.65],[.06,.58],[.07,.15]],.05,"dark"), poly("edge",[[.08,.24],[.18,.3],[.23,.83],[.16,.85],[.13,.43]],.025,"light"), ...[.34,.45,.56].map((y,i)=>box(`cell-${i}`,[.11,.04,.07],[0,y,0],"glass"))],
  "tesla-lance": [...grip(), cyl("shaft",.024,.03,.65,[0,.39,0],"dark"), ...[.25,.36,.47,.58].map((y,i)=>ring(`coil-${i}`,.065,.012,[0,y,0],"light","rightHand",[Math.PI/2,0,0])), spike("prong",[0,.88,0],.36,.065,"edge"), ...[-1,1].map(s=>spike(`fork-${s}`,[s*.075,.75,0],.25,.022,"steel"))],
  "atlas-hammer": [...grip(), cyl("haft",.028,.033,.56,[0,.35,0],"dark"), box("head",[.48,.24,.22],[0,.71,0]), ...[-1,1].map(s=>box(`face-${s}`,[.045,.29,.27],[s*.25,.71,0],"gold"))],
  "siege-axe": [...grip(), cyl("haft",.028,.032,.8,[0,.46,0],"dark"), poly("axe",[[-.03,.58],[-.14,.52],[-.33,.57],[-.4,.87],[-.27,1.04],[-.12,.88],[.025,.89]],.075), spike("poll",[.13,.79,0],.24,.06,"steel","rightHand",[0,0,-Math.PI/2])],
  "rail-maul": [...grip(), box("shaft",[.055,.64,.055],[0,.39,0],"dark"), box("crossbeam",[.35,.1,.1],[0,.75,0]), ...[-1,1].map(s=>box(`piston-${s}`,[.13,.36,.16],[s*.2,.75,0],"steel")), box("charge",[.14,.12,.13],[0,.75,0],"light")],
  "grav-greatsword": [...grip("rightHand",.24), guard(.34), blade([[-.075,.15],[-.13,.85],[0,1.22],[.13,.85],[.075,.15]]), box("central-ridge",[.04,.71,.065],[0,.56,0],"dark"), ...[-1,1].map(s=>box(`quillon-${s}`,[.07,.12,.06],[s*.16,.12,0],"gold"))],
  "impact-mace": [...grip(), cyl("haft",.032,.028,.52,[0,.34,0],"dark"), orb("head",.15,[0,.69,0],"steel"), ...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return spike(`flange-${i}`,[Math.sin(a)*.16,.69+Math.cos(a)*.16,0],.15,.055,"edge","rightHand",[0,0,-a]);}), ring("neck",.06,.014,[0,.52,0],"gold","rightHand",[Math.PI/2,0,0])],
  "breaker-pick": [...grip(), cyl("haft",.03,.033,.69,[0,.42,0],"dark"), poly("pick",[[-.37,.68],[-.17,.89],[.12,.89],[.28,.77],[.12,.78],[-.13,.8]],.09), box("striking-face",[.13,.19,.17],[.19,.81,0],"gold")],
  "quantum-edge": [...grip(), guard(.3), blade([[-.035,.15],[-.10,.35],[-.055,.48],[-.11,.69],[0,1.07],[.11,.69],[.055,.48],[.10,.35],[.035,.15]]), ...[-1,1].map(s=>poly(`crystal-${s}`,[[s*.07,.58],[s*.16,.72],[s*.09,.8]],.045,"light"))],
  "sun-scepter": [...grip(), cyl("staff",.025,.035,.5,[0,.34,0],"gold"), ring("sun",.15,.018,[0,.74,0],"gold"), orb("heart",.085,[0,.74,0]), ...Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return spike(`ray-${i}`,[Math.sin(a)*.21,.74+Math.cos(a)*.21,0],.12,.027,"gold","rightHand",[0,0,-a]);})],
  "crescent-scythe": [...grip(), cyl("staff",.023,.032,.91,[0,.49,0],"dark"), poly("crescent",[[.035,.89],[-.12,1.09],[-.34,1.11],[-.49,.91],[-.55,.61],[-.43,.83],[-.27,.94],[-.1,.94]],.04,"edge"), orb("seal",.06,[0,.94,0],"light")],
  "oracle-trident": [...grip(), cyl("staff",.024,.03,.55,[0,.36,0],"gold"), poly("fork",[[-.19,.93],[-.19,.61],[-.04,.51],[.04,.51],[.19,.61],[.19,.93],[.13,.77],[.13,.65],[.025,.59],[-.025,.59],[-.13,.65],[-.13,.77]],.04,"steel"), spike("crown",[0,.87,0],.44,.06,"light")],
  "void-key": [...grip(), ring("bow",.095,.025,[0,.2,0],"gold"), box("stem",[.05,.61,.055],[0,.58,0],"dark"), box("bit",[.25,.08,.065],[.1,.84,0],"gold"), box("tooth-a",[.055,.14,.065],[.19,.77,0],"gold"), box("tooth-b",[.055,.1,.065],[.075,.79,0],"gold"), orb("eye",.05,[0,.2,0])],
  "runic-fan": [...grip(), ...[-2,-1,0,1,2].map((n,i)=>poly(`leaf-${i}`,[[n*.012,.16],[n*.14-.055,.71-Math.abs(n)*.05],[n*.14+.055,.71-Math.abs(n)*.05]],.025,i%2?"gold":"edge")), ring("pivot",.04,.012,[0,.18,.025],"light")],
  "meteor-flail": [...grip(), cyl("haft",.025,.03,.4,[0,.29,0],"gold"), ...[0,1,2,3].map(i=>ring(`link-${i}`,.035,.009,[i*.04,.54+i*.04,0],"steel","rightHand",[0,i%2*Math.PI/2,0])), orb("meteor",.13,[.21,.78,0],"dark"), ...[-1,1].map(s=>spike(`star-${s}`,[.21+s*.14,.78,0],.13,.04,"gold","rightHand",[0,0,s*Math.PI/2])), spike("crown",[.21,.94,0],.15,.045,"light")],
  "aether-glaive": [...grip(), cyl("haft",.024,.03,.6,[0,.39,0],"dark"), poly("sail",[[-.035,.64],[-.18,.79],[-.11,1.15],[.01,1.26],[.06,1.02],[.18,.94],[.05,.85],[.035,.64]],.035,"edge"), ring("orbit",.13,.012,[0,.88,0],"gold"), orb("gem",.045,[0,.88,0])],
};

const dualParts = (style: "dagger" | "sai" | "tonfa" | "sickle"): EquipmentPart[] => (["rightHand", "leftHand"] as EquipmentAnchor[]).flatMap(anchor => {
  const parts = grip(anchor);
  if (style === "dagger") parts.push(box("guard",[.15,.03,.045],[0,.12,0],"gold",anchor),poly("blade",[[-.03,.14],[-.065,.4],[0,.62],[.065,.4],[.03,.14]],.025,"edge",anchor));
  if (style === "sai") parts.push(cyl("central-prong",.004,.024,.48,[0,.36,0],"edge",anchor),poly("fork",[[-.14,.38],[-.14,.1],[-.025,.08],[.025,.08],[.14,.1],[.14,.38],[.1,.2],[.08,.15],[-.08,.15],[-.1,.2]],.035,"steel",anchor));
  if (style === "tonfa") parts.push(box("cross-grip",[.18,.04,.04],[.07,.03,0],"steel",anchor),cyl("baton",.034,.04,.61,[.16,.14,0],"dark",anchor),box("rail",[.02,.4,.035],[.19,.21,0],"light",anchor));
  if (style === "sickle") parts.push(cyl("haft",.025,.03,.34,[0,.25,0],"dark",anchor),poly("hook",[[-.025,.38],[-.17,.53],[-.3,.45],[-.34,.28],[-.25,.38],[-.13,.41],[.025,.34]],.035,"edge",anchor));
  return parts;
});
weaponParts["twin-stingers"] = dualParts("dagger");
weaponParts["mirror-sai"] = dualParts("sai");
weaponParts["volt-tonfas"] = dualParts("tonfa");
weaponParts["harvest-kamas"] = dualParts("sickle");

const head = "head" as const, torso = "torso" as const;
const armorParts: Record<string, EquipmentPart[]> = {
  "neural-visor": [box("lens",[.25,.065,.035],[0,.01,.139],"glass",head), ...[-1,1].map(s=>box(`temple-${s}`,[.022,.035,.15],[s*.135,.015,.065],"dark",head))],
  "bastion-helm": [p("dome",{kind:"sphere",radius:.145,thetaLength:Math.PI/2},[0,.035,0],"steel",head),box("brow",[.29,.04,.07],[0,.035,.12],"dark",head),...[-1,1].map(s=>box(`cheek-${s}`,[.06,.13,.1],[s*.12,-.065,.095],"steel",head))],
  "signal-crown": [ring("band",.14,.015,[0,.035,0],"gold",head,[Math.PI/2,0,0]),...[-1,0,1].map(s=>spike(`spire-${s}`,[s*.09,.04+(s===0?.17:.11)/2,Math.sqrt(.14**2-(s*.09)**2)],s===0?.17:.11,.025,"light",head))],
  "recon-monocle": [ring("lens-rim",.047,.012,[.065,.01,.145],"steel",head),cyl("optic",.04,.04,.018,[.065,.01,.15],"glass",head,[Math.PI/2,0,0]),box("sensor",[.04,.1,.055],[.14,.035,.06],"dark",head)],
  "warden-mask": [poly("faceplate",[[-.11,.045],[-.09,-.11],[0,-.15],[.09,-.11],[.11,.045]],.04,"steel",head,[0,0,.135]),...[-1,0,1].map(s=>box(`vent-${s}`,[.018,.05,.045],[s*.035,-.06,.16],"dark",head))],
  "aerial-headset": [...[-1,1].flatMap(s=>[cyl(`cup-${s}`,.055,.055,.045,[s*.155,.015,0],"dark",head,[0,0,Math.PI/2]),box(`antenna-${s}`,[.012,.15,.015],[s*.16,.115,0],"light",head)]),ring("headband",.16,.014,[0,.035,0],"steel",head,[0,0,0],Math.PI)],
  "aegis-jacket": [box("front",[.36,.38,.055],[0,1.25,.126],"cloth",torso),box("back",[.36,.38,.045],[0,1.25,-.12],"cloth",torso),...[-1,1].map(s=>box(`lapel-${s}`,[.06,.24,.03],[s*.09,1.34,.17],"steel",torso,[0,0,s*.2]))],
  "bastion-cuirass": [poly("breastplate",[[-.21,1.46],[-.18,1.12],[0,1.03],[.18,1.12],[.21,1.46]],.075,"steel",torso,[0,0,.13]),box("spine",[.17,.37,.07],[0,1.28,-.15],"dark",torso),...[-1,1].map(s=>orb(`pauldron-${s}`,.09,[s*.23,1.44,0],"steel",torso))],
  "scout-harness": [...[-1,1].map(s=>box(`strap-${s}`,[.055,.41,.035],[s*.11,1.26,.145],"dark",torso,[0,0,s*.25])),box("belt",[.35,.065,.065],[0,1.08,.13],"cloth",torso),box("buckle",[.07,.07,.075],[0,1.08,.15],"gold",torso)],
  "reactor-vest": [box("plate",[.33,.32,.065],[0,1.28,.135],"dark",torso),ring("reactor",.083,.018,[0,1.3,.18],"steel",torso),orb("core",.062,[0,1.3,.18],"light",torso),...[-1,1].map(s=>box(`cooler-${s}`,[.06,.24,.075],[s*.13,1.28,.17],"steel",torso))],
  "lamellar-shell": [0,1,2,3].flatMap(row=>[-1,0,1].map(col=>box(`scale-${row}-${col}`,[.108,.095,.035],[col*.112,1.43-row*.09,.145+row*.005],row%2?"dark":"steel",torso,[.12,0,0]))),
  "sentinel-mantle": [box("chest",[.3,.27,.06],[0,1.29,.14],"steel",torso),...[-1,1].map(s=>poly(`shoulder-${s}`,[[s*.12,1.48],[s*.34,1.43],[s*.3,1.3],[s*.18,1.37]],.18,"gold",torso)),box("back-panel",[.25,.46,.04],[0,1.23,-.15],"cloth",torso)],
};
const arms = (make: (anchor: EquipmentAnchor, side: number) => EquipmentPart[]) => (["leftArm", "rightArm"] as EquipmentAnchor[]).flatMap((anchor,i)=>make(anchor,i===0?-1:1));
const shins = (make: (anchor: EquipmentAnchor, side: number) => EquipmentPart[]) => (["leftShin", "rightShin"] as EquipmentAnchor[]).flatMap((anchor,i)=>make(anchor,i===0?-1:1));
armorParts["pulse-gloves"] = arms(a=>[box("backhand",[.085,.09,.025],[0,-.467,.055],"cloth",a),orb("pulse-node",.024,[0,-.46,.077],"light",a)]);
armorParts["bastion-gauntlets"] = arms(a=>[box("bracer",[.108,.18,.035],[0,-.37,.065],"steel",a),box("knuckles",[.1,.035,.045],[0,-.5,.06],"gold",a),box("wrist",[.12,.045,.1],[0,-.435,.02],"dark",a)]);
armorParts["arc-bracers"] = arms(a=>[cyl("cuff",.061,.055,.15,[0,-.365,.014],"dark",a),...[-.4,-.35].map((y,i)=>ring(`coil-${i}`,.066,.009,[0,y,.014],"light",a,[Math.PI/2,0,0]))]);
armorParts["climber-grips"] = arms(a=>[box("palm-guard",[.085,.08,.03],[0,-.47,.06],"dark",a),...[-1,0,1].map(s=>box(`cleat-${s}`,[.015,.055,.03],[s*.028,-.52,.065],"steel",a))]);
armorParts["duelist-vambraces"] = arms((a,s)=>[poly("fin",[[-s*.05,-.44],[-s*.055,-.25],[s*.12,-.19],[s*.05,-.44]],.035,"steel",a,[0,0,.065]),ring("wrist-band",.056,.012,[0,-.44,.015],"gold",a,[Math.PI/2,0,0])]);
armorParts["drift-boots"] = shins(a=>[box("shoe",[.13,.1,.24],[0,-.49,.075],"cloth",a),box("sole",[.14,.035,.25],[0,-.54,.075],"dark",a),box("ankle",[.105,.12,.11],[0,-.42,0],"steel",a)]);
armorParts["bastion-greaves"] = shins(a=>[poly("shin-plate",[[-.07,-.06],[-.055,-.44],[.055,-.44],[.07,-.06]],.045,"steel",a,[0,0,.055]),box("toe",[.15,.11,.22],[0,-.49,.08],"steel",a)]);
armorParts["vector-skates"] = shins(a=>[box("shoe",[.13,.1,.22],[0,-.48,.06],"dark",a),box("runner",[.025,.05,.29],[0,-.54,.07],"edge",a),...[-.03,.15].map((z,i)=>box(`strut-${i}`,[.04,.055,.04],[0,-.52,z],"steel",a))]);
armorParts["mag-lock-boots"] = shins(a=>[box("shoe",[.145,.12,.24],[0,-.48,.08],"dark",a),...[-1,1].map(s=>cyl(`magnet-${s}`,.052,.052,.04,[s*.08,-.5,.08],"light",a,[0,0,Math.PI/2])),box("heel",[.13,.07,.08],[0,-.53,-.035],"steel",a)]);
armorParts["trail-sabatons"] = shins(a=>[0,1,2].map(i=>box(`toe-scale-${i}`,[.14-i*.012,.065,.09],[0,-.46-i*.025,.02+i*.07],"steel",a,[.15,0,0])).concat([box("calf-guard",[.09,.22,.035],[0,-.29,-.06],"cloth",a)]));
armorParts["focus-chip"] = [box("chip",[.08,.075,.025],[.11,1.36,.18],"dark",torso),box("die",[.04,.035,.035],[.11,1.36,.19],"light",torso),...[-1,1].map(s=>box(`pins-${s}`,[.1,.012,.02],[.11,1.36+s*.032,.18],"gold",torso))];
armorParts["memory-ring"] = [ring("band",.018,.006,[.025,-.51,.045],"gold","leftArm"),orb("stone",.013,[.025,-.49,.048],"glass","leftArm")];
armorParts["dawn-relic"] = [ring("seal",.055,.012,[0,1.18,.19],"gold",torso),poly("sun-shard",[[0,1.27],[-.035,1.18],[0,1.08],[.035,1.18]],.025,"light",torso,[0,0,.19])];
armorParts["relay-brooch"] = [poly("kite",[[0,1.42],[-.055,1.36],[0,1.28],[.055,1.36]],.035,"gold",torso,[.12,0,.18]),orb("signal",.024,[.12,1.36,.21],"light",torso)];
armorParts["orbit-talisman"] = [ring("outer",.067,.009,[0,1.25,.2],"gold",torso),ring("inner",.045,.008,[0,1.25,.2],"steel",torso,[.8,.6,0]),orb("star",.022,[0,1.25,.2],"light",torso)];
armorParts["cipher-locket"] = [box("case",[.075,.11,.025],[0,1.27,.18],"dark",torso),box("seam",[.008,.095,.028],[0,1.27,.19],"gold",torso),ring("bail",.018,.005,[0,1.345,.18],"gold",torso)];
armorParts["chronometer"] = [box("strap",[.105,.045,.09],[0,-.4,.015],"cloth","leftArm"),cyl("dial",.039,.039,.018,[0,-.4,.07],"gold","leftArm",[Math.PI/2,0,0]),box("hand",[.006,.025,.01],[0,-.39,.083],"edge","leftArm")];
armorParts["guardian-sigil"] = [poly("shield",[[-.065,1.34],[-.05,1.23],[0,1.18],[.05,1.23],[.065,1.34]],.025,"steel",torso,[0,0,.19]),box("cross-v",[.012,.09,.03],[0,1.28,.2],"gold",torso),box("cross-h",[.065,.012,.03],[0,1.3,.2],"gold",torso)];

armorParts["sentry-cap"] = [cyl("cap",.12,.145,.075,[0,.105,0],"cloth",head),box("brim",[.25,.02,.13],[0,.065,.115],"dark",head),box("badge",[.045,.045,.018],[0,.105,.14],"gold",head)];
armorParts["prism-circlet"] = [ring("band",.143,.012,[0,.045,0],"steel",head,[Math.PI/2,0,0]),poly("crest",[[-.06,.065],[0,.17],[.06,.065],[0,.025]],.025,"glass",head,[0,0,.14]),...[-1,1].map(s=>box(`ear-fin-${s}`,[.025,.11,.06],[s*.15,.015,.015],"gold",head,[0,0,s*.3]))];
armorParts["ranger-bandolier"] = [box("sash",[.07,.43,.04],[0,1.28,.15],"cloth",torso,[0,0,-.55]),...[-1,0,1].map(n=>box(`pouch-${n}`,[.09,.085,.065],[n*.085,1.28+n*.115,.185],"dark",torso)),box("clasp",[.065,.05,.07],[.13,1.46,.17],"gold",torso)];
armorParts["carapace-vest"] = [0,1,2].flatMap(i=>[poly(`carapace-${i}`,[[-.2+i*.02,1.44-i*.115],[-.15+i*.02,1.32-i*.115],[0,1.29-i*.115],[.15-i*.02,1.32-i*.115],[.2-i*.02,1.44-i*.115]],.06,"steel",torso,[0,0,.14+i*.015]),box(`seam-${i}`,[.025,.08,.075],[0,1.39-i*.115,.17+i*.015],"gold",torso)]);
armorParts["medic-cuffs"] = arms(a=>[box("case",[.105,.16,.055],[0,-.36,.07],"cloth",a),...[-1,1].map(s=>cyl(`ampoule-${s}`,.014,.014,.12,[s*.029,-.36,.11],"glass",a)),box("latch",[.1,.025,.025],[0,-.435,.1],"gold",a)]);
armorParts["talon-guards"] = arms(a=>[box("palm",[.09,.085,.03],[0,-.465,.065],"steel",a),...[-1,0,1].map(s=>poly(`talon-${s}`,[[s*.028-.009,-.49],[s*.028-.012,-.55],[s*.028+.005,-.58],[s*.028+.009,-.49]],.018,"edge",a,[0,0,.07]))]);
armorParts["spring-striders"] = shins(a=>[box("foot",[.13,.08,.22],[0,-.495,.075],"dark",a),box("sole",[.15,.03,.24],[0,-.55,.075],"steel",a),...[-1,1].flatMap(s=>[cyl(`piston-${s}`,.015,.02,.24,[s*.075,-.37,0],"steel",a),ring(`spring-${s}`,.028,.009,[s*.075,-.36,0],"gold",a,[Math.PI/2,0,0])])]);
armorParts["ridge-gaiters"] = shins(a=>[box("boot",[.13,.12,.23],[0,-.485,.07],"cloth",a),box("sole",[.14,.03,.25],[0,-.55,.07],"dark",a),...[-.4,-.32,-.24].map((y,i)=>ring(`ridge-${i}`,.063,.013,[0,y,0],"steel",a,[Math.PI/2,0,0])),box("shin-stripe",[.025,.21,.03],[0,-.32,.07],"light",a)]);

const legacy: ItemDefinition[] = [
  { id: "starter-blade", name: "Kiếm Xung Nhịp", description: "Lưỡi kiếm đầu tiên giúp bạn vượt qua xao nhãng.", rarity: "common", slot: "weapon", attack: 6, defense: 0, critRate: 0, level: 1, price: 0 },
  { id: "cyber-katana", name: "Kiếm Công Nghệ", description: "Lưỡi kiếm hợp kim phát sáng, rèn chuẩn từng nét.", rarity: "rare", slot: "weapon", attack: 18, defense: 0, critRate: .03, level: 2, price: 180 },
  { id: "plasma-sword", name: "Kiếm Điện Tương", description: "Cơn bão năng lượng nằm gọn trong tay.", rarity: "epic", slot: "weapon", attack: 30, defense: 0, critRate: .05, level: 4, price: 450 },
  { id: "quantum-edge", name: "Kiếm Lượng Tử", description: "Chém tan mọi nghịch cảnh.", rarity: "legendary", slot: "weapon", attack: 50, defense: 0, critRate: .08, level: 7, price: 1200 },
  { id: "neural-visor", name: "Kính Thần Kinh", description: "Nhìn rõ mục tiêu giữa muôn vàn xao nhãng.", rarity: "uncommon", slot: "head", attack: 2, defense: 5, critRate: .02, level: 1, price: 90 },
  { id: "aegis-jacket", name: "Áo Hộ Vệ", description: "Lớp bảo vệ nhẹ cho hành trình phố thị.", rarity: "rare", slot: "chest", attack: 0, defense: 12, critRate: 0, level: 2, price: 160 },
  { id: "pulse-gloves", name: "Găng Xung Nhịp", description: "Tiếp thêm sức mạnh cho từng hành động.", rarity: "uncommon", slot: "gloves", attack: 4, defense: 3, critRate: .01, level: 1, price: 80 },
  { id: "drift-boots", name: "Giày Lướt Gió", description: "Luôn đi trước một bước.", rarity: "uncommon", slot: "boots", attack: 2, defense: 4, critRate: .01, level: 1, price: 85 },
  { id: "focus-chip", name: "Vi Mạch Tập Trung", description: "Giữ đầu óc sáng rõ giữa thế giới ồn ào.", rarity: "rare", slot: "accessory1", attack: 7, defense: 2, critRate: .03, level: 2, price: 140 },
  { id: "memory-ring", name: "Nhẫn Ký Ức", description: "Giữ những điều quý giá luôn bên mình.", rarity: "epic", slot: "accessory2", attack: 10, defense: 4, critRate: .04, level: 3, price: 280 },
  { id: "dawn-relic", name: "Thánh Vật Bình Minh", description: "Nhắc bạn rằng luôn có thể bắt đầu lại.", rarity: "mythic", slot: "relic", attack: 20, defense: 10, critRate: .05, level: 8, price: 1800 },
];
type EntrySeed = [string, string, string];
const weaponGroups: [EquipmentCategory, EquipmentDefinition["icon"], string, EntrySeed[]][] = [
  ["tactical","Sword","#68c6c0",[["starter-blade","Kiếm Xung Nhịp",""],["breach-tanto","Đoản Đao Phá Trận","Mũi vát gọn, sống dao gia cố chắc chắn."],["rescue-hook","Dao Móc Cứu Hộ","Lưỡi móc có khe cắt dây cứu hộ."],["sawback-machete","Dao Rựa Răng Cưa","Lưỡi chặt bản rộng, sống dao có bốn răng cưa."],["trench-punch","Dao Đấm Chiến Hào","Lưỡi dao hẹp với vòng chắn bảo vệ khớp tay."],["field-kukri","Dao Quắm Dã Chiến","Lưỡi cong dồn trọng lượng về mũi, chuyên dùng dã chiến."]]],
  ["katana","Sword","#8cdad7",[["cyber-katana","Kiếm Công Nghệ",""],["moon-nodachi","Trường Đao Nguyệt Ảnh","Lưỡi cong dài cùng chuôi quấn dây nối dài."],["storm-wakizashi","Đoản Kiếm Bão Tố","Lưỡi cong ngắn với hai nhánh chắn hất lên."],["split-tsuba","Kiếm Song Hộ Thủ","Hai tấm chắn góc cạnh ôm lấy lưỡi kiếm cong."],["reed-shikomizue","Kiếm Gậy Thanh Trúc","Kiếm gậy thanh mảnh, không chắn tay, đuôi có đối trọng."],["serpent-odachi","Trường Đao Xà Ảnh","Lưỡi uốn như rắn, chắn tay mang đôi nanh sắc."]]],
  ["energy","Zap","#8ca8ff",[["plasma-sword","Kiếm Điện Tương",""],["arc-fork","Chĩa Hồ Quang","Hai mũi tích điện nằm hai bên rãnh hở."],["ion-saber","Kiếm Điện Ly","Lõi năng lượng hình trụ trong bộ phát thoát nhiệt."],["photon-halo","Vòng Quang Tử","Lưỡi sáng hình vòng có khung đỡ và thấu kính giữa."],["flux-cleaver","Đao Từ Thông","Lưỡi năng lượng lệch bên cùng ba pin nguồn."],["tesla-lance","Thương Cảm Ứng","Bốn cuộn cảm nằm dưới mũi thương ba chĩa."]]],
  ["heavy","Hammer","#f0ae6c",[["atlas-hammer","Búa Kình Thiên","Đầu búa chữ nhật bản rộng, hai mặt đập gia cố."],["siege-axe","Rìu Công Thành","Lưỡi rìu lưỡi liềm cân bằng với mũi nhọn phía sau."],["rail-maul","Búa Song Trụ","Hai đầu búa dựng đứng nối bằng thanh ngang tích điện."],["grav-greatsword","Đại Kiếm Trọng Lực","Lưỡi bản rộng, mũi nhọn, gân giữa nổi chắc chắn."],["impact-mace","Chùy Chấn Kích","Sáu cánh nhọn tỏa quanh lõi chùy đặc."],["breaker-pick","Cuốc Phá Giáp","Mũi cuốc cong cân bằng với mặt đập vuông."]]],
  ["dual","Swords","#da9eea",[["twin-stingers","Song Dao Độc Châm","Đôi dao găm hình lá, mỗi tay cầm một chiếc."],["mirror-sai","Song Chĩa Đối Ảnh","Đôi chĩa có mũi giữa và ngạnh bên để khóa đòn."],["volt-tonfas","Song Côn Điện","Đôi côn tay cầm ngang với thanh dẫn tích điện."],["harvest-kamas","Song Liềm Mùa Gặt","Đôi liềm ngắn với lưỡi móc sắc."]]],
  ["relic-weapon","Sparkles","#e5c477",[["quantum-edge","Kiếm Lượng Tử",""],["sun-scepter","Quyền Trượng Mặt Trời","Tám tia sáng bao quanh lõi mặt trời rực rỡ."],["crescent-scythe","Lưỡi Hái Trăng Khuyết","Lưỡi cong trăng khuyết trên cán nghi lễ thanh mảnh."],["oracle-trident","Đinh Ba Tiên Tri","Ba mũi nhọn vươn lên từ khung chĩa rộng."],["void-key","Chìa Khóa Hư Không","Chìa khóa khổng lồ với vòng chuôi phát sáng."],["runic-fan","Quạt Cổ Tự","Năm nan cứng xòe quanh chốt xoay đính ngọc."],["meteor-flail","Chùy Xích Thiên Thạch","Xích đan nối treo đầu chùy thiên thạch đầy gai."],["aether-glaive","Trường Đao Thiên Không","Lưỡi đao lệch hình cánh buồm, ôm bởi vòng quỹ đạo."]]],
];
const armorGroups: [EquipmentSlot, EquipmentDefinition["icon"], EntrySeed[]][] = [
  ["head","Glasses",[["neural-visor","Kính Thần Kinh",""],["bastion-helm","Mũ Giáp Thành Trì","Vòm mũ tròn với chắn trán và hai tấm bảo vệ má."],["signal-crown","Vương Miện Tín Hiệu","Ba chóp phát tín hiệu trên vòng miện mảnh."],["recon-monocle","Kính Đơn Trinh Sát","Một mắt kính tròn cùng cảm biến bên thái dương."],["warden-mask","Mặt Nạ Giám Hộ","Tấm che nửa mặt góc cạnh có ba khe thở."],["aerial-headset","Tai Nghe Không Vận","Hai chụp thu âm cùng đôi ăng-ten dựng đứng."]]],
  ["chest","Shirt",[["aegis-jacket","Áo Hộ Vệ",""],["bastion-cuirass","Giáp Ngực Thành Trì","Giáp ngực thuôn dần với hai mảnh giáp vai tròn."],["scout-harness","Đai Trinh Sát","Bộ dây đai thoáng, kèm thắt lưng tiện ích có khóa."],["reactor-vest","Áo Giáp Lò Phản Ứng","Lõi tròn trước ngực nằm giữa hai cụm tản nhiệt."],["lamellar-shell","Giáp Vảy Xếp","Mười hai phiến giáp chồng lên nhau, linh hoạt ôm thân."],["sentinel-mantle","Áo Choàng Lính Gác","Giáp vai hình cánh phủ trên áo choàng giáp ngắn."]]],
  ["gloves","Hand",[["pulse-gloves","Găng Xung Nhịp",""],["bastion-gauntlets","Găng Giáp Thành Trì","Giáp cẳng tay bản rộng với tấm chắn khớp tay nổi."],["arc-bracers","Vòng Tay Hồ Quang","Các vòng cảm ứng ôm quanh giáp cổ tay thuôn gọn."],["climber-grips","Găng Bám Vách","Ba mấu bám trên mỗi bàn tay được bọc giáp."],["duelist-vambraces","Giáp Tay Kiếm Sĩ","Đôi cánh giáp cong đối xứng bảo vệ cẳng tay."]]],
  ["boots","Footprints",[["drift-boots","Giày Lướt Gió",""],["bastion-greaves","Giáp Chân Thành Trì","Giáp ống chân dài, thuôn gọn, mũi giày gia cố."],["vector-skates","Giày Trượt Định Hướng","Lưỡi trượt hẹp được đỡ bằng hai thanh chống."],["mag-lock-boots","Ủng Khóa Từ","Đĩa nam châm gắn hai bên cùng gót vuông vững chắc."],["trail-sabatons","Giày Giáp Đường Mòn","Ba mảnh giáp mũi nối khớp và tấm chắn bắp chân sau."]]],
  ["accessory1","Cpu",[["focus-chip","Vi Mạch Tập Trung",""],["relay-brooch","Trâm Tiếp Sóng","Trâm hình cánh diều đính viên ngọc truyền tín hiệu."],["cipher-locket","Mề Đay Mật Mã","Mề đay chữ nhật hai nửa, treo trên khoen nhỏ."]]],
  ["accessory2","Gem",[["memory-ring","Nhẫn Ký Ức",""],["chronometer","Đồng Hồ Chính Xác","Mặt tròn có kim rõ nét, đi cùng dây đeo bản rộng."]]],
  ["relic","Sparkles",[["dawn-relic","Thánh Vật Bình Minh",""],["orbit-talisman","Bùa Quỹ Đạo","Những vòng giao nhau ôm lấy ngôi sao lơ lửng."],["guardian-sigil","Ấn Hộ Vệ","Huy hiệu khiên nhỏ mang hình chữ thập nổi."]]],
];
armorGroups[0][2].push(["sentry-cap","Mũ Lính Gác","Mũ dã chiến thuôn gọn, vành dài, phù hiệu phía trước."],["prism-circlet","Vòng Miện Lăng Kính","Đỉnh hình thoi và đôi cánh thái dương trên vòng miện mảnh."]);
armorGroups[1][2].push(["ranger-bandolier","Đai Chéo Tuần Lâm","Đai tiện ích đeo chéo với ba túi nổi."],["carapace-vest","Áo Giáp Mai Cứng","Ba tấm giáp ngực thuôn lồng nhau, gờ giữa nhô cao."]);
armorGroups[2][2].push(["medic-cuffs","Giáp Tay Quân Y","Hai ống thuốc thủy tinh trong hộp cẳng tay có chốt."],["talon-guards","Găng Vuốt Sắc","Ba móng cong trên mỗi lòng bàn tay bọc giáp."]);
armorGroups[3][2].push(["spring-striders","Giày Trợ Lực","Đôi trụ bên hông nâng đỡ đế lò xo bản rộng."],["ridge-gaiters","Ủng Giáp Gân Nổi","Ba gờ nổi ôm bắp chân phía trên ủng đường mòn."]);

const rarities: Rarity[] = ["uncommon", "rare", "rare", "epic", "epic", "legendary", "legendary", "mythic"];
const define = ([id,name,description]: EntrySeed, category: EquipmentCategory, slot: EquipmentSlot, icon: EquipmentDefinition["icon"], accent: string, index: number): EquipmentDefinition => {
  const original = legacy.find(item=>item.id===id);
  const parts = slot === "weapon" ? weaponParts[id] : armorParts[id];
  return { ...(original ?? { id,name,description,rarity:rarities[index],slot,attack:slot==="weapon"?10+index*5:2+index,defense:slot==="weapon"?0:5+index*3,critRate:Math.min(.07,.01+index*.01),level:1+index,price:70+index*115 }), category, modelId:id, icon, accent, rigAnchors:[...new Set(parts.map(part=>part.anchor))] };
};
export const EQUIPMENT_CATALOG: EquipmentDefinition[] = [
  ...weaponGroups.flatMap(([category,icon,accent,entries])=>entries.map((entry,index)=>define(entry,category,"weapon",icon,accent,index))),
  ...armorGroups.flatMap(([slot,icon,entries])=>entries.map((entry,index)=>define(entry,slot==="accessory1"||slot==="accessory2"||slot==="relic"?"accessory":"armor",slot,icon,"#84c9d3",index))),
];
export const EQUIPMENT_MODEL_IDS: readonly string[] = EQUIPMENT_CATALOG.map(item=>item.modelId);
const recipes = new Map<string, EquipmentRecipe>(EQUIPMENT_CATALOG.map(item=>[item.id,{id:item.id,slot:item.slot,category:item.category,grip:item.slot==="weapon"?[0,0,0]:null,parts:item.slot==="weapon"?weaponParts[item.id]:armorParts[item.id]}]));
export function getEquipmentRecipe(id: string): EquipmentRecipe | undefined {
  const recipe = recipes.get(id);
  return recipe ? structuredClone(recipe) : undefined;
}
export function getEquipmentDefinition(id: string): EquipmentDefinition | undefined {
  return EQUIPMENT_CATALOG.find(item=>item.id===id);
}

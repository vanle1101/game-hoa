"use client";

import type { CSSProperties } from "react";
import "./reference-hud-overlay.css";

export type FrameName = "header" | "sidebar" | "today" | "boss" | "ai" | "skills" | "character" | "achievements" | "rewards";
type Rail = { name: FrameName; d: string; speed: number; phase: number };
type FrameRect = { x: number; y: number; width: number; height: number };

/* Exact screenshot crop bounds from the supplied frame-coordinates.json.
   The PNGs use reference RGB with conservative transparent perimeter masks. */
export const FRAME_ART: Record<FrameName, FrameRect> = {
  header: { x: 286, y: 6, width: 1494, height: 99 },
  sidebar: { x: 0, y: 81, width: 264, height: 783 },
  today: { x: 256, y: 122, width: 632, height: 321 },
  boss: { x: 894, y: 122, width: 471, height: 321 },
  ai: { x: 1358, y: 122, width: 424, height: 324 },
  skills: { x: 260, y: 437, width: 638, height: 428 },
  character: { x: 892, y: 436, width: 475, height: 276 },
  achievements: { x: 892, y: 681, width: 475, height: 182 },
  rewards: { x: 1361, y: 435, width: 421, height: 428 },
};

/* The existing rail paths were hand traced on the earlier crop set. Map those
   continuous paths to the new exact crop bounds without changing their timing. */
export const PREVIOUS_ART: Record<FrameName, FrameRect> = {
  header: { x: 291, y: 7, width: 1493, height: 94 },
  sidebar: { x: 2, y: 85, width: 255, height: 779 },
  today: { x: 267, y: 127, width: 634, height: 319 },
  boss: { x: 903, y: 129, width: 478, height: 313 },
  ai: { x: 1376, y: 129, width: 407, height: 314 },
  skills: { x: 274, y: 445, width: 628, height: 416 },
  character: { x: 904, y: 447, width: 477, height: 262 },
  achievements: { x: 905, y: 696, width: 475, height: 165 },
  rewards: { x: 1377, y: 446, width: 409, height: 415 },
};

const FRAME_NAMES: readonly FrameName[] = ["header", "sidebar", "today", "boss", "ai", "skills", "character", "achievements", "rewards"];

function railTransform(name: FrameName) {
  const old = PREVIOUS_ART[name], target = FRAME_ART[name];
  const sx = target.width / old.width, sy = target.height / old.height;
  return `matrix(${sx} 0 0 ${sy} ${target.x - old.x * sx} ${target.y - old.y * sy})`;
}

const MAIN_RAILS: Rail[] = [
  { name: "header", speed: 12, phase: -1.5, d: "M 377 22 H 1750 L 1773 45 V 66 L 1753 86 H 374 L 360 71 V 40 Z" },
  { name: "today", speed: 7.3, phase: -.4, d: "M 344 145 H 489 L 515 157 H 617 L 636 146 H 859 L 882 170 V 351 L 846 395 L 818 425 H 317 L 288 405 V 193 L 280 180 C 269 160 277 140 294 133 C 314 124 338 135 344 145 Z" },
  { name: "boss", speed: 6.8, phase: -2.1, d: "M 980 146 H 1104 L 1129 158 H 1259 L 1282 145 H 1345 L 1363 165 V 402 L 1345 426 H 949 L 920 401 V 195 L 912 181 C 902 160 912 140 930 132 C 950 123 972 135 980 146 Z" },
  { name: "ai", speed: 6.7, phase: -3.5, d: "M 1454 146 H 1550 L 1574 157 H 1697 L 1717 146 H 1749 L 1766 165 V 405 L 1745 427 H 1420 L 1395 404 V 196 L 1387 181 C 1377 160 1388 140 1406 132 C 1426 123 1447 135 1454 146 Z" },
  { name: "skills", speed: 7.8, phase: -1.3, d: "M 351 462 H 503 L 527 479 H 651 L 671 463 H 865 L 886 482 V 816 L 867 843 H 313 L 290 818 V 513 L 282 499 C 273 479 281 459 296 449 C 314 437 338 446 351 462 Z" },
  { name: "character", speed: 6.6, phase: -4.1, d: "M 981 463 H 1103 L 1127 478 H 1258 L 1280 462 H 1345 L 1362 481 V 668 L 1344 692 H 949 L 920 667 V 514 L 906 500 C 904 485 905 465 918 453 C 933 447 955 447 969 455 L 981 463 Z" },
  { name: "achievements", speed: 6, phase: -2.6, d: "M 972 712 H 1103 L 1126 727 H 1256 L 1278 712 H 1345 L 1362 730 V 824 L 1344 846 H 947 L 920 822 V 754 L 909 742 C 902 723 914 705 932 700 C 950 696 967 704 973 717 L 972 712 Z" },
  { name: "rewards", speed: 7.5, phase: -5.1, d: "M 1455 462 H 1551 L 1574 479 H 1698 L 1718 462 H 1747 L 1767 484 V 814 L 1748 843 H 1424 L 1396 816 V 513 L 1388 500 C 1381 484 1386 463 1399 451 C 1416 440 1438 444 1450 458 L 1455 462 Z" },
];

const SIDEBAR_RAIL: Rail = {
  name: "sidebar", speed: 9, phase: -3.2,
  d: "M 81 124 H 207 L 239 140 V 810 L 215 846 H 31 L 17 831 V 165 L 69 132 Z",
};

// The calibrated and responsive chassis both use these same traced tracks.
export const FRAME_RAILS: Record<FrameName, Rail> = Object.fromEntries(
  [SIDEBAR_RAIL, ...MAIN_RAILS].map(rail => [rail.name, rail]),
) as Record<FrameName, Rail>;

/* Centers are measured from the reference's visible reactor housings. The
   extracted image holds the static turbine and rings; these are glints only. */
const REACTORS = [
  [335, 55], [40, 124],
  [295, 160], [837, 394], [930, 161], [1404, 160],
  [307, 476], [931, 476], [931, 710], [1404, 477],
] as const;

function ReactorGlints({ centers, reducedMotion }: { centers: readonly (readonly [number, number])[]; reducedMotion: boolean }) {
  if (reducedMotion) return null;
  return <g className="reference-hud-reactors">
    {centers.map(([cx, cy], index) => <circle
      key={`${cx}-${cy}`}
      className="reference-hud-reactor-glint"
      cx={cx} cy={cy} r={index === 0 ? 30 : 29}
      fill="none" stroke="#FF3EEC" strokeWidth="1.5" strokeLinecap="round"
      strokeDasharray="35 965" pathLength={1000}
      filter="url(#reference-hud-led-glow)"
      style={{ "--reference-reactor-phase": `${-index * 1.19}s` } as CSSProperties}
    />)}
  </g>;
}

function MovingRail({ rail, reducedMotion }: { rail: Rail; reducedMotion: boolean }) {
  const style = { "--reference-led-speed": `${rail.speed}s`, "--reference-led-phase": `${rail.phase}s`, "--reference-led-phase-second": `${rail.phase - rail.speed / 2}s` } as CSSProperties;
  const trains = [
    { color: "#00EFFF", second: false },
    { color: "#FF3EEC", second: true },
  ] as const;
  const segments = [
    { name: "far", length: 16, start: 0, width: 3.6, opacity: .13 },
    { name: "near", length: 18, start: 16, width: 3.4, opacity: .33 },
    { name: "body", length: 12, start: 34, width: 2.8, opacity: .7 },
    { name: "head", length: 6, start: 46, width: 2.2, opacity: .98 },
  ] as const;
  return <g className="reference-hud-led" data-motion={reducedMotion ? "off" : "on"} style={style} transform={railTransform(rail.name)}>
    <path className="reference-hud-led__track" d={rail.d} fill="none" stroke="#9B5CFF" strokeWidth="1.25" strokeOpacity=".37" vectorEffect="non-scaling-stroke"/>
    {trains.map(train => segments.map(segment => <path
      key={`${train.color}-${segment.name}`}
      className={`reference-hud-led__segment${train.second ? " reference-hud-led__segment--second" : ""}`}
      d={rail.d}
      pathLength={1000}
      fill="none"
      stroke={segment.name === "head" ? "#f8fdff" : train.color}
      strokeWidth={segment.width}
      strokeOpacity={segment.opacity}
      strokeDasharray={`${segment.length} ${1000 - segment.length}`}
      filter={segment.name === "head" ? "url(#reference-hud-led-glow)" : undefined}
      vectorEffect="non-scaling-stroke"
      style={{ "--reference-led-start": `${-segment.start}px` } as CSSProperties}
    />))}
  </g>;
}

function GlowFilter() {
  return <defs><filter id="reference-hud-led-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="halo"/><feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>;
}

export default function ReferenceHudOverlay({ reducedMotion }: { reducedMotion: boolean }) {
  return <div className="reference-hud-overlay" aria-hidden="true">
    <svg className="reference-hud-overlay__canvas" viewBox="0 0 1801 873" preserveAspectRatio="none" focusable="false">
      <GlowFilter/>
      {FRAME_NAMES.map(name => {
        const art = FRAME_ART[name];
        return <image key={name} href={`/lifelevel-frames/${name}.png`} x={art.x} y={art.y} width={art.width} height={art.height}/>;
      })}
      {[SIDEBAR_RAIL, ...MAIN_RAILS].map(rail => <MovingRail key={rail.name} rail={rail} reducedMotion={reducedMotion}/>)}
      <ReactorGlints centers={REACTORS} reducedMotion={reducedMotion}/>
    </svg>
  </div>;
}

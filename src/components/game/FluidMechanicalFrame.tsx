"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FRAME_ART as REFERENCE_ART, FRAME_RAILS, PREVIOUS_ART } from "./ReferenceHudOverlay";
import "./fluid-mechanical-frame.css";

export type FluidFrameName = "header" | "sidebar" | "today" | "boss" | "ai" | "skills" | "character" | "achievements" | "rewards";

type FrameSize = { width: number; height: number };
type Reactor = { x: number; y: number; radius: number };
type FrameArt = FrameSize & { slice: readonly [number, number, number, number]; reactors: readonly Reactor[] };
type TileSeam = readonly [x: number, width: number, y: number, height: number];
type FluidMechanicalFrameProps = {
  accent?: "cyan" | "magenta";
  active?: boolean;
  animated?: boolean;
  animationSpeed?: number;
  className?: string;
  frame?: FluidFrameName;
  glowIntensity?: "soft" | "medium" | "strong";
  hoverable?: boolean;
  ledColor?: "dual" | "cyan" | "pink" | "purple";
  preferredSize?: "compact" | "medium" | "large";
  variant?: "armor" | "chrome" | "minimal";
};

// Measured from the supplied 1801 × 873 reference kit. Chassis pixels are
// source-derived; reactors are independently positioned so they remain round.
const FRAME_ART: Record<FluidFrameName, FrameArt> = {
  header: { width: 1494, height: 99, slice: [96, 62, 48, 98], reactors: [{ x: 49, y: 49, radius: 48 }] },
  sidebar: { width: 264, height: 783, slice: [80, 56, 55, 80], reactors: [{ x: 40, y: 43, radius: 39 }] },
  today: { width: 632, height: 321, slice: [80, 100, 100, 80], reactors: [{ x: 39, y: 38, radius: 39 }, { x: 581, y: 272, radius: 48 }] },
  boss: { width: 471, height: 321, slice: [80, 70, 70, 80], reactors: [{ x: 36, y: 39, radius: 39 }] },
  ai: { width: 424, height: 324, slice: [78, 68, 70, 82], reactors: [{ x: 46, y: 38, radius: 38 }] },
  skills: { width: 638, height: 428, slice: [84, 70, 70, 90], reactors: [{ x: 47, y: 39, radius: 41 }] },
  character: { width: 475, height: 276, slice: [80, 70, 70, 80], reactors: [{ x: 39, y: 40, radius: 39 }] },
  achievements: { width: 475, height: 182, slice: [62, 70, 70, 80], reactors: [{ x: 39, y: 29, radius: 30 }] },
  rewards: { width: 421, height: 428, slice: [82, 72, 70, 86], reactors: [{ x: 43, y: 42, radius: 40 }] },
};

// Coordinates of short, low-detail straight channels in each source chassis.
// Corners and reactors retain their native size at desktop viewports.
const TILE_SEAMS: Record<FluidFrameName, TileSeam> = {
  header: [540, 8, 45, 8], sidebar: [128, 8, 236, 8],
  today: [199, 12, 144, 8], boss: [317, 8, 145, 8],
  ai: [224, 8, 167, 8], skills: [354, 12, 272, 8],
  character: [317, 8, 134, 8], achievements: [314, 8, 87, 8],
  rewards: [167, 8, 245, 8],
};
const TILED_PARTS = ["top-left", "top-middle", "top-right", "middle-left", "middle-middle", "middle-right", "bottom-left", "bottom-middle", "bottom-right"] as const;

/** Map coordinates with the same corner and center widths as CSS border-image.
 *  This keeps the LED on each extracted circuit track when a panel is resized. */
function mapAxis(value: number, source: number, target: number, before: number, after: number, targetBefore: number, targetAfter: number) {
  if (value <= before) return value * targetBefore / before;
  if (value >= source - after) return target - (source - value) * targetAfter / after;
  return targetBefore + (value - before) * (target - targetBefore - targetAfter) / (source - before - after);
}

function railPath(frame: FluidFrameName, bounds: FrameSize, sourceSlice: FrameArt["slice"], targetSlice: readonly [number, number, number, number]) {
  const previous = PREVIOUS_ART[frame];
  const reference = REFERENCE_ART[frame];
  const [top, right, bottom, left] = sourceSlice;
  const [targetTop, targetRight, targetBottom, targetLeft] = targetSlice;
  const tokens = FRAME_RAILS[frame].d.match(/[MLHVCZ]|-?(?:\d*\.)?\d+/g);
  if (!tokens) return "";
  const mapped = (x: number, y: number) => {
    const sourceX = (x - previous.x) * reference.width / previous.width;
    const sourceY = (y - previous.y) * reference.height / previous.height;
    const targetX = mapAxis(sourceX, reference.width, bounds.width, left, right, targetLeft, targetRight);
    const targetY = mapAxis(sourceY, reference.height, bounds.height, top, bottom, targetTop, targetBottom);
    return `${targetX.toFixed(2)} ${targetY.toFixed(2)}`;
  };
  const parts: string[] = [];
  let x = 0, y = 0;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++];
    if (command === "M" || command === "L") {
      x = Number(tokens[index++]); y = Number(tokens[index++]);
      parts.push(`${command} ${mapped(x, y)}`);
    } else if (command === "H") {
      x = Number(tokens[index++]);
      parts.push(`L ${mapped(x, y)}`);
    } else if (command === "V") {
      y = Number(tokens[index++]);
      parts.push(`L ${mapped(x, y)}`);
    } else if (command === "C") {
      const x1 = Number(tokens[index++]), y1 = Number(tokens[index++]);
      const x2 = Number(tokens[index++]), y2 = Number(tokens[index++]);
      x = Number(tokens[index++]); y = Number(tokens[index++]);
      parts.push(`C ${mapped(x1, y1)} ${mapped(x2, y2)} ${mapped(x, y)}`);
    } else if (command === "Z") {
      parts.push("Z");
    } else {
      throw new Error(`Unexpected frame rail command: ${command}`);
    }
  }
  return parts.join(" ");
}

function reactorStyle(frame: FrameArt, reactor: Reactor, index: number, scale: number, name: FluidFrameName): CSSProperties {
  const size = (reactor.radius * 2 + 1) * scale;
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url('/lifelevel-frames/reactors/${name}_${index + 1}.png')`,
  };
  if (reactor.x < frame.width / 2) style.left = (reactor.x - reactor.radius) * scale;
  else style.right = (frame.width - reactor.x - reactor.radius - 1) * scale;
  if (reactor.y < frame.height / 2) style.top = (reactor.y - reactor.radius) * scale;
  else style.bottom = (frame.height - reactor.y - reactor.radius - 1) * scale;
  return style;
}

/** Kit-derived, responsive perimeter art for panels without fixed coordinates. */
export default function FluidMechanicalFrame({
  accent = "cyan",
  active = false,
  animated = true,
  animationSpeed,
  className = "",
  frame = "boss",
  glowIntensity = "medium",
  hoverable = true,
  ledColor = "dual",
  preferredSize,
  variant = "armor",
}: FluidMechanicalFrameProps) {
  const host = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<FrameSize>({ width: 360, height: 240 });
  const [visible, setVisible] = useState(true);
  const filterId = `fluid-frame-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useLayoutEffect(() => {
    const target = host.current;
    if (!target) return;
    const measure = () => {
      const rect = target.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width < 1 || height < 1) return;
      setBounds(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = host.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? true), { rootMargin: "80px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const art = FRAME_ART[frame];
  const composed = bounds.width >= art.width && bounds.height >= art.height;
  const scale = composed ? 1 : Math.min(1.1, Math.max(.42, Math.min(bounds.width / art.width, bounds.height / art.height)));
  const size = preferredSize ?? (scale < .62 ? "compact" : scale < .9 ? "medium" : "large");
  const [top, right, bottom, left] = art.slice;
  const [tileX, tileWidth, tileY, tileHeight] = TILE_SEAMS[frame];
  const sourceSlice = composed ? [tileY, art.width - tileX - tileWidth, art.height - tileY - tileHeight, tileX] as const : art.slice;
  const targetSlice = composed ? sourceSlice : [Math.min(top * scale, bounds.height * .44), Math.min(right * scale, bounds.width * .38), Math.min(bottom * scale, bounds.height * .44), Math.min(left * scale, bounds.width * .38)] as const;
  const primary = ledColor === "cyan" ? "#00efff" : ledColor === "pink" ? "#ff3eec" : ledColor === "purple" ? "#9b5cff" : accent === "magenta" ? "#ff3eec" : "#00efff";
  const secondary = ledColor === "cyan" || ledColor === "pink" || ledColor === "purple" ? primary : accent === "magenta" ? "#00efff" : "#ff3eec";
  const style = {
    "--fluid-primary": primary,
    "--fluid-secondary": secondary,
    "--fluid-image": `url('/lifelevel-frames/fluid/${frame}-chassis.png')`,
    "--fluid-slice": `${top} ${right} ${bottom} ${left}`,
    "--fluid-top": `${targetSlice[0]}px`,
    "--fluid-right": `${targetSlice[1]}px`,
    "--fluid-bottom": `${targetSlice[2]}px`,
    "--fluid-left": `${targetSlice[3]}px`,
    "--fluid-tile-left": `${tileX}px`,
    "--fluid-tile-right": `${art.width - tileX - tileWidth}px`,
    "--fluid-tile-top": `${tileY}px`,
    "--fluid-tile-bottom": `${art.height - tileY - tileHeight}px`,
    "--fluid-lap": `${animationSpeed ? Math.min(30, Math.max(2.5, animationSpeed)) : size === "compact" ? 6.6 : size === "medium" ? 7.4 : 8}s`,
  } as CSSProperties;
  const path = railPath(frame, bounds, sourceSlice, targetSlice);

  return <div ref={host} className={`fluid-mechanical-frame ${className}`.trim()} data-frame={frame} data-composition={composed ? "tiled-parts" : "border-image"} data-accent={accent} data-active={active} data-hoverable={hoverable} data-glow={glowIntensity} data-size={size} data-variant={variant} data-motion={animated ? "on" : "off"} data-visible={visible} style={style} aria-hidden="true">
    {composed ? <span className="fluid-mechanical-frame__tiled-chassis">
      {TILED_PARTS.map(part => <span key={part} className="fluid-mechanical-frame__tiled-piece" data-part={part} style={{ backgroundImage: `url('/lifelevel-frames/${frame === "today" ? "today-parts" : `parts/${frame}`}/${part}.png')` }}/>) }
    </span> : <span className="fluid-mechanical-frame__chassis" />}
    {art.reactors.map((reactor, index) => <span key={index} className="fluid-mechanical-frame__reactor" style={reactorStyle(art, reactor, index, scale, frame)}/>)}
    <svg className="fluid-mechanical-frame__led" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="none" focusable="false">
      <defs><filter id={filterId} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="halo"/><feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path className="fluid-mechanical-frame__pulse fluid-mechanical-frame__pulse--primary" d={path} pathLength={1000} stroke="var(--fluid-primary)" strokeWidth="3.4" strokeDasharray="50 950" filter={`url(#${filterId})`} />
      <path className="fluid-mechanical-frame__pulse fluid-mechanical-frame__pulse--secondary" d={path} pathLength={1000} stroke="var(--fluid-secondary)" strokeWidth="2.6" strokeDasharray="38 962" filter={`url(#${filterId})`} />
    </svg>
  </div>;
}

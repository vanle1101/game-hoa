"use client";

import * as React from "react";
import "./reference-frame.css";

/**
 * Static art comes from the user's reference screenshot, not AI-reconstructed CSS.
 * The center of each sprite is transparent so the LIVE application is usable.
 *
 * IMPORTANT: Assets correspond to screenshot crop bounds, not logical panel bounds.
 * Overlay parent must be positioned to the crop box for pixel-precise reference mode.
 * Pixel-precision can only be tested at 1801x873 until a source layout is calibrated.
 */
export type ReferenceFrameName =
  | "header" | "sidebar" | "today" | "boss" | "ai" | "skills"
  | "character" | "achievements" | "rewards";

export const FRAME_GEOMETRY: Record<ReferenceFrameName, {
  rect: readonly [number, number, number, number];
  size: readonly [number, number];
  duration: number;
}> = {
  header:       { rect: [286, 6, 1780, 105], size: [1494, 99], duration: 11 },
  sidebar:      { rect: [0, 81, 264, 864], size: [264, 783], duration: 13 },
  today:        { rect: [256, 122, 888, 443], size: [632, 321], duration: 8 },
  boss:         { rect: [894, 122, 1365, 443], size: [471, 321], duration: 7 },
  ai:           { rect: [1358, 122, 1782, 446], size: [424, 324], duration: 7 },
  skills:       { rect: [260, 437, 898, 865], size: [638, 428], duration: 10 },
  character:    { rect: [892, 436, 1367, 712], size: [475, 276], duration: 7 },
  achievements: { rect: [892, 681, 1367, 863], size: [475, 182], duration: 6 },
  rewards:      { rect: [1361, 435, 1782, 863], size: [421, 428], duration: 9 },
};

// Deliberately conservative path estimate: animated pulses travel around each
// frame, while the pixel-exact STATIC neon artwork is from the source screenshot.
// Codex must refine path points after examining a screenshot overlay.
function perimeterPath(name: ReferenceFrameName, w: number, h: number): string {
  if (name === "header") {
    return `M 92 23 L ${w * 0.21} 23 L ${w * 0.245} 41 L ${w * 0.43} 41 L ${w * 0.46} 22 L ${w - 35} 22 L ${w - 14} 44 L ${w - 14} ${h - 25} L 78 ${h - 25} Z`;
  }
  if (name === "sidebar") {
    return `M 43 57 L ${w - 47} 57 L ${w - 20} 86 L ${w - 20} ${h - 40} L ${w - 45} ${h - 19} L 27 ${h - 19} L 17 ${h - 50} L 17 105 Z`;
  }
  const left = 19, right = w - 18, top = 18, bottom = h - 18;
  return [
    `M 68 ${top}`,
    `L ${Math.round(w * 0.36)} ${top}`,
    `L ${Math.round(w * 0.40)} 30`,
    `L ${Math.round(w * 0.53)} 30`,
    `L ${Math.round(w * 0.56)} ${top}`,
    `L ${w - 45} ${top}`,
    `L ${right} 47`,
    `L ${right} ${h - 47}`,
    `L ${w - 46} ${bottom}`,
    `L ${Math.round(w * 0.61)} ${bottom}`,
    `L ${Math.round(w * 0.57)} ${h - 31}`,
    `L ${Math.round(w * 0.39)} ${h - 31}`,
    `L ${Math.round(w * 0.35)} ${bottom}`,
    `L 46 ${bottom}`,
    `L ${left} ${h - 46}`,
    `L ${left} 50`,
    `Z`,
  ].join(" ");
}

export interface ReferenceFrameOverlayProps {
  name: ReferenceFrameName;
  /** Where frame assets were copied into Next.js /public; defaults to /lifelevel-frames */
  assetBase?: string;
  /** The underlying static frame is always visible even when animation is disabled. */
  animated?: boolean;
  glowOpacity?: number;
  className?: string;
}

/** Put inside a position:relative wrapper matching FRAME_GEOMETRY[name].rect. */
export function ReferenceFrameOverlay({
  name, assetBase = "/lifelevel-frames", animated = true, glowOpacity = 0.75, className = "",
}: ReferenceFrameOverlayProps) {
  const { size: [w, h], duration } = FRAME_GEOMETRY[name];
  const path = perimeterPath(name, w, h);
  return (
    <div
      className={`lifelevel-frame-overlay ${animated ? "lifelevel-frame-animated" : ""} ${className}`}
      aria-hidden="true"
      style={{
        "--lifelevel-frame-speed": `${duration}s`,
        "--lifelevel-frame-glow": String(glowOpacity),
      } as React.CSSProperties}
    >
      <img
        className="lifelevel-frame-texture"
        src={`${assetBase.replace(/\/$/, "")}/${name}.png`}
        draggable={false}
        alt=""
      />
      <svg
        className="lifelevel-frame-paths"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d={path} pathLength={1000} className="lifelevel-track-soft" />
        <path d={path} pathLength={1000} className="lifelevel-led-glow" />
        <path d={path} pathLength={1000} className="lifelevel-led-core" />
        <path d={path} pathLength={1000} className="lifelevel-led-cyan" />
      </svg>
    </div>
  );
}

/**
 * Calibrated overlay for the reference dashboard at exactly 1801x873.
 * Useful as a first-pass non-interactive ornament layer over existing DOM.
 * DO NOT use as a replacement for real content. Remove/adjust individual
 * overlays if the app's actual layout is different from the reference.
 */
export function ReferenceDashboardDecoration({
  assetBase = "/lifelevel-frames", animated = true,
}: { assetBase?: string; animated?: boolean }) {
  const names = Object.keys(FRAME_GEOMETRY) as ReferenceFrameName[];
  return (
    <div className="lifelevel-frame-stage" aria-hidden="true">
      {names.map((name) => {
        const { rect: [x1, y1, x2, y2] } = FRAME_GEOMETRY[name];
        return (
          <div key={name} className="lifelevel-frame-position" style={{
            left: `${x1 / 1801 * 100}%`,
            top: `${y1 / 873 * 100}%`,
            width: `${(x2 - x1) / 1801 * 100}%`,
            height: `${(y2 - y1) / 873 * 100}%`,
          }}>
            <ReferenceFrameOverlay name={name} assetBase={assetBase} animated={animated} />
          </div>
        );
      })}
    </div>
  );
}

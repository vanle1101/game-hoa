"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import FluidMechanicalFrame, { type FluidFrameName } from "./FluidMechanicalFrame";

export type AnimatedLedBorderProps = {
  accent?: "cyan" | "magenta";
  active?: boolean;
  animationEnabled?: boolean;
  animationSpeed?: number;
  className?: string;
  code?: string;
  glowIntensity?: "soft" | "medium" | "strong";
  hoverable?: boolean;
  ledColor?: "dual" | "cyan" | "pink" | "purple";
  size?: "compact" | "medium" | "large";
  variant?: "armor" | "chrome" | "minimal";
};

type MechVectorFrameProps = Omit<ComponentPropsWithoutRef<"section">, "children"> &
  Omit<AnimatedLedBorderProps, "className"> & {
    children: ReactNode;
    code: string;
  };

const KIT_FRAME_BY_CODE: Record<string, FluidFrameName> = {
  "01-A": "today",
  "02-B": "boss",
  "03-C": "ai",
  "04-D": "skills",
  "05-E": "character",
  "06-F": "achievements",
  "07-G": "rewards",
};

function frameForCode(code?: string): FluidFrameName {
  if (code === "sidebar-rail") return "sidebar";
  if (code === "topbar-rail" || code === "lobby-header") return "header";
  return KIT_FRAME_BY_CODE[code ?? ""] ?? "boss";
}

/** Static chassis and turbine pixels come from the supplied reference kit. */
export function AnimatedLedBorder({
  accent = "cyan",
  active = false,
  animationEnabled = true,
  animationSpeed,
  className = "",
  code,
  glowIntensity = "medium",
  hoverable = true,
  ledColor = "dual",
  size,
  variant = "armor",
}: AnimatedLedBorderProps) {
  return <FluidMechanicalFrame
    accent={accent}
    active={active}
    animated={animationEnabled}
    animationSpeed={animationSpeed}
    className={className}
    frame={frameForCode(code)}
    glowIntensity={glowIntensity}
    hoverable={hoverable}
    ledColor={ledColor}
    preferredSize={size}
    variant={variant}
  />;
}

export default function MechVectorFrame({
  children,
  code,
  accent = "cyan",
  active = false,
  animationEnabled = true,
  animationSpeed,
  className = "",
  glowIntensity = "medium",
  hoverable = true,
  ledColor = "dual",
  size = "large",
  variant = "armor",
  ...props
}: MechVectorFrameProps) {
  return <section {...props}
    className={`vref-panel cyber-mech-frame mech-vector-frame ${className}`.trim()}
    data-accent={accent}
    data-frame-code={code}
    data-active={active}
    data-hoverable={hoverable}
    data-size={size}
    data-variant={variant}
    data-glow={glowIntensity}
    data-led-color={ledColor}
    data-animation-speed={animationSpeed}
  >
    <FluidMechanicalFrame
      accent={accent}
      active={active}
      animated={animationEnabled}
      animationSpeed={animationSpeed}
      frame={frameForCode(code)}
      glowIntensity={glowIntensity}
      hoverable={hoverable}
      ledColor={ledColor}
      preferredSize={size}
      variant={variant}
    />
    {children}
  </section>;
}

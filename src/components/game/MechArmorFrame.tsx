import type { ComponentPropsWithoutRef, ReactNode } from "react";

type MechArmorFrameProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  children: ReactNode;
  code: string;
  accent?: "cyan" | "magenta";
};

const corners = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export default function MechArmorFrame({ children, code, accent = "cyan", className = "", ...props }: MechArmorFrameProps) {
  return <section {...props} className={`vref-panel cyber-mech-frame mech-armor-frame ${className}`.trim()} data-accent={accent}>
    <div className="mech-armor-layer mech-armor-shell" aria-hidden="true">
      <div className="mech-armor-groove">
        <div className="mech-armor-core"><span className="mech-armor-grid" /></div>
      </div>
    </div>
    <span className="mech-armor-layer mech-armor-scan" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-tube mech-armor-tube--top-left" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-tube mech-armor-tube--top-right" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-tube mech-armor-tube--left" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-tube mech-armor-tube--bottom-left" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-tube mech-armor-tube--bottom-right" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-tube mech-armor-tube--right" aria-hidden="true" />
    {corners.map(corner => <span className={`mech-armor-layer mech-armor-clamp mech-armor-clamp--${corner}`} key={corner} aria-hidden="true"><i /><i /><em /></span>)}
    <span className="mech-armor-layer mech-armor-hazard" aria-hidden="true" />
    <span className="mech-armor-layer mech-armor-leds" aria-hidden="true"><i /><i /><i /><i /></span>
    <span className="mech-armor-layer mech-armor-serial" aria-hidden="true">SYS.NODE{" // "}{code}{" // "}ARMOR: ONLINE</span>
    <span className="mech-armor-layer mech-armor-barcode" aria-hidden="true" />
    {children}
  </section>;
}

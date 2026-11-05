"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatedLedBorder } from "./MechVectorFrame";
import FluidMechanicalFrame from "./FluidMechanicalFrame";
import "./mech-vector-frame.css";
import "./cyber-panel-decorator.css";

type DecoratedPanel = {
  element: HTMLElement;
  id: number;
  transparent: boolean;
  legacy: boolean;
  compact: boolean;
};

// Specific surfaces come first so a generic panel cannot consume their frame.
// Calendar cells and small item cards stay clear; requested boss cards get frames.
const PANEL_SELECTORS = [
  ".modal-scrim > .modal",
  ".vref-reward-modal",
  ".notification-panel",
  ".world-main .priorities",
  ".world-main .boss-hud",
  ".world-main .character-hud",
  ".screen-calendar .calendar-grid",
  ".screen-campaigns .cm-stage",
  ".screen-campaigns .cm-detail",
  ".screen-campaigns .cm-milestone-section",
  ".screen-career .career-current",
  ".screen-character .studio-navigation",
  ".screen-character .studio-stage",
  ".screen-character .studio-controls",
  ".screen-furniture .furniture-shop-nav",
  ".screen-furniture .furniture-showcase",
  ".screen-furniture .furniture-selected-details",
  ".screen-furniture .furniture-shop-content",
  ".screen-achievements .feature-banner",
  ".screen-farming .feature-banner",
  ".screen-bosses .catalog-grid > .catalog-card",
  ".content-main .panel",
  ".content-main .ref-panel",
  ".content-main .ref-extras",
  ".content-main .campaign-map",
  ".content-main .combat-stage",
  ".construction-editor .construction-palette",
  ".construction-editor .construction-inspector",
  ".construction-editor .construction-live-panel",
  ".construction-editor .construction-cost",
  ".construction-editor .construction-confirm > div",
] as const;

const TRANSPARENT_FRAME_SELECTOR = ".cm-stage, .studio-stage, .furniture-showcase";
const COMPACT_FRAME_SELECTOR = ".world-main .boss-hud, .world-main .character-hud";
const MAX_DECORATED_PANELS = 12;
const panelIds = new WeakMap<HTMLElement, number>();
let nextPanelId = 0;

function idFor(panel: HTMLElement) {
  let id = panelIds.get(panel);
  if (id === undefined) {
    id = ++nextPanelId;
    panelIds.set(panel, id);
  }
  return id;
}

function syncPositioning(panel: HTMLElement) {
  // A static panel needs a containing block for its absolute SVG. Preserve
  // sticky, fixed, and absolute positioning already set by each screen.
  panel.classList.remove("cyber-panel-needs-position");
  if (getComputedStyle(panel).position === "static") panel.classList.add("cyber-panel-needs-position");
}

function eligiblePanels(): DecoratedPanel[] {
  const selected: DecoratedPanel[] = [];
  const legacy = Boolean(document.querySelector(".game-shell.lobby-view"));
  for (const selector of PANEL_SELECTORS) {
    for (const panel of document.querySelectorAll<HTMLElement>(selector)) {
      if (panel.matches(".quest-card, .card") || panel.closest(".mech-vector-frame")) continue;
      if (selected.some(({ element }) => element.contains(panel) || panel.contains(element))) continue;
      const rect = panel.getBoundingClientRect();
      const compact = panel.matches(COMPACT_FRAME_SELECTOR);
      const minWidth = panel.matches(".screen-bosses .catalog-grid > .catalog-card") ? 150 : 200;
      const minHeight = compact ? 58 : panel.matches(".feature-banner, .notification-panel") ? 90 : 140;
      if (rect.width < minWidth || rect.height < minHeight) continue;
      syncPositioning(panel);
      selected.push({
        element: panel,
        id: idFor(panel),
        transparent: panel.matches(TRANSPARENT_FRAME_SELECTOR) || Boolean(panel.querySelector("canvas")),
        legacy,
        compact,
      });
      if (selected.length >= MAX_DECORATED_PANELS) return selected;
    }
  }
  return selected;
}

function samePanels(a: readonly DecoratedPanel[], b: readonly DecoratedPanel[]) {
  return a.length === b.length && a.every((panel, index) =>
    panel.element === b[index].element && panel.transparent === b[index].transparent && panel.legacy === b[index].legacy && panel.compact === b[index].compact
  );
}

/** Decorates major panels without wrapping or changing their live content. */
export default function CyberPanelDecorator() {
  const [panels, setPanels] = useState<DecoratedPanel[]>([]);

  useEffect(() => {
    let scheduled = 0;
    let settleTimer = 0;
    const scan = () => {
      scheduled = 0;
      const next = eligiblePanels();
      setPanels(previous => samePanels(previous, next) ? previous : next);
    };
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(scan);
      // Lazy 3D and page modules can finish sizing after the first frame.
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(scan, 220);
    };
    scan();
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && !node.matches(".cyber-led-border, .fluid-mechanical-frame") && !node.closest(".cyber-led-border, .fluid-mechanical-frame")
      ))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (scheduled) cancelAnimationFrame(scheduled);
      window.clearTimeout(settleTimer);
    };
  }, []);

  useEffect(() => {
    for (const { element, legacy } of panels) {
      element.classList.add("cyber-panel-decorated");
      if (!legacy) element.classList.add("cyber-panel-fluid");
      syncPositioning(element);
    }
    return () => {
      for (const { element } of panels) element.classList.remove("cyber-panel-decorated", "cyber-panel-needs-position", "cyber-panel-fluid");
    };
  }, [panels]);

  return <>{panels.map(({ element, id, transparent, legacy, compact }) => {
    return createPortal(
      legacy || compact ? <AnimatedLedBorder
        code={`MODULE-${id}`}
        variant={transparent || compact ? "minimal" : "chrome"}
        accent={element.matches(".feature-banner, .screen-bosses .catalog-card") ? "magenta" : "cyan"}
        size={compact ? "compact" : "medium"}
        glowIntensity="soft"
        animationSpeed={12}
      /> : <FluidMechanicalFrame accent={element.matches(".feature-banner, .screen-bosses .catalog-card") ? "magenta" : "cyan"} />,
      element,
      id,
    );
  })}</>;
}

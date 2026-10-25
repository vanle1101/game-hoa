import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CAREERS } from "../../src/domain/catalog";
import { createInitialState } from "../../src/domain/engine";
import CareerPanel from "../../src/components/game/CareerPanel";

type ButtonProps = { children?: ReactNode; disabled?: boolean; onClick?: () => void };

function buttons(node: ReactNode): ButtonProps[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    return child.type === "button" ? [child.props as ButtonProps] : buttons(child.props.children);
  });
}

function fixture(options: { career?: string; rank?: number; skillXp?: number; busy?: boolean } = {}) {
  const state = createInitialState("career-panel-test", "2026-01-01T00:00:00.000Z");
  state.character.career = options.career ?? CAREERS[0].id;
  state.character.careerRank = options.rank ?? 0;
  for (const career of CAREERS) state.character.skillXp[career.skill] = options.skillXp ?? 0;
  const act = vi.fn();
  const props = { character: state.character, act, busy: options.busy };
  return { state, act, props, html: renderToStaticMarkup(createElement(CareerPanel, props)) };
}

const cards = (html: string) => [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match => match[0]);

describe("CareerPanel", () => {
  it("renders the real career catalog with distinct skill-linked icons", () => {
    const { html } = fixture();
    const renderedCards = cards(html);
    expect(renderedCards).toHaveLength(CAREERS.length);
    const icons = renderedCards.map(card => card.match(/<svg[\s\S]*?<\/svg>/)?.[0]);
    expect(new Set(icons).size).toBe(CAREERS.length);
    for (const [index, career] of CAREERS.entries()) {
      expect(renderedCards[index]).toContain(`data-skill="${career.skill}"`);
      expect(renderedCards[index]).toContain(career.name);
      expect(renderedCards[index]).toContain(`id="career-${career.id}-title"`);
      expect(renderedCards[index]).toContain("Nhánh kỹ năng:");
    }
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });

  it.each(CAREERS)("reflects $id selection, actual rank and actual skill XP", career => {
    const { html } = fixture({ career: career.id, rank: 7, skillXp: 1234 });
    expect(html).toContain(`id="career-current-title">${career.name}</h2>`);
    expect(html).toContain('aria-label="Hạng nghề nghiệp 7"');
    expect(html).toContain("1.234</strong> XP kỹ năng");
    const renderedCards = cards(html);
    expect(renderedCards.filter(card => card.includes('data-selected="true"'))).toHaveLength(1);
    for (const [index, item] of CAREERS.entries()) {
      const selected = item.id === career.id;
      expect(renderedCards[index].includes('disabled=""')).toBe(selected);
      expect(renderedCards[index]).toContain(selected ? "Đang theo đuổi" : "Chọn nghề nghiệp");
    }
  });

  it("dispatches unchanged selection and promotion commands without mutating character data", () => {
    const { state, props, act } = fixture();
    const before = JSON.stringify(state);
    const controls = buttons(CareerPanel(props));
    expect(controls).toHaveLength(CAREERS.length + 1);
    expect(controls[0].disabled).toBe(false);
    controls[0].onClick?.();
    expect(act).toHaveBeenLastCalledWith({ type: "career.promote" });
    for (const [index, career] of CAREERS.entries()) {
      if (controls[index + 1].disabled) continue;
      controls[index + 1].onClick?.();
      expect(act).toHaveBeenLastCalledWith({ type: "career.select", careerId: career.id });
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps all controls disabled while busy or offline is supplied by the parent", () => {
    const { props, html, act } = fixture({ busy: true });
    expect(buttons(CareerPanel(props)).every(button => button.disabled)).toBe(true);
    expect(html.match(/disabled=""/g)).toHaveLength(CAREERS.length + 1);
    expect(act).not.toHaveBeenCalled();
  });

  it("shows a truthful fallback when no catalog career is selected", () => {
    const { html } = fixture({ career: "", rank: 0 });
    expect(html).toContain('id="career-current-title">Chọn con đường của bạn</h2>');
    expect(html).toContain('aria-label="Hạng nghề nghiệp 0"');
    expect(html).not.toContain("XP kỹ năng");
    expect(html).not.toContain("Đang theo đuổi");
    expect(cards(html).every(card => !card.includes('disabled=""'))).toBe(true);
  });

  it("preserves accessible button labels and card descriptions", () => {
    const { html } = fixture();
    expect(html).toContain("Xét thăng hạng");
    expect(html.match(/type="button"/g)).toHaveLength(CAREERS.length + 1);
    for (const career of CAREERS) {
      expect(html).toContain(`aria-describedby="career-${career.id}-title career-${career.id}-skill"`);
    }
    const icons = [...html.matchAll(/<svg\b[^>]*>/g)].map(match => match[0]);
    expect(icons.every(icon => icon.includes('aria-hidden="true"'))).toBe(true);
  });

  it("declares responsive flow, usable targets and visible keyboard focus without global selectors", () => {
    const css = readFileSync(resolve(__dirname, "../../src/components/game/career-panel.css"), "utf8");
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid");
    expect(css).toContain("scroll-margin-block: 90px");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toMatch(/position:\s*(fixed|sticky)/);
  });
});

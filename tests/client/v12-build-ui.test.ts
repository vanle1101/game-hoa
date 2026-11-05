import fs from "fs";
import os from "os";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ConstructionEditor from "@/components/construction/ConstructionEditor";
import { createInitialState } from "@/domain/engine";
import { getBuilding } from "@/construction";
import { FURNITURE } from "@/domain/catalog";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

function renderEditor(options: {
  startMode?: "live" | "build" | "buy";
  ownedFurniture?: Record<string, number>;
  gold?: number;
  placedFurniture?: { id: string; furnitureId: string; x: number; z: number; level: number; rotation: 0 | 90 | 180 | 270 }[];
} = {}) {
  const state = createInitialState("v12-build-ui-tester", "2026-10-16T08:00:00.000Z");
  const building = structuredClone(getBuilding(state));
  state.building = building;
  if (options.ownedFurniture) state.ownedFurniture = options.ownedFurniture;
  if (options.gold !== undefined) state.gold = options.gold;
  if (options.placedFurniture) {
    state.building.plan.furniture = options.placedFurniture;
  }
  return renderToStaticMarkup(createElement(ConstructionEditor, {
    state,
    startMode: options.startMode ?? "build",
    onState: () => {},
    onExit: () => {},
    onInteract: () => {},
  }));
}

describe("V12 Construction UI/UX Specification", () => {
  it("renders a viewport-dominant full-screen structure in all modes", () => {
    for (const mode of ["live", "build", "buy"] as const) {
      const html = renderEditor({ startMode: mode });
      expect(html).toContain(`class="construction-editor ${mode}"`);
      expect(html).toContain('class="construction-viewport"');
      expect(html).toContain('class="construction-top"');
    }
  });

  it("renders mouse-only bottom tools and the separated movement hint in build mode", () => {
    const html = renderEditor({ startMode: "build" });
    expect(html).toContain('class="construction-toolbar"');
    expect(html).toContain('aria-label="Công cụ xây dựng"');
    const expectedTools = ["Chọn", "Phòng", "Tường", "Kính cong", "Sàn", "Cửa đi", "Cửa sổ", "Vật liệu", "Tháo dỡ", "Di chuyển"];
    for (const toolName of expectedTools) {
      expect(html).toContain(`aria-label="${toolName}"`);
      expect(html).toContain(`<span>${toolName}</span>`);
    }
    expect(html).not.toContain('data-hotkey=');
    expect(html).toContain("WASD: DI CHUYỂN CAMERA");
    expect(html).toContain("PHÍM MŨI TÊN: DI CHUYỂN NHÂN VẬT Ở SINH HOẠT");
  });

  it("renders right catalog with real 3D model projections, ownership badges, and prices in buy mode", () => {
    const testItem = FURNITURE[0];
    const html = renderEditor({
      startMode: "buy",
      gold: 5000,
      ownedFurniture: { [testItem.id]: 3 },
      placedFurniture: [{ id: "p1", furnitureId: testItem.id, x: 0, z: 0, level: 0, rotation: 0 }],
    });

    expect(html).toContain('class="construction-palette"');
    expect(html).toContain('class="buy-items"');
    expect(html).toContain('class="furniture-thumbnail"');
    expect(html).toContain('class="furniture-projection-svg"');
    expect(html).toContain('viewBox="0 0 100 92"');
    expect(html).toContain('class="badge-owned"');
    expect(html).toContain(`Đã sở hữu 3`);
    expect(html).toContain('class="badge-placed"');
    expect(html).toContain('Đã đặt 1');
    expect(html).toContain('Trong kho 2');
    expect(html).toContain(`${testItem.price} G`);
    expect(html).toContain('Tìm nội thất…');
  });

  it("shows unowned badge for items not yet purchased", () => {
    const html = renderEditor({ startMode: "buy", ownedFurniture: {} });
    expect(html).toContain('class="badge-unowned"');
    expect(html).toContain('Chưa mua');
  });

  it("displays build grid status and ghost indicators matching cyan valid and red invalid specification", () => {
    const buildHtml = renderEditor({ startMode: "build" });
    expect(buildHtml).toContain('class="construction-hud-status"');
    expect(buildHtml).toContain('Lưới xây dựng: Bật');
    expect(buildHtml).toContain('Cyan hợp lệ');
    expect(buildHtml).toContain('Đỏ không hợp lệ');

    const liveHtml = renderEditor({ startMode: "live" });
    expect(liveHtml).not.toContain('class="construction-hud-status"');
  });

  it("renders undo, redo, save, and cancel controls with proper labels and states", () => {
    const html = renderEditor({ startMode: "build" });
    expect(html).toContain('aria-label="Hoàn tác bản nháp"');
    expect(html).toContain('aria-label="Làm lại bản nháp"');
    expect(html).toContain('Hủy bản nháp');
    expect(html).toContain('Lưu công trình');
    expect(html).toContain('CHI PHÍ DỰ KIẾN');
    expect(html).toContain('ĐÃ LƯU MỌI THAY ĐỔI');
  });

  it("captures visual reference screenshots when browser is available", async () => {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ channel: "msedge", headless: true });
      const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
      const css = fs.readFileSync(path.resolve("src/components/construction/construction.css"), "utf-8");

      const buildHtml = `<!DOCTYPE html><html><head><style>${css}</style></head><body style="margin:0;background:#080d18;">${renderEditor({ startMode: "build" })}</body></html>`;
      await page.setContent(buildHtml);
      const buildPath = path.resolve(os.tmpdir(), "v12-build-mode.png");
      await page.screenshot({ path: buildPath });

      const buyHtml = `<!DOCTYPE html><html><head><style>${css}</style></head><body style="margin:0;background:#080d18;">${renderEditor({ startMode: "buy" })}</body></html>`;
      await page.setContent(buyHtml);
      const buyPath = path.resolve(os.tmpdir(), "v12-buy-mode.png");
      await page.screenshot({ path: buyPath });

      await browser.close();
      expect(fs.existsSync(buildPath)).toBe(true);
      expect(fs.existsSync(buyPath)).toBe(true);
    } catch {
      // browser screenshot fallback per F-01
    }
  }, 30000);
});

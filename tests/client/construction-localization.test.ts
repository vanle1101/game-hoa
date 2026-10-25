import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ConstructionEditor from "@/components/construction/ConstructionEditor";
import { createInitialState } from "@/domain/engine";
import { CURVE_FRAMES, CURVE_MATERIALS } from "@/construction/curves";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

const source = readFileSync(resolve(__dirname, "../../src/components/construction/ConstructionEditor.tsx"), "utf8");
const renderEditor = (startMode: "live" | "build" | "buy") => renderToStaticMarkup(createElement(ConstructionEditor, {
  state: createInitialState("construction-localization", "2026-10-16T08:00:00.000Z"),
  startMode,
  onState: () => {},
  onExit: () => {},
  onInteract: () => {},
}));

describe("Vietnamese construction editor labels", () => {
  it.each([
    ["live", "Nhà của bạn. Phong cách của bạn.", "CÔNG TRÌNH CỦA TÔI", "SINH HOẠT"],
    ["build", "Xây dựng chương tiếp theo.", "BỘ CÔNG CỤ XÂY DỰNG", "KÉO ĐỂ XÂY"],
    ["buy", "Sắp đặt không gian của bạn.", "DANH MỤC NỘI THẤT", "KÉO ĐỂ XÂY"],
  ] as const)("renders localized %s mode without changing its identifier", (mode, heading, section, help) => {
    const html = renderEditor(mode);
    for (const label of ["Sinh hoạt", "Xây dựng", "Mua sắm", "NEON HAVEN · XƯỞNG KIẾN TRÚC", heading, section, help, "Phiên bản", "TƯỜNG", "Ô SÀN", "Đặt lại góc nhìn"]) expect(html).toContain(label);
    expect(html).toContain(`class="construction-editor ${mode}"`);
    for (const label of ["ARCHITECT STUDIO", "Your home. Your rules.", "Curate your space.", "Build your next chapter.", "CONSTRUCTION KIT", "FURNITURE CATALOG", "MY ARCHITECTURE", "CLICK TO MOVE", "DRAG TO BUILD", "WALLS", "TILES"]) expect(html).not.toContain(label);
    if (mode !== "live") {
      expect(html).toContain("ĐÃ LƯU MỌI THAY ĐỔI");
      expect(html).toContain("CHI PHÍ DỰ KIẾN");
      expect(html).toContain("R XOAY · CTRL+Z HOÀN TÁC · ESC HỦY");
    }
  });

  it("shares complete material and frame labels between options and selected-curve summaries", () => {
    const materials = { clear: "Trong suốt", blue: "Xanh dương", violet: "Tím", frosted: "Kính mờ", smoke: "Khói" };
    const frames = { aluminium: "Nhôm", graphite: "Than chì", brass: "Đồng thau" };
    expect(Object.keys(materials)).toEqual([...CURVE_MATERIALS]);
    expect(Object.keys(frames)).toEqual([...CURVE_FRAMES]);
    for (const [key, value] of [...Object.entries(materials), ...Object.entries(frames)]) expect(source).toContain(`${key}:"${value}"`);
    expect(source).toContain('value={value}>{curveMaterialLabels[value]}');
    expect(source).toContain('value={value}>{curveFrameLabels[value]}');
    expect(source).toContain('{curveMaterialLabels[selectedCurve.material]} / {curveFrameLabels[selectedCurve.frame]}');
    expect(source).not.toContain('{selectedCurve.material} / {selectedCurve.frame}');
  });

  it("localizes draft, confirmation, and error copy", () => {
    for (const label of ["BẢN NHÁP CHƯA LƯU", "LƯU THIẾT KẾ CỦA BẠN", "Máy chủ kiểm tra", "G · Cấp {m.level}", " · Bản thiết kế", "Chọn nội thất trong danh mục trước.", "chế độ sinh hoạt.", "Công trình đã thay đổi ở thẻ khác."]) expect(source).toContain(label);
    for (const label of ["UNSAVED DRAFT", "ALL CHANGES SAVED", "COMMIT YOUR VISION", "ESTIMATED COST", "Live Mode", " · Blueprint", "Server kiểm tra", "trong catalog"]) expect(source).not.toContain(label);
  });

  it("preserves machine values, command payloads, and existing Vietnamese input selectors", () => {
    for (const fragment of [
      '["live","Sinh hoạt",Home],["build","Xây dựng",Hammer],["buy","Mua sắm",ShoppingBag]',
      'value={selectedCurve.material}', 'editCurveChoice("material",event.target.value)',
      'value={selectedCurve.frame}', 'editCurveChoice("frame",event.target.value)',
      'type:"construction.commit",expectedRevision:base.revision,plan:history.present',
      'type:"furniture.buy",furnitureId:id', 'onGesture={gesture} onSelect={select}',
      'cameraReset={cameraReset} cutaway={cutaway} showCeiling={ceiling}',
      'aria-label="Chọn tầng"', 'aria-label="Vật liệu kính cong"', 'aria-label="Khung kính cong"',
      'aria-label="Hoàn tác bản nháp"', 'aria-label="Làm lại bản nháp"',
    ]) expect(source).toContain(fragment);
  });
});

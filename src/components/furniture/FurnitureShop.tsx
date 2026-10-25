"use client";

import dynamic from "next/dynamic";
import { Check, Coins, DoorOpen, Grid2X2, LockKeyhole, RotateCcw, Search, ShoppingBag, Sparkles } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { Action, GameState } from "@/domain/types";
import { FURNITURE_TEST_MODE } from "@/domain/catalog";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, isFurnitureModelId, type FurnitureCategory, type FurnitureDefinition, type FurnitureModelId } from "@/furniture/catalog";
import { getFurnitureProjection } from "./furniture-projection";
import "./furniture-shop.css";

const FurniturePreview = dynamic(() => import("@/components/world/FurniturePreview"), { ssr: false, loading: () => <div className="furniture-preview-loading" role="status">Đang dựng mô hình…</div> });

type FurnitureShopProps = { state: GameState; act: (action: Action) => void; busy?: boolean; onPlace: (id: string, neonColor: string) => void; initialFurnitureId?: string };
type CategoryFilter = "all" | "inventory" | FurnitureCategory;

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "Tất cả", inventory: "📥 Kho đồ sở hữu", bed: "Giường", seating: "Sofa", desk: "Bàn làm việc", chair: "Ghế", storage: "Lưu trữ", electronics: "Thiết bị", light: "Đèn", kitchen: "Bếp", decor: "Trang trí", workshop: "Xưởng", collectible: "Sưu tầm", doors: "Cửa", windows: "Cửa sổ",
};
const CATEGORY_ICONS: Record<CategoryFilter, string> = { all: "01", inventory: "02", bed: "03", seating: "04", desk: "05", chair: "06", storage: "07", electronics: "08", light: "09", kitchen: "10", decor: "11", workshop: "12", collectible: "13", doors: "14", windows: "15" };
const normalize = (value: string) => value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

const FurnitureProjection = memo(function FurnitureProjection({ item }: { item: FurnitureDefinition }) {
  const projection = useMemo(() => getFurnitureProjection(item), [item]);
  if (item.placementType === "wall_insert" && !projection.faces.length) return <span className="furniture-projection" style={{ display: "grid", placeItems: "center", color: item.color }}><DoorOpen size={55} strokeWidth={1.3} /></span>;
  return <svg className="furniture-projection" viewBox="0 0 100 92" aria-hidden="true" focusable="false">
    <ellipse cx="50" cy="83" rx="32" ry="5" fill="#06101b" opacity=".52" />
    {projection.faces.map(face => <path key={face.key} d={face.path} fill={face.fill} fillOpacity={face.opacity} fillRule="evenodd" />)}
  </svg>;
});

function ItemCard({ item, owned, available, inventoryMode, level, gold, busy, neonColor, onNeonColor, onBuy, onPlace, onSelect, selected }: { item: FurnitureDefinition; owned: number; available: number; inventoryMode: boolean; level: number; gold: number; busy: boolean; neonColor: string; onNeonColor: (color: string) => void; onBuy: () => void; onPlace: () => void; onSelect: () => void; selected: boolean }) {
  const locked = level < item.level;
  const unaffordable = !FURNITURE_TEST_MODE && gold < item.price;
  const canPlace = available > 0;
  return <article className={`furniture-item-card ${selected ? "is-selected" : ""}`}>
    <button type="button" className="furniture-card-preview" aria-label={`Xem trước ${item.name}`} aria-pressed={selected} onClick={onSelect}>
      <span className="furniture-card-index">{CATEGORY_LABELS[item.category].toLocaleUpperCase("vi-VN")}</span>
      <span className="furniture-card-art"><FurnitureProjection item={item} /></span>
      <span className="furniture-card-name">{item.name}</span>
      <span className="furniture-card-state">{canPlace ? `${owned} sở hữu · ${available} trong kho` : locked ? `Mở ở cấp ${item.level}` : `${item.price.toLocaleString("vi-VN")} vàng`}</span>
      {selected && <span className="furniture-selection-tag">Đang xem</span>}
      {canPlace && <span className="furniture-owned-mark"><Check size={13} aria-hidden="true" /></span>}
    </button>
    <div className="furniture-card-footer">
      <span className="furniture-card-price">{inventoryMode ? 0 : item.price.toLocaleString("vi-VN")} <small>VÀNG</small></span>
      <label className="furniture-neon-picker" title="Màu đèn neon"><span>LED</span><input type="color" aria-label={`Màu neon cho ${item.name}`} value={neonColor} onChange={event => onNeonColor(event.target.value)} /></label>
      {!inventoryMode && <button type="button" className="furniture-buy-button" aria-label={`Mua ${item.name}`} disabled={busy || locked || unaffordable} onClick={onBuy}>{locked ? <><LockKeyhole size={13} aria-hidden="true" /> Cấp {item.level}</> : unaffordable ? "Thiếu vàng" : <><ShoppingBag size={13} aria-hidden="true" /> {FURNITURE_TEST_MODE ? "Mua miễn phí" : "Mua"}</>}</button>}
      {canPlace && <button type="button" className="furniture-place-button" disabled={busy} onClick={onPlace}>Đặt vào nhà</button>}
    </div>
  </article>;
}

export default function FurnitureShop({ state, act, busy = false, onPlace, initialFurnitureId }: FurnitureShopProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<FurnitureModelId>(() => initialFurnitureId && isFurnitureModelId(initialFurnitureId) ? initialFurnitureId : FURNITURE_CATALOG[0]?.id ?? "cloud-bed");
  const [neonColors, setNeonColors] = useState<Record<string, string>>({});
  const [resetKey, setResetKey] = useState(0);
  const level = Math.floor(Math.sqrt(Math.max(0, state.character.xp) / 100)) + 1;
  const selected = FURNITURE_CATALOG.find(item => item.id === selectedId) ?? FURNITURE_CATALOG[0];
  const placedCounts = useMemo(() => {
    const counts = state.placements.reduce<Record<string, number>>((result, placement) => { result[placement.furnitureId] = (result[placement.furnitureId] ?? 0) + 1; return result; }, {});
    for (const placement of state.building?.plan.furniture ?? []) counts[placement.furnitureId] = (counts[placement.furnitureId] ?? 0) + 1;
    return counts;
  }, [state.placements, state.building?.plan.furniture]);
  const filtered = useMemo(() => FURNITURE_CATALOG.filter(item => {
    const textMatch = normalize(`${item.id} ${item.name} ${item.description} ${CATEGORY_LABELS[item.category]}`).includes(normalize(search.trim()));
    const unplaced = Math.max(0, (state.ownedFurniture[item.id] ?? 0) - (placedCounts[item.id] ?? 0));
    return textMatch && (category === "inventory" ? unplaced > 0 : category === "all" || item.category === category) && (!ownedOnly || unplaced > 0);
  }), [category, ownedOnly, search, state.ownedFurniture, placedCounts]);
  const neonColorFor = (item: FurnitureDefinition) => neonColors[item.id] ?? state.furnitureNeonColors?.[item.id] ?? item.neonColor;
  const setNeonColor = (item: FurnitureDefinition, color: string) => setNeonColors(current => ({ ...current, [item.id]: color }));
  const buy = (item: FurnitureDefinition) => { if (!busy && level >= item.level && (FURNITURE_TEST_MODE || state.gold >= item.price)) act({ type: "furniture.buy", furnitureId: item.id, neonColor: neonColorFor(item) }); };
  const place = (id: string) => { const item = FURNITURE_CATALOG.find(value => value.id === id); const available = item ? Math.max(0, (state.ownedFurniture[id] ?? 0) - (placedCounts[id] ?? 0)) : 0; if (!busy && item && available > 0) onPlace(id, neonColorFor(item)); };
  const selectedAvailable = selected ? Math.max(0, (state.ownedFurniture[selected.id] ?? 0) - (placedCounts[selected.id] ?? 0)) : 0;
  return <section className="furniture-shop" aria-label="Cửa hàng nội thất">
    <header className="furniture-shop-heading"><div><span className="furniture-kicker">NỘI THẤT / KHÔNG GIAN SỐNG</span><h2>Chọn món làm nên căn nhà.</h2><p>{FURNITURE_TEST_MODE ? "CHẾ ĐỘ TEST · Mua nội thất miễn phí, không trừ Gold." : "Xem trước tự do. Chỉ dùng vàng khi bạn chọn mua."}</p></div><div className="furniture-shop-wallet" aria-label={FURNITURE_TEST_MODE ? "Chế độ test, mua miễn phí" : `${state.gold.toLocaleString("vi-VN")} vàng`}><Coins size={17} aria-hidden="true" />{FURNITURE_TEST_MODE ? "∞" : state.gold.toLocaleString("vi-VN")} <small>{FURNITURE_TEST_MODE ? "TEST GOLD" : "VÀNG"}</small></div></header>
    <div className="furniture-shop-layout">
      <aside className="furniture-shop-nav" aria-label="Danh mục nội thất"><div className="furniture-shop-nav-title"><Grid2X2 size={15} aria-hidden="true" />DANH MỤC</div><div className="furniture-category-list" role="tablist" aria-label="Danh mục nội thất">{(["all", "inventory", ...FURNITURE_CATEGORIES] as CategoryFilter[]).map(id => <button type="button" role="tab" id={`furniture-category-${id}`} aria-controls="furniture-category-panel" key={id} aria-selected={category === id} onClick={() => setCategory(id)}><span>{CATEGORY_ICONS[id]}</span>{CATEGORY_LABELS[id]}<b>{id === "all" ? FURNITURE_CATALOG.length : id === "inventory" ? FURNITURE_CATALOG.reduce((sum, item) => sum + Math.max(0, (state.ownedFurniture[item.id] ?? 0) - (placedCounts[item.id] ?? 0)), 0) : FURNITURE_CATALOG.filter(item => item.category === id).length}</b></button>)}</div><div className="furniture-shop-nav-note"><Sparkles size={17} aria-hidden="true" /><p>Mỗi món dùng đúng công thức hình học trong thế giới của bạn.</p></div></aside>
      <div className="furniture-selected-column"><div className="furniture-showcase"><div className="furniture-showcase-top"><span><i />MÔ HÌNH THỰC TẾ</span><button type="button" onClick={() => setResetKey(value => value + 1)} aria-label="Đặt lại góc nhìn"><RotateCcw size={14} aria-hidden="true" />Đặt lại</button></div><div className="furniture-showcase-grid" /><FurniturePreview kind={selected.id} resetKey={resetKey} neonColor={neonColorFor(selected)} /><div className="furniture-showcase-caption"><span>CẤP {level} · XEM TRƯỚC 3D</span><strong>{selected.name}</strong><small>Kéo để xoay · Cuộn để phóng to · Chỉ là bản xem trước</small></div></div>
        <aside className="furniture-selected-details" aria-label={`Thông tin ${selected.name}`}>
          <div><span className="furniture-kicker">THÔNG TIN MÓN ĐANG CHỌN</span><h3>{selected.name}</h3><p>{selected.description}</p></div>
          <dl><div><dt>Rộng × sâu × cao</dt><dd>{[selected.width, selected.depth, selected.height].map(value => value.toLocaleString("vi-VN")).join(" × ")} m</dd></div><div><dt>Yêu cầu</dt><dd>Cấp {selected.level}</dd></div><div><dt>Tương tác sau khi đặt</dt><dd>{selected.interactions.map(interaction => interaction.label).join(" · ") || "Trang trí"}</dd></div></dl>
          <small className="furniture-metadata-note">Thông tin tính năng; bản xem trước không kích hoạt tương tác.</small>
          <div className="furniture-selected-actions"><span>Đã sở hữu: {(state.ownedFurniture[selected.id] ?? 0).toLocaleString("vi-VN")} món · Kho chưa đặt: {selectedAvailable} · {category === "inventory" ? "0 G" : FURNITURE_TEST_MODE ? "miễn phí trong chế độ test" : `${selected.price.toLocaleString("vi-VN")} vàng`}</span><label className="furniture-neon-picker furniture-neon-picker-large"><span>MÀU LED</span><input type="color" aria-label={`Màu neon cho ${selected.name}`} value={neonColorFor(selected)} onChange={event => setNeonColor(selected, event.target.value)} /></label>{category !== "inventory" && <button type="button" disabled={busy || level < selected.level || (!FURNITURE_TEST_MODE && state.gold < selected.price)} onClick={() => buy(selected)}>{busy ? "Đang xử lý…" : level < selected.level ? `Mở ở cấp ${selected.level}` : FURNITURE_TEST_MODE ? `Mua miễn phí · ${selected.name}` : state.gold < selected.price ? `Còn thiếu ${(selected.price - state.gold).toLocaleString("vi-VN")} vàng` : `Mua ${(state.ownedFurniture[selected.id] ?? 0) > 0 ? "thêm" : "món này"} · ${selected.price.toLocaleString("vi-VN")} vàng`}</button>}{selectedAvailable > 0 && <button type="button" className="furniture-secondary-action" disabled={busy} onClick={() => place(selected.id)}>Đặt món này vào nhà</button>}</div>
        </aside>
      </div>
      <div className="furniture-shop-content" id="furniture-category-panel" role="tabpanel" aria-labelledby={`furniture-category-${category}`}><div className="furniture-collection-heading"><div><span className="furniture-kicker">BỘ SƯU TẬP NỘI THẤT</span><h3>{CATEGORY_LABELS[category]}</h3></div><span className="furniture-collection-level">CẤP {level}</span></div><div className="furniture-toolbar"><label className="furniture-search"><Search size={15} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm nội thất…" aria-label="Tìm nội thất" /></label><label className="furniture-owned-toggle"><input type="checkbox" checked={ownedOnly} onChange={event => setOwnedOnly(event.target.checked)} /> <span>Chỉ đã sở hữu</span></label><span className="furniture-result-count">{filtered.length} món</span></div><div className="furniture-item-grid">{filtered.map(item => { const owned = state.ownedFurniture[item.id] ?? 0; const available = Math.max(0, owned - (placedCounts[item.id] ?? 0)); return <ItemCard key={item.id} item={item} owned={owned} available={available} inventoryMode={category === "inventory"} level={level} gold={state.gold} busy={busy} neonColor={neonColorFor(item)} onNeonColor={color => setNeonColor(item, color)} selected={selected.id === item.id} onSelect={() => setSelectedId(item.id)} onBuy={() => buy(item)} onPlace={() => place(item.id)} />; })}</div>{filtered.length === 0 && <div className="furniture-empty"><ShoppingBag size={24} aria-hidden="true" /><strong>{category === "inventory" ? "Kho đồ đang trống" : "Chưa có món phù hợp"}</strong><span>{category === "inventory" ? "Mua nội thất rồi chọn Đặt vào nhà để đưa món đồ vào căn hộ." : "Thử từ khóa khác hoặc bỏ bộ lọc sở hữu."}</span></div>}</div>
    </div>
  </section>;
}

export type { FurnitureShopProps };

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell,  CalendarDays, ChevronRight, CircleDollarSign, Gift, Heart, Home, Plus, Search, Sparkles, Sword, Target, UserRound, Wallet, Zap } from "lucide-react";
import { FURNITURE, REWARDS, ITEMS } from "@/domain/catalog";
import type { BossDefinition, BossEncounter, GameState, Task } from "@/domain/types";
import { financeReport, type FinanceState } from "@/finance";
import { lobbyPlacedFurniture, lobbyPriorityTasks, lobbyRoomFurniture, lobbySearch, type LobbyRoom, type LobbySearchResult } from "./lobby-data";
import { getBuilding } from "@/construction/engine";
import { useApartmentPlan } from "@/components/construction/apartment-store";
import CharacterAvatar from "@/components/character/CharacterAvatar";
import { useCharacterIdentity } from "@/components/character/character-identity-store";
import { characterRenderProfile, type CharacterRenderProfile } from "@/components/character/character-render-profile";
import "./lobby.css";

const LiveCharacterCanvas = dynamic(() => import("./LiveCharacterCanvas"), { ssr: false, loading: () => <span className="vref-character-loading">Đang dựng nhân vật…</span> });
const NovaHologram = dynamic(() => import("../world/NovaHologram"), { ssr: false, loading: () => <span className="vref-character-loading">Đang khởi tạo NOVA…</span> });
const ConstructionWorld = dynamic(() => import("../construction/ConstructionWorld"), { ssr: false, loading: () => <span className="vref-apartment-loading">Đang dựng căn hộ đã lưu…</span> });

type Level = { level: number; current: number; next: number };
type Props = {
  state: GameState;
  level: Level;
  open: GameState["occurrences"];
  completedToday: number;
  tasks: Task[];
  boss?: BossEncounter;
  bossDef?: BossDefinition;
  onNavigate: (screen: string) => void;
  onOpenFurniture: (id: string) => void;
  onComplete: (task: Task) => void;
  onCreateTask: () => void;
  onNotifications: () => void;
  actionsDisabled: boolean;
};

const art = "/assets/lobby-reference/";
const number = (value: number) => value.toLocaleString("vi-VN");
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const featuredFurniture = ["stereo-tower", "haven-sofa", "cloud-bed"] as const;

function Meter({ value, max = 100, tone = "cyan" }: { value: number; max?: number; tone?: string }) {
  return <span className={`vref-meter ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, 100 * value / Math.max(1, max)))}%` }} /></span>;
}
function Panel({ className, children }: { className: string; children: ReactNode }) {
  return <section className={`vref-panel ${className}`}>{children}</section>;
}
function Heading({ icon: Icon, title, extra }: { icon: typeof Home; title: string; extra?: ReactNode }) {
  return <div className="vref-heading"><Icon size={24} strokeWidth={2.1} aria-hidden="true"/><h2>{title}</h2>{extra}</div>;
}

function LiveApartmentPreview({ state, render, room, onOpen }: { state: GameState; render: CharacterRenderProfile; room: LobbyRoom; onOpen: () => void }) {
  const building = useMemo(() => getBuilding(state), [state]);
  const apartmentPlan = useApartmentPlan(state.userId, building.revision, building.plan, true);
  const roomPlaced = lobbyPlacedFurniture(state, room);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("life-level:showcase-focus", { detail: { focus: "lobby" } })));
    return () => cancelAnimationFrame(frame);
  }, [ready]);
  return <div className="vref-apartment-live" aria-label="Xem nhanh căn hộ hiện tại từ dữ liệu đã lưu">
    <ConstructionWorld
      plan={apartmentPlan ?? building.plan}
      plot={building.plot}
      mode="live"
      tool="select"
      floorLevel={0}
      cutaway={false}
      showReferencePenthouse
      cameraMode="free"
      character={render.character}
      cosmetics={render.cosmetics}
      equipment={render.equipment}
      weaponId={render.weaponId}
      quality={state.settings.graphics}
      residenceFloor={state.residence?.floor === 16 || state.residence?.floor === 24 ? state.residence.floor : 8}
      onGesture={() => {}}
      onSelect={() => {}}
      onInteract={onOpen}
      onFps={() => {}}
      onNotice={() => {}}
      onReady={() => setReady(true)}
    />
    <div className="vref-live-sky"><span>LIVE · ĐỒNG BỘ SAVE</span><small>{building.plan.furniture.length} nội thất đã đặt · {state.character.name} đang ở căn hộ</small></div>
    <div className="vref-live-caption"><b>{room}</b><span>{roomPlaced.length ? `${roomPlaced.length} món trong khu vực này` : "Chưa có nội thất trong khu vực này"}</span><button onClick={onOpen}>Mở cảnh 3D thật <ArrowRight size={14}/></button></div>
  </div>;
}

export default function LobbyDashboard({ state, level, open, completedToday, tasks, boss, bossDef, onNavigate, onOpenFurniture, onComplete, onCreateTask, onNotifications, actionsDisabled }: Props) {
  const identity = useCharacterIdentity((store) => store.identity);
  const activeIdentity = identity?.ownerId === state.userId && identity.revision >= state.revision ? identity : null;
  const fallbackRender = useMemo(() => characterRenderProfile(state), [state]);
  const renderProfile = activeIdentity?.render ?? fallbackRender;
  const [search, setSearch] = useState("");
  const [room, setRoom] = useState<LobbyRoom>("Phòng khách");
  const [rewardTab, setRewardTab] = useState<"all" | "item" | "life">("all");
  const today = dateKey();
  const activeTasks = lobbyPriorityTasks(tasks, open);
  const todayTotal = completedToday + open.length;
  const bossTasks = tasks.filter(task => !task.archived && task.bossId === boss?.id && open.some(item => item.taskId === task.id)).slice(0, 3);
  const equipmentNames = Object.values(state.equipment).map(id => ITEMS.find(item => item.id === state.inventory.find(instance => instance.id === id)?.definitionId)?.name).filter(Boolean).slice(0, 3);
  const actualRewards = state.realLifeRewards?.filter(item => !item.archived).slice(0, 2) ?? [];
  const furniture = featuredFurniture.map(id => FURNITURE.find(item => item.id === id)!);
  const promotions: { name: string; detail: string; image: string; screen: string; category: "item" | "life"; furnitureId?: string }[] = [
    { name: furniture[0].name, detail: `${number(furniture[0].price)} G · Nội thất`, image: "reward-headphones.jpg", screen: "furniture", category: "item", furnitureId: furniture[0].id },
    { name: "Ngoại hình nhân vật", detail: state.character.name, image: "reward-outfit.jpg", screen: "character", category: "item" },
    { name: furniture[1].name, detail: `${number(furniture[1].price)} G · Nội thất`, image: "reward-room.jpg", screen: "furniture", category: "item", furnitureId: furniture[1].id },
    { name: actualRewards[0]?.name ?? "Tạo phần thưởng cá nhân", detail: actualRewards[0] ? `${number(actualRewards[0].cost)} G` : "Chưa thiết lập", image: "reward-resort.jpg", screen: "rewards", category: "life" },
    { name: furniture[2].name, detail: `${number(furniture[2].price)} G · Nội thất`, image: "reward-bed.jpg", screen: "furniture", category: "item", furnitureId: furniture[2].id },
    { name: actualRewards[1]?.name ?? "Tự thưởng một điều nhỏ", detail: actualRewards[1] ? `${number(actualRewards[1].cost)} G` : "Thiết lập trong Phần thưởng", image: "reward-coffee.jpg", screen: "rewards", category: "life" },
  ];
  const rewardCards = promotions.filter(item => rewardTab === "all" || item.category === rewardTab);
  const roomFurniture = lobbyRoomFurniture(state, room);
  const butlerSummary = open.length ? `Bạn có ${open.length} nhiệm vụ đang mở. ${activeTasks[0] ? `Ưu tiên: ${activeTasks[0].title}.` : "Mở kế hoạch để chọn việc ưu tiên."}` : "Hôm nay chưa có nhiệm vụ đang mở. Thêm một việc nhỏ để bắt đầu nhé!";
  const month = today.slice(0, 7);
  const financeQuery = useQuery<FinanceState>({ queryKey: ["lobby-finance", state.userId], queryFn: async ({ signal }) => {
    const response = await fetch("/api/finance", { cache: "no-store", signal });
    if (!response.ok) throw new Error("Không thể tải sổ tài chính.");
    return response.json() as Promise<FinanceState>;
  }, staleTime: 0, refetchOnWindowFocus: "always", retry: false });
  const finance = financeQuery.data;
  const report = useMemo(() => finance ? financeReport(finance, month) : null, [finance, month]);
  const monthRows = finance?.transactions.filter(row => row.date.startsWith(month) && ["income", "expense"].includes(row.kind)) ?? [];
  const dayTotals = Array.from({ length: 12 }, (_, index) => {
    const from = index * 3 + 1;
    return monthRows.filter(row => Number(row.date.slice(-2)) >= from && Number(row.date.slice(-2)) < from + 3).reduce((sum, row) => sum + (row.kind === "income" ? row.amount : -row.amount), 0);
  });
  const maxDayTotal = Math.max(1, ...dayTotals.map(Math.abs));
  const results = lobbySearch(state, search);
  const openResult = (result: LobbySearchResult) => {
    if (result.id.startsWith("furniture:")) onOpenFurniture(result.id.slice("furniture:".length));
    else onNavigate(result.screen);
    setSearch("");
  };

  return <div className="vref-lobby">
    <header className="vref-header">
      <div className="vref-logo">LIFE<span>{"//"}</span>LEVEL<small>v1.2.0</small></div>
      <div className="vref-date"><CalendarDays size={22}/>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}</div>
      <div className="vref-quote">“Cuộc sống tốt hơn không đến từ may mắn,<br/>mà từ những hành động nhỏ mỗi ngày.”</div>
      <div className="vref-header-right"><div className="vref-search-wrap"><Search size={20}/><input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && results[0]) { openResult(results[0]); } }} placeholder="Tìm nhiệm vụ, ghi chú, vật phẩm..." aria-label="Tìm trong sảnh chờ"/>{search && <button onClick={() => setSearch("")} aria-label="Xóa tìm kiếm">×</button>}{results.length > 0 && <div className="vref-search-results">{results.map(result => <button key={result.id} onClick={() => openResult(result)}><Search size={15}/><span>{result.label}<small>{result.detail}</small></span></button>)}</div>}</div><button className="vref-header-bell" onClick={onNotifications} aria-label="Thông báo"><Bell size={22}/><i/></button><button className="vref-header-profile" onClick={() => onNavigate("character")}><CharacterAvatar ownerId={state.userId} fallbackName={state.character.name}/><strong>{activeIdentity?.name??state.character.name}<small>Level {activeIdentity?.level??level.level}</small></strong><ChevronRight size={15}/></button></div>
    </header>

    <div className="vref-body">
      <main className="vref-board" aria-label="Sảnh chờ LIFE//LEVEL">
        <Panel className="vref-today"><div className="vref-today-top"><Heading icon={Sparkles} title="Hôm nay" extra={<button className="vref-chevron" onClick={() => onNavigate("calendar")} aria-label="Mở kế hoạch"><ChevronRight size={17}/></button>}/><span>{completedToday} / {todayTotal} nhiệm vụ hoàn thành</span><Meter value={completedToday} max={Math.max(1, todayTotal)} tone="pink"/></div><div className="vref-today-content"><div className="vref-hero-summary"><div className="vref-today-character" role="img" aria-label="Nhân vật hiện tại từ dữ liệu đã lưu"><LiveCharacterCanvas {...renderProfile.character} frontFacing cosmetics={renderProfile.cosmetics} equipment={renderProfile.equipment} weaponId={renderProfile.weaponId} referenceLook={renderProfile.referenceLook}/></div><div className="vref-vitals"><div><Heart size={20}/><span>Sức khỏe</span><strong>{state.character.hp} / 100</strong><Meter value={state.character.hp} tone="pink"/></div><div><Zap size={20}/><span>Năng lượng</span><strong>{state.character.energy} / 100</strong><Meter value={state.character.energy} tone="blue"/></div><div><Sparkles size={20}/><span>Tâm trạng</span><strong>{state.character.mood} / 100</strong><Meter value={state.character.mood} tone="green"/></div><button className="vref-gold" onClick={() => onNavigate("shop")}><CircleDollarSign size={28}/><span>Vòng game<strong>{number(state.gold)}</strong></span><Plus size={19}/></button></div><div className="vref-level"><strong>Level {level.level}</strong><Meter value={level.current} max={level.next} tone="blue"/><span>{number(level.current)} / {number(level.next)} XP</span></div></div><div className="vref-tasks"><h3><Target size={18}/>{activeTasks.length ? `${activeTasks.length} việc ưu tiên hôm nay` : "Việc ưu tiên hôm nay"}</h3>{activeTasks.map(task => <button key={task.id} className="vref-task" disabled={actionsDisabled} onClick={() => onComplete(task)}><span className="vref-task-check"/><span><strong>{task.title}</strong><small>+{REWARDS[task.difficulty].xp} XP · +{REWARDS[task.difficulty].gold} G</small></span><ChevronRight size={17}/></button>)}{!activeTasks.length && <div className="vref-task-empty"><p>Chưa có nhiệm vụ đang mở.</p><button onClick={onCreateTask}><Plus size={15}/>Tạo nhiệm vụ đầu tiên</button></div>}<button className="vref-small-link" onClick={() => onNavigate("quests")}>Xem tất cả nhiệm vụ <ArrowRight size={14}/></button></div></div></Panel>

        <Panel className="vref-boss"><Heading icon={Sword} title="Boss chiến dịch"/><div className="vref-boss-main"><div className="vref-boss-art" role="img" aria-label="Minh họa boss theo ảnh tham chiếu"/><div className="vref-boss-stats"><strong>{bossDef?.name ?? "Chưa chọn boss"}</strong>{bossDef && <span>Lv. {bossDef.level}</span>}<Meter value={boss?.hp ?? 0} max={bossDef?.maxHp || 1} tone="pink"/><small>{boss && bossDef ? `${number(boss.hp)} / ${number(bossDef.maxHp)} HP` : "Mở đấu trường để bắt đầu"}</small><p>{boss?.defeatedAt ? "Đã đánh bại thử thách này." : "Kẻ thù lớn nhất không ở bên ngoài, mà là chính sự trì hoãn trong ta."}</p><div className="vref-boss-checklist"><b>Nhiệm vụ liên kết ({bossTasks.length})</b>{bossTasks.map(task => <span key={task.id}><i/> {task.title}</span>)}{!bossTasks.length && <span>Chưa có nhiệm vụ liên kết.</span>}</div></div></div><button className="vref-action" onClick={() => onNavigate("arena")}>Xem chi tiết chiến dịch <ArrowRight size={16}/></button></Panel>

        <Panel className="vref-butler"><Heading icon={Sparkles} title="AI Quản gia" extra={<span className="vref-panel-signal"><i/>LIVE</span>}/><div className="vref-butler-art" role="img" aria-label="NOVA hologram 3D"><NovaHologram/><span className="vref-cyber-corner tl"/><span className="vref-cyber-corner br"/><span className="vref-butler-chip">NOVA · NEURAL CORE</span><span className="vref-scanlines"/></div><p className="vref-butler-message">{butlerSummary}</p><div className="vref-butler-list"><button onClick={() => onNavigate("quests")}>Bạn còn {open.length} nhiệm vụ đang mở <ChevronRight size={15}/></button><button onClick={() => onNavigate("calendar")}>Xem kế hoạch trong ngày <ChevronRight size={15}/></button><button onClick={() => onNavigate("character")}>Năng lượng hiện tại: {state.character.energy}/100 <ChevronRight size={15}/></button><button onClick={() => onNavigate("butler")}>Hỏi NOVA để có gợi ý riêng <ChevronRight size={15}/></button></div></Panel>

        <Panel className="vref-apartment"><LiveApartmentPreview state={state} render={renderProfile} room={room} onOpen={() => onNavigate("home")}/><div className="vref-apartment-header"><Heading icon={Home} title="Căn hộ của tôi" extra={<span className="vref-level-tag">{state.residence ? `District 07 · Tầng ${state.residence.floor}` : "Chưa nhận căn hộ"}</span>}/><p>Không gian phản ánh con người bạn.<br/>Dữ liệu hiển thị trực tiếp từ căn hộ đã lưu.</p><div className="vref-room-tabs">{(["Phòng khách", "Phòng ngủ", "Góc làm việc", "Nhà bếp"] as LobbyRoom[]).map(label => <button key={label} className={room === label ? "active" : ""} onClick={() => setRoom(label)}>{label}</button>)}</div><div className="vref-room-status">{roomFurniture.length ? `${roomFurniture.length} nội thất liên quan đã đặt · ${roomFurniture.slice(0, 2).join(", ")}` : "Chưa đặt nội thất thuộc khu vực này"}</div></div><div className="vref-apartment-actions"><span>Live preview từ save hiện tại</span><button onClick={() => onNavigate("home")}>Vào căn hộ 3D <ArrowRight size={15}/></button></div><div className="vref-featured"><h3>Khám phá thêm</h3>{["Nội thất", "Xây dựng", "Thế giới 3D"].map((label, index) => <button key={label} onClick={() => onNavigate(["furniture", "build", "home"][index])}><span>{["◆", "✦", "◈"][index]}</span>{label}<ChevronRight size={13}/></button>)}</div></Panel>

        <div className="vref-mid-bottom"><Panel className="vref-character"><Heading icon={UserRound} title="Nhân vật" extra={<><span className="vref-panel-signal"><i/>SAVE SYNC</span><button className="vref-small-link" onClick={() => onNavigate("character")}>Xem chi tiết <ArrowRight size={14}/></button></>}/><div className="vref-character-body"><div className="vref-character-art" role="img" aria-label="Nhân vật 3D hiện tại từ dữ liệu đã lưu"><LiveCharacterCanvas {...renderProfile.character} frontFacing cosmetics={renderProfile.cosmetics} equipment={renderProfile.equipment} weaponId={renderProfile.weaponId} referenceLook={renderProfile.referenceLook}/><span className="vref-cyber-corner tl"/><span className="vref-cyber-corner br"/><span className="vref-character-live-badge"><strong>LIVE</strong><small>{state.character.name} · SAVE</small></span><span className="vref-scanlines"/></div><div className="vref-character-data"><strong>{state.character.name}</strong><small>Level {level.level} · {state.character.title}</small><Meter value={level.current} max={level.next} tone="blue"/><span>{number(level.current)} / {number(level.next)} XP</span><div className="vref-character-stats"><span>♥ Sức khỏe <b>{state.character.hp}</b></span><span>ϟ Năng lượng <b>{state.character.energy}</b></span><span>✦ Tâm trạng <b>{state.character.mood}</b></span></div></div><div className="vref-character-gear"><small>Trang bị đang dùng</small>{equipmentNames.length ? equipmentNames.map(name => <span key={name}>{name}</span>) : <span>Chưa trang bị</span>}<button onClick={() => onNavigate("equipment")}>Thay đổi trang bị</button></div></div></Panel><Panel className="vref-finance"><Heading icon={Wallet} title="Tài chính (Tiền thật)" extra={<button className="vref-small-link" onClick={() => onNavigate("finance")}>Chi tiết <ArrowRight size={14}/></button>}/>{report ? <><div className="vref-finance-numbers"><div><small>Tổng số dư</small><strong>{money(report.balance)}</strong></div><div><small>Thu nhập tháng</small><strong>{money(report.income)}</strong></div><div><small>Chi tiêu tháng</small><strong>{money(report.expense)}</strong></div></div><div className="vref-finance-chart" aria-label="Biểu đồ dòng tiền tháng"><div>{dayTotals.map((value, index) => <i key={index} className={value < 0 ? "negative" : ""} style={{ height: `${Math.max(4, Math.abs(value) / maxDayTotal * 100)}%` }}/>)}</div><span>{monthRows.length ? `${monthRows.length} giao dịch trong tháng` : "Chưa có giao dịch trong tháng"}</span></div></> : <div className="vref-finance-empty">{financeQuery.isError ? "Chưa thể tải sổ tài chính." : "Đang tải sổ tài chính..."}<button onClick={() => onNavigate("finance")}>Mở tài chính <ArrowRight size={14}/></button></div>}</Panel></div>

        <Panel className="vref-rewards"><Heading icon={Gift} title="Phần thưởng" extra={<span className="vref-reward-gold"><CircleDollarSign size={16}/>{number(state.gold)}</span>}/><div className="vref-reward-tabs"><button className={rewardTab === "all" ? "active" : ""} onClick={() => setRewardTab("all")}>Tất cả</button><button className={rewardTab === "item" ? "active" : ""} onClick={() => setRewardTab("item")}>Vật phẩm</button><button className={rewardTab === "life" ? "active" : ""} onClick={() => setRewardTab("life")}>Đời sống</button></div><div className="vref-reward-grid">{rewardCards.map(card => <button key={card.name} onClick={() => card.furnitureId ? onOpenFurniture(card.furnitureId) : onNavigate(card.screen)}><Image src={`${art}${card.image}`} alt="" fill sizes="(max-width: 1450px) 150px, 190px"/><span><strong>{card.name}</strong><small>{card.detail}</small><ChevronRight size={15}/></span></button>)}</div></Panel>
      </main>
    </div>
  </div>;
}

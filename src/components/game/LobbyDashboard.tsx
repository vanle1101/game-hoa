"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Bell, Brain, CalendarDays, Check, ChevronDown, ChevronRight, CircleDollarSign, Footprints, Gift, Headphones, Heart, Home, Laptop, Plus, Search, Shirt, Sparkles, Sun, Sword, Target, UserRound, Zap } from "lucide-react";
import { ACHIEVEMENTS, ITEMS, REWARDS } from "@/domain/catalog";
import { COSMETICS } from "@/character/catalog";
import type { BossDefinition, BossEncounter, GameState, Task } from "@/domain/types";
import CharacterAvatar from "@/components/character/CharacterAvatar";
import { useCharacterIdentity } from "@/components/character/character-identity-store";
import { characterRenderProfile, usesReferenceCharacterLook } from "@/components/character/character-render-profile";
import { lobbyPriorityTasks, lobbySearch, type LobbySearchResult } from "./lobby-data";
import LobbyAchievementsWidget from "./LobbyAchievementsWidget";
import LobbyRewardsWidget from "./LobbyRewardsWidget";
import LobbySkillTreeWidget from "./LobbySkillTreeWidget";
import MechVectorFrame, { AnimatedLedBorder } from "./MechVectorFrame";
import CyberTechButton from "./CyberTechButton";
import "./lobby.css";
import "./lobby-visual.css";
import "./lobby-components.css";
import "./lobby-content-glass.css";
import "./cyber-mech-frame.css";
import "./mech-vector-frame.css";

const LiveCharacterCanvas = dynamic(() => import("./LiveCharacterCanvas"), { ssr: false, loading: () => <span className="vref-character-loading">Đang dựng nhân vật…</span> });

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
  onRedeem: (id: string) => void;
  onComplete: (task: Task) => void;
  onCreateTask: () => void;
  onNotifications: () => void;
  actionsDisabled: boolean;
};

const number = (value: number) => value.toLocaleString("vi-VN");
function Meter({ value, max = 100, tone = "cyan" }: { value: number; max?: number; tone?: string }) {
  const percent = Math.max(0, Math.min(100, value / Math.max(1, max) * 100));
  return <span className={`vref-meter h-2.5 rounded-full ${tone}`}><i className="block h-full rounded-full" style={{ width: `${percent}%` }} /></span>;
}
function Heading({ icon: Icon, title, onNavigate, extra }: { icon: typeof Home; title: string; onNavigate: () => void; extra?: ReactNode }) {
  return <div className="vref-heading"><h2><CyberTechButton preserveChildren className="vref-heading-link cursor-pointer origin-left transition-all hover:scale-105 hover:text-cyan-400" onClick={onNavigate}><Icon size={22} strokeWidth={2.1} aria-hidden="true"/>{title}</CyberTechButton></h2>{extra}</div>;
}

export default function LobbyDashboard({ state, level, open, completedToday, tasks, boss, bossDef, onNavigate, onOpenFurniture, onRedeem, onComplete, onCreateTask, onNotifications, actionsDisabled }: Props) {
  const identity = useCharacterIdentity(store => store.identity);
  const activeIdentity = identity?.ownerId === state.userId && identity.revision >= state.revision ? identity : null;
  const fallbackRender = useMemo(() => characterRenderProfile(state), [state]);
  const renderProfile = activeIdentity?.render ?? fallbackRender;
  const starterPortrait = usesReferenceCharacterLook(renderProfile.character, renderProfile.cosmetics);
  const [search, setSearch] = useState("");
  const [characterTab, setCharacterTab] = useState<"stats" | "equipment">("stats");
  const activeTasks = lobbyPriorityTasks(tasks, open);
  const todayTotal = completedToday + open.length;
  const bossTasks = tasks.filter(task => !task.archived && task.bossId === boss?.id && open.some(item => item.taskId === task.id)).slice(0, 3);
  const bossHpPercent = Math.max(0, Math.min(100, (boss?.hp ?? 0) / Math.max(1, bossDef?.maxHp ?? 1) * 100));
  const equipment = Object.entries(state.equipment).flatMap(([slot, instanceId]) => {
    const instance = state.inventory.find(item => item.id === instanceId);
    const definition = ITEMS.find(item => item.id === instance?.definitionId);
    return definition ? [{ slot, name: definition.name, rarity: definition.rarity }] : [];
  }).slice(0, 4);
  const cosmeticEquipment = (Object.entries(state.equippedCosmetics ?? {}) as [string, string][])
    .filter(([slot]) => ["top", "bottom", "shoes", "head", "outerwear"].includes(slot))
    .map(([slot, id]) => ({ slot, name: COSMETICS.find(item => item.id === id)?.name ?? id, rarity: "cosmetic" }));
  const displayedEquipment = [...equipment, ...cosmeticEquipment].slice(0, 4);
  const results = lobbySearch(state, search);
  const openResult = (result: LobbySearchResult) => {
    if (result.id.startsWith("furniture:")) onOpenFurniture(result.id.slice("furniture:".length));
    else onNavigate(result.screen);
    setSearch("");
  };
  const progress = todayTotal ? Math.round(completedToday / todayTotal * 100) : 0;
  const butlerSuggestions = [
    { text: activeTasks[0] ? `Ưu tiên hôm nay: ${activeTasks[0].title}` : "Tạo một nhiệm vụ nhỏ cho hôm nay", screen: "quests", icon: Target },
    { text: `Bạn đã hoàn thành ${progress}% kế hoạch hôm nay`, screen: "calendar", icon: CalendarDays },
    { text: state.character.energy < 35 ? `Năng lượng còn ${state.character.energy}/100 · nghỉ một chút nhé` : `Năng lượng ${state.character.energy}/100 · sẵn sàng tập trung`, screen: "character", icon: Zap },
    { text: "Hỏi NOVA để nhận gợi ý tiếp theo", screen: "butler", icon: Sparkles },
  ];
  const skillBars = [
    { label: "Sức khỏe", icon: Heart, value: state.character.hp, text: `${state.character.hp}`, tone: "pink" },
    { label: "Năng lượng", icon: Zap, value: state.character.energy, text: `${state.character.energy}`, tone: "blue" },
    { label: "Tập trung", icon: Target, value: state.character.mood, text: `${state.character.mood}`, tone: "cyan" },
    { label: "Kỹ năng", icon: Brain, value: Math.min(100, state.character.skillXp.knowledge / 10), text: `${state.character.skillXp.knowledge} XP`, tone: "purple" },
    { label: "Xã hội", icon: Heart, value: state.character.social, text: `${state.character.social}`, tone: "blue" },
    { label: "Sáng tạo", icon: Sparkles, value: Math.min(100, state.character.skillXp.creativity / 10), text: `${state.character.skillXp.creativity} XP`, tone: "pink" },
  ];
  const equipmentIcon = (slot: string) => slot === "shoes" ? Footprints : slot === "head" ? Headphones : ["top", "outerwear", "bottom"].includes(slot) ? Shirt : slot === "weapon" ? Sword : Laptop;

  return <div className="vref-lobby">
    <header className="vref-header">
      <AnimatedLedBorder className="vref-header-led" code="lobby-header" variant="chrome" size="compact" glowIntensity="soft" animationSpeed={12} animationEnabled={!state.settings.reducedMotion}/>
      <div className="vref-date"><CalendarDays size={20}/>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}</div>
      <div className="vref-quote">“Cuộc sống tốt hơn đến từ những hành động nhỏ mỗi ngày.”</div>
      <div className="vref-header-right">
        <div className="vref-search-wrap"><Search size={19}/><input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.code === "Enter" && results[0]) openResult(results[0]); }} placeholder="Tìm nhiệm vụ, ghi chú, vật phẩm..." aria-label="Tìm trong sảnh chờ"/>{search && <button onClick={() => setSearch("")} aria-label="Xóa tìm kiếm">×</button>}{results.length > 0 && <div className="vref-search-results">{results.map(result => <button key={result.id} onClick={() => openResult(result)}><Search size={14}/><span>{result.label}<small>{result.detail}</small></span></button>)}</div>}</div>
        <button className="vref-header-bell" onClick={onNotifications} aria-label="Thông báo"><Bell size={21}/><i/></button>
        <button className="vref-header-profile" onClick={() => onNavigate("character")}><CharacterAvatar ownerId={state.userId} fallbackName={state.character.name}/><strong>{activeIdentity?.name ?? state.character.name}<small>Level {activeIdentity?.level ?? level.level}</small></strong><ChevronRight size={15}/></button>
      </div>
    </header>

    <div className="vref-body"><main className="vref-board" aria-label="Sảnh chờ LIFE//LEVEL">
      <MechVectorFrame className="vref-today" code="01-A">
        <div className="vref-today-top"><Heading icon={Sun} title="Hôm nay" onNavigate={() => onNavigate("calendar")}/><span>{completedToday} / {todayTotal} nhiệm vụ hoàn thành</span><Meter value={completedToday} max={Math.max(1, todayTotal)} tone="pink"/></div>
        <div className="vref-today-content">
          <div className="vref-hero-summary"><div className="vref-today-character"><LiveCharacterCanvas {...renderProfile.character} frontFacing cosmetics={renderProfile.cosmetics} equipment={renderProfile.equipment} weaponId={renderProfile.weaponId} referenceLook={renderProfile.referenceLook}/>{starterPortrait && <span className="vref-starter-portrait vref-starter-portrait--today" aria-hidden="true"/>}<button className="vref-art-hitbox" type="button" onClick={() => onNavigate("character")} aria-label="Mở nhân vật"/></div>
            <div className="vref-vitals"><CyberTechButton preserveChildren type="button" className="vref-vital-link" onClick={() => onNavigate("character")} aria-label="Xem chỉ số HP của nhân vật"><Heart size={19}/><span>HP</span><strong>{state.character.hp}/100</strong><Meter value={state.character.hp} tone="pink"/></CyberTechButton><CyberTechButton preserveChildren type="button" className="vref-vital-link" onClick={() => onNavigate("character")} aria-label="Xem năng lượng của nhân vật"><Zap size={19}/><span>Năng lượng</span><strong>{state.character.energy}/100</strong><Meter value={state.character.energy} tone="blue"/></CyberTechButton><CyberTechButton preserveChildren type="button" className="vref-vital-link" onClick={() => onNavigate("character")} aria-label="Xem mức tập trung dựa trên tâm trạng của nhân vật"><Sparkles size={19}/><span>Tập trung</span><strong>{state.character.mood}/100</strong><Meter value={state.character.mood} tone="green"/></CyberTechButton><CyberTechButton preserveChildren variant="amber" className="vref-gold" onClick={onCreateTask} aria-label="Tạo nhiệm vụ để kiếm vàng"><CircleDollarSign size={25}/><span>Vàng game<strong>{number(state.gold)}</strong></span><Plus size={18}/></CyberTechButton></div>
            <CyberTechButton preserveChildren className="vref-level vref-content-link" type="button" onClick={() => onNavigate("character")} aria-label="Xem cấp độ và kinh nghiệm nhân vật"><strong>Level {level.level}</strong><Meter value={level.current} max={level.next} tone="blue"/><span>{number(level.current)} / {number(level.next)} XP</span></CyberTechButton>
          </div>
          <div className="vref-tasks"><h3><Target size={17}/>3 việc ưu tiên hôm nay</h3>{activeTasks.map(task => <div className="vref-task" key={task.id}><CyberTechButton preserveChildren className="vref-task-check" disabled={actionsDisabled} aria-label={`Hoàn thành ${task.title}`} onClick={() => onComplete(task)}><Check size={14}/></CyberTechButton><CyberTechButton preserveChildren className="vref-task-summary vref-content-link" onClick={() => onNavigate("quests")} aria-label={`Xem nhiệm vụ ${task.title}`}><strong>{task.title}</strong><small>+{REWARDS[task.difficulty].xp} XP · +{REWARDS[task.difficulty].gold} G</small></CyberTechButton><CyberTechButton preserveChildren className="vref-task-open" onClick={() => onNavigate("quests")} aria-label={`Xem nhiệm vụ ${task.title}`}><ChevronRight size={17}/></CyberTechButton></div>)}{!activeTasks.length && <div className="vref-task-empty"><p>Chưa có nhiệm vụ đang mở.</p><CyberTechButton preserveChildren onClick={onCreateTask}><Plus size={15}/>Tạo nhiệm vụ</CyberTechButton></div>}</div>
        </div>
      </MechVectorFrame>

      <MechVectorFrame className="vref-boss" code="02-B" accent="magenta">
        <Heading icon={Sword} title="Boss chiến dịch" onNavigate={() => onNavigate("campaigns")}/>
        <div className="vref-boss-main">
          <button className="vref-boss-art" type="button" onClick={() => onNavigate("campaigns")} aria-label="Mở chi tiết chiến dịch">
            <span className="vref-boss-loot" aria-label="Phần thưởng khi hạ boss">
              <span title="Tai nghe"><Headphones size={16}/></span>
              <span title="Rương báu"><Gift size={16}/></span>
              <span title="Đá năng lượng"><Zap size={16}/></span>
            </span>
          </button>
          <div className="vref-boss-info">
            <CyberTechButton preserveChildren className="vref-boss-stats vref-content-link" type="button" onClick={() => onNavigate("campaigns")} aria-label="Mở thông tin Boss chiến dịch">
              <span className="vref-boss-identity"><strong title={bossDef?.name}>{bossDef?.name ?? "Chưa chọn boss"}</strong>{bossDef && <span>Lv. {bossDef.level}</span>}</span>
              <Meter value={bossHpPercent} tone="pink"/>
              <small>{boss && bossDef ? `${number(boss.hp)} / ${number(bossDef.maxHp)} HP` : "Mở chiến dịch để bắt đầu"}</small>
              <span className="vref-boss-story">{boss?.defeatedAt ? "Đã đánh bại thử thách này." : bossDef?.description ?? "Hoàn thành nhiệm vụ để gây sát thương."}</span>
            </CyberTechButton>
            <div className="vref-boss-checklist">
              <CyberTechButton preserveChildren className="vref-boss-checklist-title" type="button" onClick={() => onNavigate("campaigns")}>Nhiệm vụ tiêu diệt ({bossTasks.length}/3)</CyberTechButton>
              {bossTasks.map(task => <CyberTechButton preserveChildren variant="magenta" key={task.id} disabled={actionsDisabled} onClick={() => onComplete(task)} title={task.title}><span className="vref-boss-checkbox"/><span>{task.title}</span><em>+{REWARDS[task.difficulty].xp} XP</em></CyberTechButton>)}
              {!bossTasks.length && <span>Chưa có nhiệm vụ liên kết.</span>}
            </div>
            <CyberTechButton preserveChildren variant="magenta" className="vref-boss-detail" onClick={() => onNavigate("campaigns")}>Xem chi tiết chiến dịch <ArrowRight size={13} aria-hidden="true"/></CyberTechButton>
          </div>
        </div>
      </MechVectorFrame>

      <MechVectorFrame className="vref-butler" code="03-C"><Heading icon={Sparkles} title="AI Quản gia" onNavigate={() => onNavigate("butler")} extra={<span className="vref-panel-signal"><i/>LIVE</span>}/><button className="vref-butler-art vref-content-link" type="button" onClick={() => onNavigate("butler")} aria-label="Mở AI Quản gia NOVA"><span className="vref-cyber-corner tl"/><span className="vref-cyber-corner br"/><span className="vref-butler-chip">NOVA · NEURAL CORE</span><span className="vref-scanlines"/></button><CyberTechButton preserveChildren className="vref-butler-message vref-content-link" onClick={() => onNavigate("quests")}>{activeTasks[0] ? `Hôm nay hãy bắt đầu từ “${activeTasks[0].title}”. Tôi sẽ theo dõi tiến độ của bạn.` : "Một bước nhỏ hôm nay sẽ tạo đà cho ngày mai."}</CyberTechButton><div className="vref-butler-list">{butlerSuggestions.map(({ text, screen, icon: Icon }) => <CyberTechButton preserveChildren key={screen} onClick={() => onNavigate(screen)}><Icon size={14}/><span>{text}</span><ChevronRight size={15}/></CyberTechButton>)}</div></MechVectorFrame>

      <LobbySkillTreeWidget state={state} level={level.level} onNavigate={onNavigate}/>

      <div className="vref-mid-bottom">
        <MechVectorFrame className="vref-character" code="05-E">
          <div className="vref-character-header">
            <div className="vref-character-heading">
              <Heading icon={UserRound} title="Nhân vật" onNavigate={() => onNavigate("character")}/>
              <details className="vref-character-menu"><summary aria-label="Chọn khu vực nhân vật"><ChevronDown size={13}/></summary><div>
                <button type="button" onClick={() => onNavigate("character")}>Hồ sơ nhân vật</button>
                <button type="button" onClick={() => onNavigate("skills")}>Cây kỹ năng</button>
                <button type="button" onClick={() => onNavigate("equipment")}>Trang bị</button>
              </div></details>
            </div>
            <CyberTechButton preserveChildren className="vref-character-detail" onClick={() => onNavigate("character")}>Xem chi tiết <ArrowRight size={12}/></CyberTechButton>
          </div>
          <div className="vref-character-body">
            <div className="vref-character-art">
              <LiveCharacterCanvas {...renderProfile.character} frontFacing cosmetics={renderProfile.cosmetics} equipment={renderProfile.equipment} weaponId={renderProfile.weaponId} referenceLook={renderProfile.referenceLook}/>
              {starterPortrait && <span className="vref-starter-portrait vref-starter-portrait--character" aria-hidden="true"/>}
              <span className="vref-character-ring" aria-hidden="true"/>
              <span className="vref-cyber-corner tl"/><span className="vref-cyber-corner br"/><span className="vref-scanlines"/>
              <button className="vref-art-hitbox" type="button" onClick={() => onNavigate("character")} aria-label="Mở hồ sơ nhân vật"/>
            </div>
            <div className="vref-character-data">
              <CyberTechButton preserveChildren className="vref-character-identity vref-content-link" type="button" onClick={() => onNavigate("character")}><strong>{activeIdentity?.name ?? state.character.name}</strong><span>Level {activeIdentity?.level ?? level.level}</span></CyberTechButton>
              <CyberTechButton preserveChildren className="vref-character-progress vref-content-link" type="button" onClick={() => onNavigate("character")} aria-label={`Xem kinh nghiệm: ${number(level.current)} trên ${number(level.next)} XP`}><Meter value={level.current} max={level.next} tone="blue"/><small className="vref-character-xp">{number(level.current)} / {number(level.next)} XP</small></CyberTechButton>
              <div className="vref-character-tabs" role="tablist" aria-label="Thông tin nhân vật">
                <CyberTechButton preserveChildren role="tab" aria-selected={characterTab === "stats"} className={characterTab === "stats" ? "active" : ""} onClick={() => setCharacterTab("stats")}>Chỉ số</CyberTechButton>
                <CyberTechButton preserveChildren role="tab" aria-selected={characterTab === "equipment"} className={characterTab === "equipment" ? "active" : ""} onClick={() => setCharacterTab("equipment")}>Trang bị đang dùng</CyberTechButton>
              </div>
              {characterTab === "stats" ? <div className="vref-character-statbars" role="tabpanel">
                {skillBars.map(stat => { const Icon = stat.icon; return <CyberTechButton preserveChildren className="vref-character-stat vref-content-link flex items-center" type="button" onClick={() => onNavigate("character")} key={stat.label} aria-label={`Xem ${stat.label}: ${stat.text}`}><span className="vref-character-stat-label flex items-center"><Icon size={12} aria-hidden="true"/><span>{stat.label}</span></span><Meter value={stat.value} tone={stat.tone}/><b>{stat.text}</b></CyberTechButton>; })}
              </div> : <div className="vref-character-equipment" role="tabpanel">
                <div className="vref-gear-grid">{Array.from({ length: 4 }, (_, index) => {
                  const item = displayedEquipment[index];
                  const Icon = item ? equipmentIcon(item.slot) : Plus;
                  return <button type="button" key={index} title={item?.name ?? "Ô trống"} aria-label={`Mở trang bị: ${item?.name ?? "Ô trống"}`} onClick={() => onNavigate("equipment")}><Icon size={17} aria-hidden="true"/><small>{item?.name ?? "Ô trống"}</small></button>;
                })}</div>
                <CyberTechButton preserveChildren onClick={() => onNavigate("equipment")}>Thay đổi trang bị <ArrowRight size={11}/></CyberTechButton>
              </div>}
            </div>
          </div>
        </MechVectorFrame>
        <LobbyAchievementsWidget state={state} achievements={ACHIEVEMENTS} onNavigate={onNavigate}/></div>

      <LobbyRewardsWidget state={state} onNavigate={onNavigate} onRedeem={onRedeem} actionsDisabled={actionsDisabled}/>
    </main></div>
  </div>;
}

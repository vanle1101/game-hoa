"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, Check, ChevronRight, Clock3, Flag, Layers3, LockKeyhole, Map, Plus, Shield, Target, Trophy, X } from "lucide-react";
import type { Action, GameState } from "@/domain/types";
import { BOSSES } from "@/domain/catalog";
import { dateKey } from "@/domain/engine";
import "./campaign.css";

const CampaignWorld = dynamic(() => import("./CampaignWorld"), { ssr: false, loading: () => <div className="cm-world-loading">Đang mở bản đồ thành phố…</div> });
export type CampaignMapNode = { id: string; title: string; taskIds: string[]; done: boolean; required: boolean; weight?: number; locked: boolean };
type MapCampaign = { id: string; name: string; description: string; bossId: string; meaningful: boolean; done: boolean; progress: number; nodes: CampaignMapNode[]; rewardXp: number; rewardGold: number };
type Props = { state: GameState; act: (action: Action) => void; busy: boolean; navigate: (screen: string) => void };

function campaignsFromState(state: GameState): MapCampaign[] {
  const completed = (id: string) => state.occurrences.some((o) => o.taskId === id && o.status === "completed");
  const locked = (ids: string[]) => ids.every((id) => { const task = state.tasks.find((t) => t.id === id); return !task || task.archived || !state.occurrences.some((o) => o.taskId === id && o.status === "open" && o.date <= dateKey(new Date().toISOString(), task.timezone)); });
  return [
    ...state.campaigns.map((campaign) => {
      const encounter = state.bosses.find((b) => b.id === campaign.bossId), boss = BOSSES.find((b) => b.id === encounter?.definitionId);
      const doneCount = campaign.requiredTaskIds.filter(completed).length;
      return { id: campaign.id, name: campaign.title, description: campaign.description, bossId: campaign.bossId, meaningful: false, done: !!campaign.completedAt, progress: campaign.requiredTaskIds.length ? Math.floor(doneCount / campaign.requiredTaskIds.length * 100) : 0, rewardXp: boss?.rewardXp ?? 0, rewardGold: boss?.rewardGold ?? 0, nodes: campaign.milestones.map((m) => ({ ...m, required: true, done: m.taskIds.every(completed), locked: locked(m.taskIds) })) };
    }),
    ...(state.meaningfulBosses ?? []).filter((boss) => boss.project && boss.status !== "archived").map((boss) => ({ id: boss.id, name: boss.name, description: boss.description, bossId: boss.id, meaningful: true, done: boss.status === "defeated", progress: boss.progress, rewardXp: 150, rewardGold: 90, nodes: boss.project!.milestones.map((m) => ({ id: m.id, title: m.title, taskIds: [m.taskId], done: !!m.completedAt, required: m.required, weight: m.weight, locked: locked([m.taskId]) })) })),
  ];
}

export default function CampaignMap({ state, act, busy, navigate }: Props) {
  const [selectedId, setSelectedId] = useState<string>(), [nodeId, setNodeId] = useState<string>(), [creating, setCreating] = useState(false);
  const campaigns = campaignsFromState(state);
  const campaign = campaigns.find((c) => c.id === selectedId) ?? campaigns.find((c) => c.bossId === state.activeMeaningfulBossId || c.bossId === state.activeBossId) ?? campaigns[0];
  const node = campaign?.nodes.find((n) => n.id === nodeId) ?? campaign?.nodes.find((n) => !n.done) ?? campaign?.nodes[0];
  const tasks = node?.taskIds.flatMap((id) => state.tasks.find((t) => t.id === id) ?? []) ?? [];
  const selectCampaign = (id: string) => { setSelectedId(id); setNodeId(undefined); };
  const enterArena = () => { if (!campaign || campaign.done) return; act(campaign.meaningful ? { type: "boss.meaningful.select", bossId: campaign.bossId } : { type: "boss.select", encounterId: campaign.bossId }); navigate("arena"); };
  return <div className="cm-page" data-reduced-motion={state.settings.reducedMotion}>
    <header className="cm-page-heading"><div><span className="eyebrow">NEON HAVEN / BẢN ĐỒ HÀNH TRÌNH</span><h2>Mỗi mục tiêu, một hành trình.</h2><p>Những việc bạn hoàn thành thắp sáng thành phố của riêng mình.</p></div><button className="btn" onClick={() => setCreating(!creating)}><Plus size={16}/>Tạo chiến dịch</button></header>
    {creating && <CampaignCreator act={act} busy={busy} onClose={() => setCreating(false)}/>}
    {campaigns.length > 0 && <nav className="cm-campaign-tabs" aria-label="Chọn chiến dịch">{campaigns.map((c) => <button key={c.id} aria-pressed={campaign?.id === c.id} className={campaign?.id === c.id ? "selected" : ""} onClick={() => selectCampaign(c.id)}><span>{c.done ? <Check size={15}/> : <Flag size={15}/>} {c.name}</span><small>{c.meaningful ? "DỰ ÁN" : "CHIẾN DỊCH"} · {c.progress}%</small></button>)}</nav>}
    <div className="cm-layout">
      <section className="cm-stage" aria-label="Bản đồ chiến dịch 3D">
        <CampaignWorld key={campaign?.id ?? "empty"} nodes={campaign?.nodes ?? []} selectedId={node?.id} onSelect={setNodeId} quality={state.settings.graphics}/>
        <div className="cm-stage-title"><span className="eyebrow">{campaign ? `${campaign.meaningful ? "DỰ ÁN" : "CHIẾN DỊCH"} / ${String(campaign.nodes.length).padStart(2, "0")} DẤU MỐC` : "CHƯƠNG TIẾP THEO CỦA BẠN"}</span><h3>{campaign?.name ?? "Thành phố đang chờ bạn"}</h3>{campaign && <p>{campaign.nodes.filter((n) => n.done).length} / {campaign.nodes.length} dấu mốc hoàn thành</p>}</div>
        <div className="cm-compass" aria-hidden="true"><span>N</span><Map size={21}/></div>
        {!campaign && <div className="cm-empty"><Flag size={30}/><h3>Chưa có hành trình nào</h3><p>Chọn một mục tiêu thật và chia thành các nhiệm vụ. Mỗi dấu mốc trên bản đồ sẽ đến từ kế hoạch của bạn.</p><button className="btn" onClick={() => setCreating(true)}>Tạo chiến dịch đầu tiên <ArrowUpRight size={16}/></button></div>}
        <div className="cm-map-footer"><div><span><i className="done"/>Hoàn thành</span><span><i/>Đang thực hiện</span><span><i className="locked"/>Chưa khả dụng</span></div><small>Kéo để xoay · Cuộn để phóng to</small></div>
      </section>
      <aside className="cm-detail">
        {campaign ? <>
          <div className="cm-detail-heading"><span className="eyebrow">{campaign.done ? "HÀNH TRÌNH HOÀN THÀNH" : "HỒ SƠ DẤU MỐC"}</span><span>{campaign.done ? <Trophy size={19}/> : <Target size={19}/>}</span></div>
          <h3>{node?.title ?? campaign.name}</h3><p>{campaign.description || "Tiến độ được ghi nhận từ những nhiệm vụ thực tế trong hành trình này."}</p>
          {node && <div className="cm-node-status">{node.done ? <Check size={15}/> : node.locked ? <LockKeyhole size={15}/> : <Target size={15}/>}<span>{node.done ? "Đã hoàn thành" : node.locked ? "Chưa có nhiệm vụ khả dụng" : "Sẵn sàng thực hiện"}</span><small>{node.required ? "BẮT BUỘC" : "TÙY CHỌN"}</small></div>}
          <div className="cm-progress-label"><span>Tiến độ {campaign.meaningful ? "theo trọng số" : "chiến dịch"}</span><strong>{campaign.progress}%</strong></div><div className="cm-progress" role="progressbar" aria-label="Tiến độ chiến dịch" aria-valuenow={campaign.progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${campaign.progress}%` }}/></div>
          {node?.weight !== undefined && <small className="cm-weight">Trọng số dấu mốc: {node.weight}</small>}
          <div className="cm-task-details">{tasks.map((task) => { const occurrence = state.occurrences.find((o) => o.taskId === task.id && o.status === "open" && o.date <= dateKey(new Date().toISOString(), task.timezone)); const done = state.occurrences.some((o) => o.taskId === task.id && o.status === "completed"); const ready = occurrence && !task.archived && task.checklist.every((c) => c.done); return <div key={task.id}><strong>{task.title}</strong><p>{task.description || "Hoàn thành công việc ngoài đời trước khi xác nhận."}</p><small><Clock3 size={13}/>{task.duration} phút · {task.dueDate}</small>{task.checklist.length > 0 && <span className="cm-checklist-count">Checklist: {task.checklist.filter((c) => c.done).length}/{task.checklist.length}</span>}<button className="btn ghost" disabled={busy || done || !ready} onClick={() => occurrence && act({ type: "task.complete", occurrenceId: occurrence.id })}>{done ? <><Check size={15}/>Đã ghi nhận</> : "Xác nhận đã hoàn thành"}</button>{!done && !ready && <small>{task.archived ? "Nhiệm vụ đã lưu trữ." : !occurrence ? "Nhiệm vụ chưa đến hạn hoặc không còn mở." : "Hoàn tất checklist trong Nhiệm vụ trước."}</small>}</div>; })}</div>
          <button className="cm-text-link" onClick={() => navigate("quests")}>Xem nhiệm vụ <ChevronRight size={15}/></button>
          <div className="cm-rewards"><span className="eyebrow">THƯỞNG KẾT THÚC · TỐI ĐA</span><div><b>{campaign.rewardXp} <small>XP</small></b><b>{campaign.rewardGold} <small>G</small></b></div><p>Áp dụng giới hạn thưởng trong ngày. Trang bị rơi ra được ghi trong nhật ký khi chiến thắng.</p></div>
          <button className="btn cm-arena-button" disabled={busy || campaign.done} onClick={enterArena}>{campaign.done ? <><Trophy size={16}/>Hành trình hoàn thành</> : <>Đến đấu trường <ArrowUpRight size={16}/></>}</button>
        </> : <div className="cm-empty-detail"><Layers3 size={30}/><h3>Mục tiêu → dấu mốc → chiến thắng</h3><p>Tạo chiến dịch tại đây hoặc tạo Project Boss trong đấu trường từ các nhiệm vụ có sẵn.</p><button className="btn ghost" onClick={() => navigate("arena")}>Mở đấu trường <ArrowUpRight size={15}/></button></div>}
      </aside>
    </div>
    {campaign && <section className="cm-milestone-section"><div className="cm-section-heading"><div><span className="eyebrow">TỪNG BƯỚC THẮP SÁNG THÀNH PHỐ</span><h3>Các dấu mốc</h3></div><span>{campaign.nodes.filter((n) => n.done).length}/{campaign.nodes.length}</span></div><div className="cm-milestone-list">{campaign.nodes.map((n, i) => <button key={n.id} className={`${n.done ? "complete " : ""}${node?.id === n.id ? "selected" : ""}`} aria-pressed={node?.id === n.id} onClick={() => setNodeId(n.id)}><span className="cm-node-number">{n.done ? <Check size={17}/> : String(i + 1).padStart(2, "0")}</span><div><strong>{n.title}</strong><small>{n.done ? "Đã hoàn thành" : n.locked ? "Chưa khả dụng" : "Đang thực hiện"}{n.weight !== undefined ? ` · Trọng số ${n.weight}` : ""}</small></div><ChevronRight size={16}/></button>)}</div><p className="cm-honesty"><Shield size={13}/> Các tuyến đường minh họa hành trình. Chỉ nhiệm vụ hoàn thành mới tăng tiến độ; bạn có thể làm các mốc khả dụng theo thứ tự phù hợp.</p></section>}
  </div>;
}

function CampaignCreator({ act, busy, onClose }: Pick<Props, "act" | "busy"> & { onClose: () => void }) {
  const [title, setTitle] = useState(""), [tasks, setTasks] = useState("");
  const lines = tasks.split("\n").map((line) => line.trim()).filter(Boolean);
  const valid = title.trim().length > 0 && title.trim().length <= 120 && lines.length > 0 && lines.length <= 30 && lines.every((line) => line.length <= 120);
  return <section className="cm-creator panel"><div className="cm-section-heading"><h3>Tạo chiến dịch từ mục tiêu thật</h3><button className="cm-close" aria-label="Đóng tạo chiến dịch" onClick={onClose}><X size={18}/></button></div><div className="form-grid"><label>Mục tiêu<input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Hoàn thiện portfolio"/></label><label>Các dấu mốc bắt buộc<textarea value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder={"Mỗi dòng là một công việc thực tế\nTối đa 30 dấu mốc, 120 ký tự mỗi dòng"}/></label></div><p>{lines.length}/30 dấu mốc · Mỗi dấu mốc tạo một nhiệm vụ nghề nghiệp, độ khó cao.</p><button className="btn" disabled={busy || !valid} onClick={() => act({ type: "campaign.create", title: title.trim(), tasks: lines.map((title) => ({ title, kind: "campaign", difficulty: "hard", skill: "career" })) })}><Plus size={15}/>Khởi tạo chiến dịch</button></section>;
}

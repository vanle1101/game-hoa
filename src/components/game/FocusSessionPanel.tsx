"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Coffee, Play, RotateCcw, ShieldCheck, Timer, X } from "lucide-react";
import type { Action, GameState } from "@/domain/types";

const WORK_OPTIONS = [15, 25, 45, 60] as const;
const BREAK_OPTIONS = [3, 5, 10, 15] as const;
const durationLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function todayIn(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function FocusSessionPanel({ state, act, busy, onCreateTask, onOpenQuests }: {
  state: GameState;
  act: (action: Action) => void;
  busy: boolean;
  onCreateTask: () => void;
  onOpenQuests: () => void;
}) {
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const day = todayIn(state.settings.timezone);
  const taskOptions = state.occurrences
    .filter(occurrence => occurrence.status === "open" && occurrence.date <= day)
    .map(occurrence => ({ occurrence, task: state.tasks.find(task => task.id === occurrence.taskId) }))
    .filter((row): row is { occurrence: (typeof state.occurrences)[number]; task: NonNullable<typeof row.task> } => Boolean(row.task && !row.task.archived && row.task.kind !== "negative-habit"))
    .sort((a, b) => Number(b.task.priority === "high") - Number(a.task.priority === "high") || a.occurrence.date.localeCompare(b.occurrence.date));
  const sessions = state.focusSessions ?? [];
  const activeSession = sessions.find(session => session.status === "running") ?? [...sessions].reverse().find(session => session.status === "ended");
  const activeOccurrence = activeSession && state.occurrences.find(occurrence => occurrence.id === activeSession.occurrenceId);
  const activeTask = activeOccurrence && state.tasks.find(task => task.id === activeOccurrence.taskId);
  const selected = taskOptions.find(row => row.occurrence.id === selectedOccurrenceId) ?? taskOptions[0];
  const requiredMinutes = activeTask ? Math.max(activeTask.duration, activeSession?.plannedMinutes ?? activeTask.duration) : activeSession?.plannedMinutes ?? 25;
  const startedAt = activeSession ? Date.parse(activeSession.startedAt) : Number.NaN;
  const endAt = startedAt + requiredMinutes * 60_000;
  const remainingSeconds = activeSession?.status === "running" ? Math.max(0, Math.ceil((endAt - clockNow) / 1000)) : 0;
  const elapsedSeconds = activeSession ? Math.max(0, Math.floor((clockNow - startedAt) / 1000)) : 0;
  const completeWork = Boolean(activeSession?.status === "ended" && activeSession.endedAt && Date.parse(activeSession.endedAt) - startedAt >= requiredMinutes * 60_000);
  const latestConfirmed = [...sessions].reverse().find(session => session.status === "confirmed" && session.confirmedAt);
  const breakMinutes = state.settings.focusBreakMinutes ?? 5;
  const breakEndsAt = latestConfirmed?.confirmedAt ? Date.parse(latestConfirmed.confirmedAt) + breakMinutes * 60_000 : 0;
  const breakRemaining = Math.max(0, Math.ceil((breakEndsAt - clockNow) / 1000));
  const shouldTick = activeSession?.status === "running" || breakRemaining > 0;

  useEffect(() => {
    if (!shouldTick) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [shouldTick, activeSession?.id, breakEndsAt]);

  const configuredWork = state.settings.focusWorkMinutes ?? 25;
  const plannedMinutes = selected ? Math.max(configuredWork, selected.task.duration) : configuredWork;
  const progressPercent = activeSession?.status === "running" ? Math.min(100, elapsedSeconds / (requiredMinutes * 60) * 100) : activeSession?.status === "ended" ? 100 : 0;

  return <section className="focus-panel focus-flow panel" aria-labelledby="focus-title">
    <header className="focus-flow-heading">
      <div><span className="eyebrow"><Timer size={14} aria-hidden="true"/> NHỊP LÀM VIỆC BỀN VỮNG</span><h1 id="focus-title">Tập trung từng việc một</h1><p>Phiên được lưu vào tiến trình của bạn. Chỉ xác nhận khi công việc ngoài đời đã hoàn tất.</p></div>
      <ShieldCheck size={27} aria-hidden="true"/>
    </header>

    <div className="focus-settings" aria-label="Cấu hình Pomodoro">
      <label>Thời gian làm<select aria-label="Thời gian tập trung" value={configuredWork} disabled={busy || Boolean(activeSession?.status === "running")} onChange={event => act({ type: "settings.update", settings: { focusWorkMinutes: Number(event.target.value) as typeof WORK_OPTIONS[number] } })}>{WORK_OPTIONS.map(value => <option key={value} value={value}>{value} phút</option>)}</select></label>
      <span aria-hidden="true">/</span>
      <label>Thời gian nghỉ<select aria-label="Thời gian nghỉ" value={breakMinutes} disabled={busy} onChange={event => act({ type: "settings.update", settings: { focusBreakMinutes: Number(event.target.value) as typeof BREAK_OPTIONS[number] } })}>{BREAK_OPTIONS.map(value => <option key={value} value={value}>{value} phút</option>)}</select></label>
      <small>Mặc định 25 / 5 · cài đặt lưu theo hồ sơ</small>
    </div>

    {activeSession?.status === "running" && <div className="focus-live-session" role="status" aria-live="polite">
      <span className="focus-session-state"><i/> ĐANG TẬP TRUNG · ĐÃ LƯU</span>
      <strong className="focus-task-title">{activeTask?.title ?? "Nhiệm vụ đã lưu"}</strong>
      <output className="focus-clock" aria-label="Thời gian còn lại">{durationLabel(remainingSeconds)}</output>
      <div className="focus-progress-track" role="progressbar" aria-label="Tiến độ phiên tập trung" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progressPercent)}><i style={{ width: `${progressPercent}%` }}/></div>
      <p>{remainingSeconds ? `Còn ${Math.ceil(remainingSeconds / 60)} phút. Tải lại trang vẫn khôi phục phiên này.` : "Đã đủ thời lượng tối thiểu. Ghi nhận thời gian để chuyển sang bước xác nhận."}</p>
      <div className="button-row">
        <button className="btn primary" type="button" disabled={busy || remainingSeconds > 0} onClick={() => act({ type: "focus.end", sessionId: activeSession.id })}><Check size={16}/>{remainingSeconds > 0 ? "Chưa đủ thời gian" : "Ghi nhận thời gian"}</button>
        <button className="btn ghost" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}><X size={15}/>Hủy phiên, không thưởng</button>
      </div>
    </div>}

    {activeSession?.status === "ended" && <div className="focus-live-session focus-awaiting-confirm" role="status">
      <span className="focus-session-state"><Check size={13}/> ĐỦ THỜI LƯỢNG · CHỜ BẠN XÁC NHẬN</span>
      <strong className="focus-task-title">{activeTask?.title ?? "Nhiệm vụ đã lưu"}</strong>
      <output className="focus-clock">{durationLabel(0)}</output>
      <p>Đồng hồ không tự hoàn thành nhiệm vụ hoặc tự trao XP / Gold. Xác nhận công việc thật để áp dụng phần thưởng của nhiệm vụ một lần.</p>
      {activeTask && !activeTask.checklist.every(item => item.done) && <p className="focus-inline-warning">Hoàn tất checklist trong Nhiệm vụ trước khi xác nhận.</p>}
      <div className="button-row">
        <button className="btn primary" type="button" disabled={busy || !completeWork || !activeTask?.checklist.every(item => item.done)} onClick={() => act({ type: "focus.confirm", sessionId: activeSession.id, confirmed: true })}><Check size={16}/>Xác nhận đã làm xong</button>
        <button className="btn ghost" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}><X size={15}/>Bỏ phiên, không thưởng</button>
      </div>
    </div>}

    {!activeSession && <div className="focus-start-session">
      {taskOptions.length > 0 ? <>
        <label className="focus-task-select">Nhiệm vụ đang mở<select aria-label="Nhiệm vụ cho phiên tập trung" value={selected?.occurrence.id ?? ""} onChange={event => setSelectedOccurrenceId(event.target.value)}>{taskOptions.map(({ occurrence, task }) => <option key={occurrence.id} value={occurrence.id}>{task.priority === "high" ? "ƯU TIÊN · " : ""}{task.title} · {task.duration} phút</option>)}</select></label>
        {selected && <div className="focus-selected-meta"><span>{selected.task.skill.toUpperCase()} · {selected.task.difficulty.toUpperCase()}</span><span>{selected.task.duration} phút theo nhiệm vụ</span></div>}
        <div className="focus-ready-clock">{durationLabel(plannedMinutes * 60)}</div>
        <p>{selected && selected.task.duration > configuredWork ? `Nhiệm vụ cần ${selected.task.duration} phút nên phiên sẽ kéo dài tương ứng.` : "Phiên Pomodoro không tự cộng thưởng; bạn xác nhận sau khi hoàn thành việc thật."}</p>
        <button className="btn primary focus-start-button" type="button" disabled={busy || !selected} onClick={() => selected && act({ type: "focus.start", occurrenceId: selected.occurrence.id, plannedMinutes })}><Play size={16}/>Bắt đầu phiên {plannedMinutes} phút</button>
      </> : <div className="focus-empty-state"><Clock3 size={30} aria-hidden="true"/><strong>Chưa có nhiệm vụ phù hợp hôm nay</strong><p>Tạo một việc có thể làm thật, rồi gắn một phiên tập trung với nó.</p><div className="button-row"><button className="btn primary" type="button" onClick={onCreateTask}>Tạo nhiệm vụ</button><button className="btn ghost" type="button" onClick={onOpenQuests}>Mở nhật ký</button></div></div>}
    </div>}

    {!activeSession && breakRemaining > 0 && <div className="focus-break-card" role="status"><Coffee size={18}/><div><strong>Đến giờ nghỉ ngắn</strong><span>Khôi phục năng lượng · còn {durationLabel(breakRemaining)}</span></div></div>}

    <footer className="focus-flow-footer"><span><RotateCcw size={13}/> Cập nhật lại trang để khôi phục phiên đang chạy</span><button type="button" className="text-link" onClick={onOpenQuests}>Quay lại Nhiệm vụ →</button></footer>

    {confirmCancel && activeSession && <div className="focus-cancel-confirm" role="alertdialog" aria-label="Xác nhận hủy phiên">
      <p>Hủy phiên này? Thời gian đã chạy sẽ không cộng XP, Gold hay sát thương boss.</p>
      <div className="button-row"><button className="btn ghost" type="button" onClick={() => setConfirmCancel(false)}>Giữ phiên</button><button className="btn primary" type="button" disabled={busy} onClick={() => { act({ type: "focus.cancel", sessionId: activeSession.id }); setConfirmCancel(false); }}>Hủy phiên</button></div>
    </div>}
  </section>;
}

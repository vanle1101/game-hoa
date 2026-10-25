"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, CircleHelp, Clock3, LoaderCircle, RefreshCw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import type { Proposal } from "@/server/ai";

import dynamic from "next/dynamic";
import "./reference-ui.css";
import "./butler-panel.css";
const NovaHologram = dynamic(() => import("../world/NovaHologram"), { ssr: false, loading: () => <div className="nova-hologram-loading" role="status"><LoaderCircle className="spin" size={24}/><span>Đang tải NOVA…</span></div> });
type Provider = { name: string; configured: boolean; demo: boolean };
type History = { proposals: Proposal[]; provider: Provider };
const statusLabels: Record<Proposal["status"], string> = { pending: "Chờ bạn duyệt", applying: "Đang áp dụng · có thể thử lại", approved: "Đã áp dụng", rejected: "Đã từ chối" };
const skills: Record<string, string> = { health: "Sức khỏe", knowledge: "Tri thức", career: "Sự nghiệp", finance: "Kỹ năng tài chính", relationships: "Kết nối", creativity: "Sáng tạo" };
async function fetchHistory(): Promise<History> {
  const response = await fetch("/api/ai", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Không tải được lịch sử AI.");
  return result;
}

export function ButlerPanel({ onApplied }: { onApplied: () => void }) {
  const [history, setHistory] = useState<History | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState(false);
  const load = useCallback(async () => {
    try {
      setHistory(await fetchHistory()); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được Quản gia NOVA."); }
  }, []);
  useEffect(() => {
    let mounted = true;
    fetchHistory().then(result => { if (mounted) setHistory(result); })
      .catch(cause => { if (mounted) setError(cause instanceof Error ? cause.message : "Không tải được Quản gia NOVA."); });
    return () => { mounted = false; };
  }, []);

  async function act(input: { mode: "propose"; prompt: string } | { mode: "approve" | "reject"; id: string }) {
    if (busy) return;
    if (!navigator.onLine) { setError("Kết nối mạng để tạo hoặc duyệt kế hoạch. Không có thay đổi ngoại tuyến."); return; }
    setBusy(input.mode === "propose" ? "propose" : input.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể xử lý kế hoạch.");
      setHistory(previous => previous ? { provider: result.provider || previous.provider, proposals: [result.proposal, ...previous.proposals.filter(proposal => proposal.id !== result.proposal.id)] } : null);
      setSelectedId(result.proposal.id);
      if (input.mode === "approve") { onApplied(); setNotice("Chiến dịch và nhiệm vụ đã được tạo. Bạn sẽ nhận phần thưởng khi hoàn thành việc ngoài đời."); }
      if (input.mode === "reject") setNotice("Đã từ chối. Không tạo nhiệm vụ hay thay đổi game.");
      if (input.mode === "propose") setPrompt("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xử lý kế hoạch. Thử lại an toàn."); }
    finally { setBusy(null); }
  }

  const submit = (event: FormEvent) => { event.preventDefault(); if (prompt.trim().length >= 3) void act({ mode: "propose", prompt: prompt.trim() }); };
  const ordered = [...(history?.proposals || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = ordered.find(proposal => proposal.id === selectedId) || ordered[0];
  const provider = history?.provider;

  return <div className="butler-panel">
    <section className="panel nova-hero">
      <div className="nova-identity nova-identity-layout"><div className="nova-hologram" aria-label="Ảnh đại diện hologram 3D của NOVA"><span className="nova-signal">NOVA / TRỢ LÝ CÁ NHÂN</span><NovaHologram/></div><div className="nova-identity-copy"><span className="eyebrow">NOVA · QUẢN GIA CÁ NHÂN CỦA BẠN</span><h2>Mục tiêu lớn.<br/>Bước đi rõ ràng.</h2><p>Biến mục tiêu của bạn thành một kế hoạch có thể thực hiện. Bạn luôn quyết định trước khi NOVA tạo nhiệm vụ.</p><span className="tag">{!history ? "Đang tải trạng thái…" : provider?.demo ? "BẢN THỬ · Kế hoạch mẫu" : provider?.configured ? "AI từ xa đã cấu hình" : "AI chưa được cấu hình"}</span><button className="text-link" onClick={() => setPermissions(value => !value)} aria-expanded={permissions} aria-controls="nova-permissions"><ShieldCheck size={15} aria-hidden="true"/> Quyền của NOVA</button></div></div>      {permissions && <div id="nova-permissions" className="nova-permission-drawer"><strong>Chỉ đề xuất, chỉ áp dụng sau khi bạn duyệt.</strong><p className="muted">NOVA có thể đề xuất chiến dịch và nhiệm vụ linh hoạt. Không tự hoàn thành nhiệm vụ, cấp XP/vàng/vật phẩm, đánh boss, đổi cam kết hoặc quy tắc phạt. Không đọc hay chỉnh sửa sổ tài chính.</p><small>Nhà cung cấp được quản lý ở cấu hình máy chủ. Chỉ nội dung bạn nhập được gửi để lập kế hoạch; không nhập số liệu tài chính riêng tư.</small></div>}
    </section>

    {error && <div role="alert" className="panel butler-feedback is-error"><p>{error}</p><button className="btn ghost" disabled={!!busy} onClick={() => void load()}><RefreshCw size={15}/>Tải lại trạng thái</button></div>}
    {notice && <p role="status" className="butler-notice">{notice}</p>}
    {!history && !error && <div className="empty-state"><LoaderCircle className="spin"/><p>Đang tải đề xuất của bạn…</p></div>}

    {history && <>
      {!provider?.configured && <section className="panel nova-unconfigured"><CircleHelp size={22} aria-hidden="true"/><h3>NOVA đang chờ kết nối</h3><p className="muted">Muse hiện có trên máy dùng OpenCode hoặc Chrome. Cần cấu hình nhà cung cấp AI phía máy chủ để sử dụng tại đây. Lịch sử đã lưu vẫn có thể xem và xử lý.</p></section>}
      {provider?.demo && <p className="footnote">Chế độ thử nghiệm cục bộ: kế hoạch mẫu giúp kiểm tra luồng duyệt, không phải câu trả lời từ mô hình AI.</p>}
      <form className="panel nova-composer" onSubmit={submit}>
        <label htmlFor="nova-prompt"><strong>Bạn muốn tiến tới điều gì?</strong></label>
        <textarea id="nova-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} rows={4} required minLength={3} disabled={!!busy || !provider?.configured} placeholder="Ví dụ: Trong tháng này, tôi muốn xây thói quen đọc sách 20 phút mỗi ngày…" className="nova-prompt"/>
        <div className="nova-composer-footer"><small className="muted">{prompt.length}/2000 · Duyệt trước khi áp dụng</small><button className="btn primary" type="submit" disabled={!!busy || !provider?.configured || prompt.trim().length < 3}>{busy === "propose" ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>} {busy === "propose" ? "NOVA đang lập kế hoạch…" : "Tạo đề xuất"}</button></div>
      </form>

      {selected ? <section className="panel nova-proposal">
        <div className="section-head"><span className="eyebrow">XEM TRƯỚC ĐỀ XUẤT</span><span className="tag">{statusLabels[selected.status]}</span></div>
        <h2>{selected.plan.title}</h2><p className="muted">{selected.plan.summary}</p>
        <div className="nova-task-list">{selected.plan.tasks.map((task, index) => <article className="nova-task" key={`${selected.id}-${index}`}><span className="eyebrow nova-step">BƯỚC {String(index + 1).padStart(2, "0")}</span><h3>{task.title}</h3><p className="muted">{task.description}</p><div className="nova-task-meta"><span className="tag">{skills[task.skill]}</span><small><Clock3 size={12} aria-hidden="true"/> {task.duration} phút</small><small>{task.dueDate}</small><small>Không cam kết phạt</small></div></article>)}</div>
        {(selected.status === "pending" || selected.status === "applying") && <div className="nova-proposal-actions"><button className="btn primary" disabled={!!busy} onClick={() => void act({ mode: "approve", id: selected.id })}>{busy === selected.id ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {selected.status === "applying" ? "Tiếp tục áp dụng" : `Duyệt và tạo ${selected.plan.tasks.length} nhiệm vụ`}</button>{selected.status === "pending" && <button className="btn ghost" disabled={!!busy} onClick={() => void act({ mode: "reject", id: selected.id })}><X size={16}/>Từ chối</button>}</div>}
        {selected.status === "approved" && <p className="butler-approved"><Check size={16} aria-hidden="true"/> Đã tạo chiến dịch. Mở Nhiệm vụ hoặc Lịch trình để tiếp tục.</p>}
      </section> : <div className="empty-state"><Sparkles size={30}/><h3>Một khởi đầu có chủ đích</h3><p>Đề xuất đầu tiên sẽ xuất hiện ở đây. Chưa có nhiệm vụ nào được tạo bởi NOVA.</p></div>}

      {ordered.length > 0 && <section className="panel nova-history"><span className="eyebrow">KẾ HOẠCH ĐÃ LƯU</span><h3>Lịch sử đề xuất</h3><div className="nova-history-list">{ordered.map(proposal => <button key={proposal.id} className="btn ghost nova-history-item" onClick={() => setSelectedId(proposal.id)}><span>{proposal.plan.title}<small className="nova-history-meta">{new Date(proposal.createdAt).toLocaleString("vi-VN")} · {proposal.provider === "demo" ? "Bản thử" : "AI từ xa"}</small></span><small>{statusLabels[proposal.status]}</small></button>)}</div></section>}
    </>}
  </div>;
}

export default ButlerPanel;


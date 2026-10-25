"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Download, FileUp, Landmark, Plus, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { financeReport, type FinanceState, type FinanceCommand, type ImportRow } from "@/finance";

import FinanceCharts from "./FinanceCharts";
import "./reference-ui.css";
const currency = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
};
type Tab = "overview" | "transactions" | "budgets" | "savings" | "bills" | "import";
type Form = "account" | "transaction" | "transfer" | "budget" | "goal" | "bill" | "reconcile" | null;
type Preview = { line: number; row: ImportRow | null; duplicate: boolean; error: string };

export function FinancePanel() {
  const [state, setState] = useState<FinanceState | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [form, setForm] = useState<Form>(null);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState("date,kind,amount,category,note\n");
  const [importAccount, setImportAccount] = useState("");
  const [preview, setPreview] = useState<Preview[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, setPending] = useState<{ signature: string; key: string } | null>(null);
  const read = useCallback(async () => { const response = await fetch("/api/finance", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as FinanceState; }, []);
  const load = () => read().then(data => { setState(data); setError(""); }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Không thể tải tài chính."));
  useEffect(() => { let mounted = true; read().then(data => { if (mounted) { setState(data); setError(""); } }).catch((e: unknown) => { if (mounted) setError(e instanceof Error ? e.message : "Không thể tải tài chính."); }); return () => { mounted = false; }; }, [read]);
  const mutate = async (command: FinanceCommand) => {
    if (busy || !navigator.onLine) { if (!navigator.onLine) setError("Bạn đang ngoại tuyến. Tài chính chỉ được cập nhật khi có kết nối."); return; }
    setBusy(true); setError(""); setMessage("");
    const signature = JSON.stringify(command); const key = pending?.signature === signature ? pending.key : crypto.randomUUID(); setPending({ signature, key });
    try { const response = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: signature }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setState(data); setPending(null); setForm(null); setPreview([]); setMessage("Đã lưu. Số liệu tài chính không ảnh hưởng XP hoặc vàng game."); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể lưu. Thử lại an toàn với cùng thao tác."); }
    finally { setBusy(false); }
  };
  const report = useMemo(() => state ? financeReport(state, month) : null, [state, month]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const text = (key: string) => String(data.get(key) ?? ""); const amount = (key = "amount") => Number(text(key));
    let command: FinanceCommand;
    switch (form) {
      case "account": command = { type: "account.create", name: text("name"), openingBalance: amount("openingBalance") }; break;
      case "transaction": command = { type: "transaction.create", accountId: text("accountId"), kind: text("kind") as "income" | "expense", amount: amount(), category: text("category"), note: text("note"), date: text("date") }; break;
      case "transfer": command = { type: "transfer", fromId: text("fromId"), toId: text("toId"), amount: amount(), note: text("note"), date: text("date") }; break;
      case "budget": command = { type: "budget.set", category: text("category"), amount: amount(), month: text("month") }; break;
      case "goal": command = { type: "goal.create", name: text("name"), target: amount() }; break;
      case "bill": command = { type: "bill.create", name: text("name"), accountId: text("accountId"), amount: amount(), category: text("category"), dueDate: text("date") }; break;
      case "reconcile": command = { type: "reconcile", accountId: text("accountId"), actualBalance: amount(), date: text("date"), note: text("note") }; break;
      default: return;
    }
    void mutate(command);
  };
  const importPreview = async () => {
    setBusy(true); setError(""); setPreview([]);
    try { const response = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "import.preview", csv, accountId: importAccount }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPreview(data.preview); setSelected(data.preview.filter((row: Preview) => row.row && !row.error && !row.duplicate).map((row: Preview) => row.line)); if (!data.preview.length) setMessage("Tệp CSV chưa có giao dịch."); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể đọc CSV."); }
    finally { setBusy(false); }
  };
  const exportFinance = () => { if (!state) return; const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `life-level-finance-${today()}.json`; anchor.click(); URL.revokeObjectURL(url); };
  const titles: Record<Exclude<Form, null>, string> = { account: "Thêm tài khoản", transaction: "Ghi giao dịch", transfer: "Chuyển giữa tài khoản", budget: "Đặt ngân sách", goal: "Mục tiêu tiết kiệm", bill: "Hóa đơn hàng tháng", reconcile: "Đối soát số dư" };
  const tabs: [Tab, string][] = [["overview", "Tổng quan"], ["transactions", "Giao dịch"], ["budgets", "Ngân sách"], ["savings", "Tiết kiệm"], ["bills", "Hóa đơn"], ["import", "Nhập CSV"]];
  if (!state) return <section className="finance-panel finance-loading panel"><span className="eyebrow">SỔ TÀI CHÍNH · VND</span><ShieldCheck size={28} aria-hidden="true"/><h2>Tài chính cá nhân</h2>{error ? <><p role="alert">{error}</p><button className="btn" onClick={load}>Thử lại</button></> : <p role="status">Đang tải sổ tài chính riêng của bạn…</p>}</section>;
  const accountOptions = <><option value="">Chọn tài khoản</option>{state.accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {currency(account.balance)}</option>)}</>;
  const accountSelect = (key: string, label = "Tài khoản") => <label className="field">{label}<select name={key} required>{accountOptions}</select></label>;
  const displayTransactions = state.transactions.filter(t => t.date.startsWith(month));
  return <section className="finance-panel finance-polished">
    <style>{`
      .finance-polished { --finance-surface: linear-gradient(145deg, #20242d, #141820); --finance-surface-raised: linear-gradient(145deg, #292e38, #1a1f28); --finance-line: rgba(178,190,208,.2); color: #edf1f7; }
      .finance-polished .finance-header { padding: 8px 0 20px; border-bottom: 1px solid var(--finance-line); }
      .finance-polished .finance-header h2 { font-size: clamp(26px, 3vw, 36px); margin: 10px 0; }
      .finance-polished .finance-privacy { color: #b4bfce; line-height: 1.6; }
      .finance-polished .finance-tabs { background: #151922; padding: 6px; scrollbar-width: thin; }
      .finance-polished .finance-tabs .btn { flex-shrink: 0; }
      .finance-polished .btn:focus-visible { outline: 2px solid #8de8ef; outline-offset: 3px; }
      .finance-polished .finance-toolbar { padding-bottom: 8px; }
      .finance-polished .finance-stats { grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); }
      .finance-polished .finance-stat { border-color: var(--finance-line); border-radius: 14px; padding: 20px; }
      .finance-polished .finance-stat::after { opacity: .35; }
      .finance-polished .finance-stat p { color: #b4bfce; font-size: 13px; }
      .finance-polished .finance-stat h3 { overflow-wrap: anywhere; letter-spacing: -.025em; }
      .finance-polished .finance-account { background: #1c212b; grid-template-columns: 34px minmax(0,1fr); }
      .finance-polished .finance-account > strong { overflow-wrap: anywhere; }
      .finance-polished .finance-account > span:last-child { grid-column: 2; overflow-wrap: anywhere; }
      .finance-polished .finance-transaction, .finance-polished .finance-bill { flex-wrap: wrap; }
      .finance-polished .finance-transaction > div, .finance-polished .finance-bill > div { min-width: 0; overflow-wrap: anywhere; }
      .finance-polished .finance-transaction small, .finance-polished .finance-bill small { color: #aebaca; }
      .finance-polished .finance-category-heading { align-items: baseline; }
      .finance-polished .finance-category-heading span, .finance-polished .finance-category-heading strong { overflow-wrap: anywhere; min-width: 0; }
      .finance-polished .finance-form-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); align-items: end; }
      .finance-polished .finance-form-grid > p { grid-column: 1 / -1; }
      .finance-polished .finance-form-grid .field, .finance-polished .finance-form-grid input, .finance-polished .finance-form-grid select { min-width: 0; width: 100%; }
      @media (max-width: 560px) { .finance-polished .finance-header > .finance-actions { width: 100%; } .finance-polished .finance-header > .finance-actions .btn { flex: 1; } .finance-polished .finance-account { padding: 14px; } }
    `}</style>
    <header className="section-heading finance-header"><div><p className="eyebrow">TÀI CHÍNH CÁ NHÂN · VND</p><h2>Tự chủ tài chính</h2><p className="finance-privacy"><ShieldCheck size={14} aria-hidden="true"/> Sổ riêng tư, độc lập với kinh tế game và AI.</p></div><div className="finance-actions"><button className="btn" onClick={exportFinance}><Download size={15}/>Xuất dữ liệu</button><button className="btn primary" disabled={!state.accounts.length} onClick={() => setForm("transaction")}><Plus size={15}/>Giao dịch</button></div></header>
    <div className="tabs finance-tabs" role="tablist" aria-label="Mục tài chính">{tabs.map(([key, label]) => <button className={`btn ${tab === key ? "active" : ""}`} role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {error && <div className="panel finance-feedback is-error" role="alert">{error}</div>}{message && <div className="panel finance-feedback is-success" role="status">{message}</div>}
    <div className="finance-toolbar"><label className="field">Kỳ báo cáo<span className="finance-month-input"><span className="finance-month-label" aria-hidden="true">{monthLabel(month)}</span><input type="month" lang="vi-VN" value={month} aria-label={`Kỳ báo cáo: ${monthLabel(month)}`} onChange={event => setMonth(event.target.value)}/></span></label><button className="btn" onClick={load} aria-label="Tải lại tài chính"><RefreshCw size={15}/></button></div>
    {tab === "overview" && <>
      <div className="finance-stats">{[["Tổng số dư", report!.balance, Wallet], ["Thu nhập tháng", report!.income, ArrowDownLeft], ["Chi tiêu tháng", report!.expense, ArrowUpRight], ["Dòng tiền ròng", report!.net, ArrowLeftRight]].map(([label, value, Icon]) => { const Symbol = Icon as typeof Wallet; return <article className="card finance-stat" key={String(label)}><Symbol size={19}/><p>{String(label)}</p><h3>{currency(Number(value))}</h3></article>; })}</div>
      <FinanceCharts state={state} month={month}/><div className="finance-detail-grid"><section className="panel finance-accounts"><div className="section-heading"><h3>Tài khoản</h3><div className="finance-actions"><button className="btn" onClick={() => setForm("account")}><Plus size={14}/>Thêm</button><button className="btn" disabled={state.accounts.length < 2} onClick={() => setForm("transfer")}>Chuyển khoản</button><button className="btn" disabled={!state.accounts.length} onClick={() => setForm("reconcile")}>Đối soát</button></div></div>{!state.accounts.length ? <p>Chưa có tài khoản. Thêm tài khoản với số dư thực tế để bắt đầu.</p> : <div className="list">{state.accounts.map(account => <div className="card finance-account" key={account.id}><span className="finance-account-icon"><Landmark size={19} aria-hidden="true"/></span><strong>{account.name}</strong><span>{currency(account.balance)}</span></div>)}</div>}</section>
      <section className="panel finance-categories"><span className="eyebrow">PHÂN BỔ · VND</span><h3>Chi tiêu theo danh mục</h3>{!Object.keys(report!.categories).length ? <p>Chưa ghi nhận chi tiêu trong tháng này.</p> : Object.entries(report!.categories).map(([category, value]) => <div key={category} className="finance-category"><div className="finance-category-heading"><span>{category}</span><strong>{currency(value)}</strong></div><div className="finance-progress" role="progressbar" aria-label={`Chi tiêu ${category}`} aria-valuenow={value} aria-valuemin={0} aria-valuemax={Math.max(report!.expense, 1)}><span className={`finance-progress-fill finance-progress-${Math.min(100, Math.round(value / Math.max(report!.expense, 1) * 100 / 5) * 5)}`}/></div></div>)}</section></div>
    </>}
    {tab === "transactions" && <section className="panel"><h3>Lịch sử giao dịch · {monthLabel(month)}</h3>{!displayTransactions.length ? <p>Chưa có giao dịch trong kỳ báo cáo.</p> : <div className="list">{displayTransactions.map(row => <article className="card finance-transaction" key={row.id}><div><strong>{row.category}</strong><p>{row.note || "Không có ghi chú"}</p><small>{row.date} · {state.accounts.find(a => a.id === row.accountId)?.name}</small></div><strong className={["expense", "transfer-out"].includes(row.kind) ? "finance-outflow" : "finance-inflow"}>{["expense", "transfer-out"].includes(row.kind) ? "−" : row.amount >= 0 ? "+" : ""}{currency(row.amount)}</strong></article>)}</div>}</section>}
    {tab === "budgets" && <section className="panel"><div className="section-heading"><h3>Giới hạn chi tiêu tháng</h3><button className="btn" onClick={() => setForm("budget")}><Plus size={14}/>Ngân sách</button></div>{!state.budgets.filter(b => b.month === month).length && <p>Đặt giới hạn cho từng danh mục, ví dụ Ăn uống hoặc Di chuyển.</p>}{state.budgets.filter(b => b.month === month).map(budget => { const spent = report!.categories[budget.category] ?? 0; return <article className={`card finance-budget ${spent > budget.amount ? "is-over-budget" : ""}`} key={budget.category}><h4>{budget.category}</h4><p>{currency(spent)} / {currency(budget.amount)}</p><div className="finance-progress" role="progressbar" aria-label={budget.category} aria-valuenow={spent} aria-valuemin={0} aria-valuemax={budget.amount}><span className={`finance-progress-fill finance-progress-${Math.min(100, Math.round(spent / Math.max(budget.amount, 1) * 100 / 5) * 5)}`}/></div><p>{spent > budget.amount ? `Vượt ${currency(spent - budget.amount)}` : `Còn ${currency(budget.amount - spent)}`}</p></article>; })}</section>}
    {tab === "savings" && <section className="panel"><div className="section-heading"><h3>Mục tiêu tiết kiệm</h3><button className="btn" onClick={() => setForm("goal")}><Plus size={14}/>Mục tiêu</button></div><p>Ghi nhận số tiền đã dành riêng. Đây là sổ theo dõi mục tiêu, không chuyển tiền hoặc thay đổi số dư tài khoản.</p>{!state.goals.length && <p>Chưa có mục tiêu. Bắt đầu với một quỹ dự phòng.</p>}{state.goals.map(goal => <article className="card finance-goal" key={goal.id}><h4>{goal.name}</h4><p>{currency(goal.saved)} / {currency(goal.target)}</p><div className="finance-progress" role="progressbar" aria-label={goal.name} aria-valuenow={goal.saved} aria-valuemin={0} aria-valuemax={goal.target}><span className={`finance-progress-fill finance-progress-${Math.min(100, Math.round(goal.saved / Math.max(goal.target, 1) * 100 / 5) * 5)}`}/></div>{goal.saved < goal.target ? <form onSubmit={event => { event.preventDefault(); const amount = Number(new FormData(event.currentTarget).get("amount")); void mutate({ type: "goal.save", goalId: goal.id, amount }); }} className="finance-actions"><input className="field" name="amount" type="number" min="1" max={goal.target - goal.saved} step="1" required aria-label={`Số tiền đã dành riêng cho ${goal.name}`} placeholder="Số tiền VND"/><button className="btn" disabled={busy}>Ghi nhận</button></form> : <span><Check size={15}/> Đạt mục tiêu</span>}</article>)}</section>}
    {tab === "bills" && <section className="panel"><div className="section-heading"><h3>Hóa đơn định kỳ</h3><button className="btn" disabled={!state.accounts.length} onClick={() => setForm("bill")}><Plus size={14}/>Hóa đơn</button></div><p>Thanh toán tạo giao dịch chi tiêu và chuyển ngày đến hạn sang tháng kế tiếp.</p>{!state.bills.length && <p>Chưa có hóa đơn hàng tháng.</p>}{state.bills.map(bill => <article className="card finance-bill" key={bill.id}><div><h4>{bill.name}</h4><p>{currency(bill.amount)} · {bill.category}</p><small>Đến hạn: {bill.dueDate} · Đã thanh toán {bill.paidDates.length} kỳ</small></div><button className="btn" disabled={busy || today().slice(0, 7) < bill.dueDate.slice(0, 7)} onClick={() => void mutate({ type: "bill.pay", billId: bill.id, date: today() })}>Ghi nhận thanh toán</button></article>)}</section>}
    {tab === "import" && <section className="panel finance-import"><span className="eyebrow">NHẬP DỮ LIỆU · XÁC NHẬN TRƯỚC KHI LƯU</span><h3>Nhập giao dịch CSV</h3><p>Định dạng cột: date,kind,amount,category,note. Ngày theo mẫu YYYY-MM-DD; cột kind nhận giá trị income (thu nhập) hoặc expense (chi tiêu); số tiền nguyên VND, không có dấu phân cách.</p><label className="field">Tài khoản nhận dữ liệu<select value={importAccount} onChange={event => { setImportAccount(event.target.value); setPreview([]); }}>{accountOptions}</select></label><label className="field"><FileUp size={15}/>Chọn tệp CSV<input type="file" accept=".csv,text/csv" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 200000) { setError("Tệp tối đa 200 KB."); return; } setCsv(await file.text()); setPreview([]); }}/></label><textarea className="field" aria-label="Nội dung CSV" value={csv} onChange={event => { setCsv(event.target.value); setPreview([]); }} rows={6} maxLength={200000}/><button className="btn" disabled={busy || !importAccount} onClick={importPreview}>Kiểm tra & xem trước</button>{preview.length > 0 && <><p>{preview.length} dòng · {preview.filter(row => row.duplicate).length} trùng · {preview.filter(row => row.error).length} lỗi. Chỉ các dòng hợp lệ được chọn sẽ được nhập.</p><div className="list">{preview.map(row => <label className={`card finance-import-row ${row.error ? "is-invalid" : row.duplicate ? "is-duplicate" : ""}`} key={row.line}><input type="checkbox" disabled={row.duplicate || !!row.error} checked={selected.includes(row.line)} onChange={event => setSelected(lines => event.target.checked ? [...lines, row.line] : lines.filter(line => line !== row.line))}/><span>Dòng {row.line}: {row.error || `${row.row?.date} · ${row.row?.category} · ${currency(row.row?.amount ?? 0)}`}{row.duplicate && " · TRÙNG — sẽ bỏ qua"}</span></label>)}</div><button className="btn primary" disabled={busy || !selected.length} onClick={() => void mutate({ type: "import", rows: preview.filter(row => selected.includes(row.line) && row.row && !row.error && !row.duplicate).map(row => row.row!) })}>Xác nhận nhập {selected.length} giao dịch</button></>}</section>}
    {form && <section className="panel finance-form" role="dialog" aria-label={titles[form]}><div className="section-heading"><h3>{titles[form]}</h3><button className="btn" onClick={() => setForm(null)}>Hủy</button></div><form onSubmit={submit} className="finance-form-grid">
      {["account", "goal", "bill"].includes(form) && <label className="field">Tên<input name="name" required maxLength={120}/></label>}
      {form === "account" && <label className="field">Số dư ban đầu (VND)<input name="openingBalance" type="number" min="0" step="1" defaultValue="0" required/></label>}
      {["transaction", "bill", "reconcile"].includes(form) && accountSelect("accountId")}
      {form === "transaction" && <label className="field">Loại<select name="kind"><option value="expense">Chi tiêu</option><option value="income">Thu nhập</option></select></label>}
      {form === "transfer" && <>{accountSelect("fromId", "Từ tài khoản")}{accountSelect("toId", "Đến tài khoản")}</>}
      {form !== "account" && <label className="field">{form === "reconcile" ? "Số dư thực tế" : form === "goal" ? "Số tiền mục tiêu" : "Số tiền"} (VND)<input name="amount" type="number" min={form === "reconcile" ? undefined : "1"} step="1" required/></label>}
      {["transaction", "budget", "bill"].includes(form) && <label className="field">Danh mục<input name="category" list="finance-categories" required maxLength={120}/><datalist id="finance-categories">{["Ăn uống", "Di chuyển", "Nhà ở", "Sức khỏe", "Học tập", "Giải trí", "Lương", "Khác"].map(value => <option key={value} value={value}/>)}</datalist></label>}
      {form === "budget" && <label className="field">Tháng<input name="month" type="month" defaultValue={month} required/></label>}
      {["transaction", "transfer", "bill", "reconcile"].includes(form) && <label className="field">{form === "bill" ? "Ngày đến hạn đầu tiên" : "Ngày ghi nhận"}<input name="date" type="date" defaultValue={today()} required/></label>}
      {["transaction", "transfer", "reconcile"].includes(form) && <label className="field">{form === "reconcile" ? "Lý do điều chỉnh (bắt buộc)" : "Ghi chú"}<input name="note" maxLength={300} required={form === "reconcile"}/></label>}
      {form === "reconcile" && <p>Chênh lệch được ghi thành giao dịch điều chỉnh, không xóa lịch sử và không tính là thu nhập/chi tiêu.</p>}
      <button className="btn primary" disabled={busy} type="submit">{busy ? "Đang xác nhận…" : "Xác nhận & lưu"}</button>
    </form></section>}
  </section>;
}

export default FinancePanel;


"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CircleDollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { financeReport, type FinanceState } from "@/finance";
import { hasLocalDemoFinanceData } from "@/finance/local-demo";

type FinanceTab = "overview" | "expense" | "income" | "goals";
type DailyFlow = { date: string; income: number; expense: number };

const currency = (value: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0,
}).format(value);
const localMonth = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit",
}).format(new Date());
const monthName = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, number - 1, 1)));
};
const previousMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
};

/** Only posted income and expense rows count. Transfers and adjustments are excluded. */
export function lobbyFinanceData(finance: FinanceState, month: string) {
  const report = financeReport(finance, month);
  const previous = financeReport(finance, previousMonth(month));
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, lastDay));
  const daily: DailyFlow[] = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(monthEnd);
    day.setUTCDate(day.getUTCDate() - (29 - index));
    const date = day.toISOString().slice(0, 10);
    const rows = finance.transactions.filter(row => row.date === date);
    return { date,
      income: rows.filter(row => row.kind === "income").reduce((sum, row) => sum + row.amount, 0),
      expense: rows.filter(row => row.kind === "expense").reduce((sum, row) => sum + row.amount, 0),
    };
  });
  const savingsPercent = report.income > 0 ? Math.max(0, Math.min(100, Math.round(report.net / report.income * 100))) : 0;
  return { report, previous, daily, savingsPercent,
    transactionCount: finance.transactions.filter(row => row.date.startsWith(month) && (row.kind === "income" || row.kind === "expense")).length,
  };
}

function changeText(current: number, previous: number) {
  if (previous <= 0) return "—";
  const change = Math.round((current - previous) / previous * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

export default function LobbyFinanceWidget({ finance, loading = false, error = false, onNavigate }: {
  finance: FinanceState | null;
  loading?: boolean;
  error?: boolean;
  onNavigate: (screen: string) => void;
}) {
  const [month, setMonth] = useState(localMonth);
  const [tab, setTab] = useState<FinanceTab>("overview");
  const data = useMemo(() => finance ? lobbyFinanceData(finance, month) : null, [finance, month]);
  const rows = finance?.transactions.filter(row => row.date.startsWith(month)) ?? [];
  const empty = !data?.transactionCount;
  const tabs: { id: FinanceTab; label: string }[] = [
    { id: "overview", label: "Tổng quan" }, { id: "expense", label: "Chi tiêu" },
    { id: "income", label: "Thu nhập" }, { id: "goals", label: "Mục tiêu" },
  ];

  return <div className="lfin-widget">
    <style>{`
      .lfin-widget{min-width:0;height:100%;display:flex;flex-direction:column;gap:clamp(6px,.55vw,10px);color:#ebfbff;font-variant-numeric:tabular-nums}
      .lfin-widget button,.lfin-widget input{font:inherit}
      .lfin-content{display:flex;flex:1;flex-direction:column;gap:clamp(6px,.55vw,10px);min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#334155 transparent}
      .lfin-content::-webkit-scrollbar{width:5px}.lfin-content::-webkit-scrollbar-thumb{background:#334155;border-radius:5px}
      .lfin-content>.lfin-totals,.lfin-content>.lfin-more{flex:none}.lfin-content>.lfin-main{min-height:85px;flex:1 0 85px}
      .lfin-head,.lfin-head-title,.lfin-tabs,.lfin-totals,.lfin-stat>div,.lfin-legend,.lfin-more{display:flex;align-items:center}
      .lfin-head{justify-content:space-between;gap:8px}.lfin-head-title{gap:7px;min-width:0}.lfin-head-title svg{color:#48f1ba;filter:drop-shadow(0 0 8px #31ffc999)}
      .lfin-head h3{margin:0;font-size:clamp(12px,.9vw,19px);white-space:nowrap;color:#f0fcff}.lfin-sample{padding:2px 5px;border:1px solid #ffca628c;border-radius:4px;color:#ffdc88;background:#4c2c1655;font-size:clamp(8px,.5vw,10px);white-space:nowrap}.lfin-month{position:relative;display:flex;align-items:center;gap:4px;padding:4px 7px;border:1px solid #52d6ef80;border-radius:5px;background:#08162b66;color:#bce9fc;font-size:clamp(9px,.58vw,11px);white-space:nowrap}
      .lfin-month input{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer}.lfin-month:focus-within{outline:2px solid #72e8ff;outline-offset:2px}
      .lfin-tabs{gap:4px;overflow-x:auto;scrollbar-width:thin}.lfin-tabs button{flex:1;min-width:max-content;padding:5px 6px;border:1px solid #3b8db680;border-radius:4px;background:#08153066;color:#c5d6eb;font-size:clamp(9px,.58vw,11px);cursor:pointer}
      .lfin-tabs button[aria-selected=true]{border-color:#53eac6;color:#f8fffd;background:#0a8c8f52;box-shadow:0 0 12px #14eac855,inset 0 0 9px #10d6c729}
      .lfin-totals{gap:clamp(5px,.5vw,10px);min-width:0}.lfin-stat{flex:1;min-width:0;padding:6px 7px;border:1px solid #1cdabc52;border-radius:5px;background:#07182b66}.lfin-stat.expense{border-color:#fc5fb455}.lfin-stat span{display:block;color:#bdd1dd;font-size:clamp(8px,.52vw,10px)}.lfin-stat>div{justify-content:space-between;gap:3px}.lfin-stat strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:clamp(10px,.8vw,16px);white-space:nowrap;color:#6bffd5}.lfin-stat.expense strong{color:#ff78bb}.lfin-stat small{font-size:clamp(8px,.5vw,10px);color:#b3c6d4}.lfin-stat svg{width:13px;height:13px;flex:none}
      .lfin-main{display:grid;grid-template-columns:minmax(0,1fr) clamp(68px,6vw,112px);gap:9px;min-height:0;flex:1}.lfin-bars{display:flex;align-items:flex-end;gap:2px;min-width:0;min-height:54px;border-bottom:1px solid #64d9e277;padding:0 1px 3px}.lfin-day{flex:1;min-width:2px;height:100%;display:flex;align-items:flex-end;gap:1px}.lfin-day i{display:block;flex:1;min-width:1px;border-radius:2px 2px 0 0}.lfin-day i:first-child{background:linear-gradient(#67ffd7,#159dcb);box-shadow:0 0 6px #43ebd38a}.lfin-day i:last-child{background:linear-gradient(#ff81be,#dd307d);box-shadow:0 0 6px #ef539780}.lfin-bar-wrap{min-height:0;display:flex;flex-direction:column;gap:3px}.lfin-bar-labels,.lfin-legend{display:flex;justify-content:space-between;gap:7px;font-size:clamp(8px,.5vw,10px);color:#a9bdcb}.lfin-legend{justify-content:flex-start;flex-wrap:wrap}.lfin-legend i{display:inline-block;width:6px;height:6px;margin-right:3px;border-radius:50%;background:#55ebc8}.lfin-legend span:last-child i{background:#f66aad}
      .lfin-donut{position:relative;display:grid;place-items:center;align-self:center;aspect-ratio:1;width:min(100%,100px);border-radius:50%;background:conic-gradient(#54f6bd var(--lfin-percent),#f069bd var(--lfin-percent),#f069bd 100%);box-shadow:0 0 15px #54edb660}.lfin-donut:before{content:"";position:absolute;inset:11px;border-radius:50%;background:#071128}.lfin-donut div{position:relative;text-align:center}.lfin-donut strong{display:block;font-size:clamp(14px,1vw,20px);color:#79ffd5}.lfin-donut small{display:block;font-size:clamp(7px,.46vw,9px);color:#d1e4ed}
      .lfin-more{justify-content:space-between;gap:6px;width:100%;padding:5px 2px;border:0;border-top:1px solid #4cd6e447;background:transparent;color:#8debef;text-align:left;font-size:clamp(9px,.55vw,11px);cursor:pointer}.lfin-more:hover{color:#fff}.lfin-more:focus-visible,.lfin-tabs button:focus-visible{outline:2px solid #76f5f1;outline-offset:2px}
      .lfin-empty,.lfin-list{flex:1;min-height:0;overflow:auto;color:#b3cfde;font-size:clamp(9px,.56vw,11px)}.lfin-empty{display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;border:1px dashed #67b6d780;border-radius:5px}.lfin-list{display:grid;align-content:start;gap:4px}.lfin-row{display:flex;justify-content:space-between;gap:8px;padding:5px 6px;border:1px solid #409fc655;background:#091a3266}.lfin-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lfin-row b{color:#72efdc;white-space:nowrap}.lfin-row.expense b{color:#ff81b7}
      @media(max-width:680px){.lfin-head{flex-wrap:wrap}.lfin-main{grid-template-columns:minmax(0,1fr) 80px}.lfin-widget{min-height:250px}}
    `}</style>
    <div className="lfin-head"><div className="lfin-head-title"><CircleDollarSign size={20} aria-hidden="true"/><h3>Tài chính <small>(Tiền thật)</small></h3>{finance && hasLocalDemoFinanceData(finance) && <span className="lfin-sample">Dữ liệu mẫu</span>}</div><label className="lfin-month"><CalendarDays size={12} aria-hidden="true"/><span>{monthName(month)}</span><input type="month" value={month} onChange={event => setMonth(event.target.value)} aria-label="Chọn tháng tài chính"/></label></div>
    <div className="lfin-tabs" role="tablist" aria-label="Chế độ xem tài chính">{tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    <div className="lfin-content">{!data ? <div className="lfin-empty" role="status">{error ? "Không thể tải sổ tài chính." : loading ? "Đang đồng bộ tài chính..." : "Chưa có dữ liệu tài chính."}</div> : tab === "overview" ? <>
      <div className="lfin-totals"><div className="lfin-stat"><span>Thu nhập</span><div><strong>{currency(data.report.income)}</strong><TrendingUp aria-hidden="true"/></div><small>{changeText(data.report.income, data.previous.income)} so với tháng trước</small></div><div className="lfin-stat expense"><span>Chi tiêu</span><div><strong>{currency(data.report.expense)}</strong><TrendingDown aria-hidden="true"/></div><small>{changeText(data.report.expense, data.previous.expense)} so với tháng trước</small></div></div>
      {empty ? <div className="lfin-empty">Chưa có giao dịch trong tháng. Biểu đồ sẽ hiện khi bạn ghi thu nhập hoặc chi tiêu.</div> : <div className="lfin-main"><div className="lfin-bar-wrap"><div className="lfin-bars" role="img" aria-label={`Dòng tiền ${data.daily.length} ngày: thu ${currency(data.report.income)}, chi ${currency(data.report.expense)}`}>{data.daily.map(day => { const peak = Math.max(1, ...data.daily.flatMap(row => [row.income, row.expense])); return <span className="lfin-day" key={day.date}><i style={{height:`${Math.max(day.income ? 4 : 0,day.income / peak * 100)}%`}} title={`${day.date}: thu ${currency(day.income)}`}/><i style={{height:`${Math.max(day.expense ? 4 : 0,day.expense / peak * 100)}%`}} title={`${day.date}: chi ${currency(day.expense)}`}/></span>; })}</div><div className="lfin-bar-labels"><span>{data.daily[0]?.date.slice(-2)}</span><span>{data.daily.at(-1)?.date.slice(-2)}</span></div><div className="lfin-legend"><span><i/>Thu nhập</span><span><i/>Chi tiêu</span></div></div><div className="lfin-donut" style={{"--lfin-percent":`${data.savingsPercent}%`} as React.CSSProperties} role="img" aria-label={`Tỷ lệ tiết kiệm ${data.savingsPercent}%`}><div><strong>{data.savingsPercent}%</strong><small>Tiết kiệm</small></div></div></div>}
    </> : tab === "goals" ? <div className="lfin-list">{finance!.goals.length ? finance!.goals.slice(0,4).map(goal => <div className="lfin-row" key={goal.id}><span>{goal.name}</span><b>{currency(goal.saved)} / {currency(goal.target)}</b></div>) : <div className="lfin-empty">Chưa có mục tiêu tiết kiệm.</div>}</div> : <div className="lfin-list">{rows.filter(row => row.kind === tab).length ? rows.filter(row => row.kind === tab).slice(-4).reverse().map(row => <div className={`lfin-row ${tab}`} key={row.id}><span>{row.date.slice(-2)} · {row.category}</span><b>{tab === "income" ? "+" : "−"}{currency(row.amount)}</b></div>) : <div className="lfin-empty">Chưa có {tab === "income" ? "thu nhập" : "chi tiêu"} trong tháng.</div>}</div>}
    <button type="button" className="lfin-more" onClick={() => onNavigate("finance")}>Mở sổ tài chính và ghi giao dịch <ArrowRight size={14} aria-hidden="true"/></button></div>
  </div>;
}

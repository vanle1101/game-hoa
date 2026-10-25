"use client";

import { useId } from "react";
import { ChartNoAxesCombined, ChartPie } from "lucide-react";
import type { FinanceState } from "@/finance";
import "./reference-ui.css";

const colors = ["#75d9e3", "#b19aff", "#ef93c8", "#eac18a", "#8cd7b7", "#a2b5cf"];
const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

export default function FinanceCharts({ state, month }: { state: FinanceState; month: string }) {
  const id = useId().replace(/:/g, ""), rows = state.transactions.filter(t => t.date.startsWith(month)), days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => rows.filter(t => Number(t.date.slice(-2)) === i + 1).reduce((s, t) => s + (t.kind === "income" ? t.amount : t.kind === "expense" ? -t.amount : 0), 0));
  const cumulative = daily.map((_, i) => daily.slice(0, i + 1).reduce((a, b) => a + b, 0)), max = Math.max(1, ...cumulative), min = Math.min(0, ...cumulative), range = max - min;
  const y = (v: number) => 150 - (v - min) / range * 125, points = cumulative.map((v, i) => `${20 + i / (days - 1) * 560},${y(v)}`).join(" ");
  const categories = Object.entries(rows.filter(t => t.kind === "expense").reduce<Record<string, number>>((a, t) => ({ ...a, [t.category]: (a[t.category] ?? 0) + t.amount }), {})).sort((a, b) => b[1] - a[1]);
  const total = categories.reduce((s, [, v]) => s + v, 0);

  return <div className="finance-chart-grid finance-chart-polished">
    <style>{`
      .finance-chart-polished { grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); align-items: start; }
      .finance-chart-polished > .panel { padding: clamp(18px, 2.4vw, 26px); border-radius: 16px; }
      .finance-chart-polished .finance-chart-heading h3 { font-size: 18px; }
      .finance-chart-polished .cashflow-summary { flex-wrap: wrap; gap: 4px 16px; }
      .finance-chart-polished .cashflow-total { overflow-wrap: anywhere; min-width: 0; }
      .finance-chart-polished .finance-period { color: #b5c1d1; letter-spacing: .02em; }
      .finance-chart-polished .cashflow-chart { min-height: 150px; }
      .finance-chart-polished .cashflow-chart text { fill: #c0cada; font-size: 12px; }
      .finance-chart-polished .cashflow-grid-line { stroke: #3a4352; }
      .finance-chart-polished .cashflow-line { stroke: #75d9e3; filter: none; stroke-linejoin: round; stroke-linecap: round; }
      .finance-chart-polished .cashflow-scale { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: #b5c1d1; font-size: 12px; font-variant-numeric: tabular-nums; }
      .finance-chart-polished .chart-empty { color: #b5c1d1; padding: 24px 12px; border-color: #3a4352; border-radius: 10px; }
      .finance-chart-polished .chart-empty strong { color: #edf1f7; }
      .finance-chart-polished .footnote { color: #b5c1d1; line-height: 1.7; margin-top: 18px; }
      .finance-chart-polished .expense-ring { width: 156px; max-width: 100%; margin: 20px auto; }
      .finance-chart-polished .expense-ring strong { font-size: 16px; letter-spacing: .06em; }
      .finance-chart-polished .expense-ring small { color: #b5c1d1; font-size: 10px; letter-spacing: .04em; }
      .finance-chart-polished .expense-ring-track { stroke: #343d4c; }
      .finance-chart-polished .expense-legend { gap: 12px; font-size: 13px; }
      .finance-chart-polished .expense-legend > div { grid-template-columns: 8px minmax(0,1fr) auto; padding-top: 12px; border-top: 1px solid var(--finance-line, #343d4c); }
      .finance-chart-polished .expense-legend span { white-space: normal; overflow-wrap: anywhere; color: #c0cada; }
      .finance-chart-polished .expense-legend strong { grid-column: 2; grid-row: 2; overflow-wrap: anywhere; }
      .finance-chart-polished .expense-legend small { grid-column: 3; grid-row: 1 / 3; color: #b5c1d1; font-size: 12px; }
      .finance-chart-polished .finance-empty-copy { color: #b5c1d1; }
      .finance-chart-polished .cashflow-data { margin-top: 16px; font-size: 12px; color: #c0cada; }
      .finance-chart-polished .cashflow-data summary { cursor: pointer; padding: 10px 0; }
      .finance-chart-polished .cashflow-data summary:focus-visible { outline: 2px solid #75d9e3; outline-offset: 3px; }
      .finance-chart-polished .cashflow-data-scroll { overflow-x: auto; max-height: 260px; }
      .finance-chart-polished .cashflow-data table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
      .finance-chart-polished .cashflow-data th, .finance-chart-polished .cashflow-data td { padding: 9px 8px; text-align: right; border-bottom: 1px solid #343d4c; white-space: nowrap; }
      .finance-chart-polished .cashflow-data th:first-child, .finance-chart-polished .cashflow-data td:first-child { text-align: left; }
    `}</style>
    <section className="panel finance-cashflow">
      <div className="finance-chart-heading"><div><span className="eyebrow">DÒNG TIỀN THÁNG · VND</span><h3>Dòng tiền lũy kế</h3></div><ChartNoAxesCombined size={22} aria-hidden="true"/></div>
      <div className="cashflow-summary"><strong className="cashflow-total">{money(cumulative.at(-1) ?? 0)}</strong><span className="finance-period">Kỳ {month}</span></div>
      {rows.length ? <>
        {cumulative.length > 0 && <div className="cashflow-scale"><span>Cao nhất: {money(Math.max(...cumulative))}</span><span>Thấp nhất: {money(Math.min(...cumulative))}</span></div>}
        <svg className="cashflow-chart" role="img" aria-label={`Dòng tiền lũy kế tháng ${month}, ${money(cumulative.at(-1) ?? 0)}`} viewBox="0 0 600 180">
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#75d9e3" stopOpacity=".2"/><stop offset="1" stopColor="#75d9e3" stopOpacity="0"/></linearGradient></defs>
          {[25, 65, 105, 150].map(v => <line className="cashflow-grid-line" key={v} x1="20" x2="580" y1={v} y2={v}/>)}
          <polygon points={`20,${y(0)} ${points} 580,${y(0)}`} fill={`url(#${id})`}/>
          <line x1="20" x2="580" y1={y(0)} y2={y(0)} stroke="#a2b5cf" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"><title>Mốc 0 VND</title></line>
          <polyline className="cashflow-line" points={points} vectorEffect="non-scaling-stroke"/>
          <text x="20" y="175">01</text><text x={20 + 14 / (days - 1) * 560} y="175" textAnchor="middle">15</text><text x="580" y="175" textAnchor="end">{days}</text>
        </svg>
        <details className="cashflow-data"><summary>Xem số liệu theo ngày</summary><div className="cashflow-data-scroll"><table><caption>Dòng tiền trong kỳ {month} · VND</caption><thead><tr><th scope="col">Ngày</th><th scope="col">Thu − chi</th><th scope="col">Lũy kế</th></tr></thead><tbody>{daily.map((value, i) => <tr key={i}><td>{String(i + 1).padStart(2, "0")}</td><td>{money(value)}</td><td>{money(cumulative[i])}</td></tr>)}</tbody></table></div></details>
      </> : <div className="chart-empty"><ChartNoAxesCombined size={28} aria-hidden="true"/><strong>Chưa có dòng tiền trong kỳ</strong><span>Biểu đồ sẽ hiển thị khi có giao dịch trong tháng.</span></div>}
      <p className="footnote">Thu nhập trừ chi tiêu. Chuyển khoản nội bộ và đối soát không tính vào dòng tiền này.{rows.length > 0 && " Đường nét đứt là mốc 0 VND."}</p>
    </section>
    <section className="panel finance-composition">
      <div className="finance-chart-heading"><div><span className="eyebrow">PHÂN BỔ CHI TIÊU</span><h3>Cơ cấu chi tiêu</h3></div><ChartPie size={22} aria-hidden="true"/></div>
      <strong className="cashflow-total">{money(total)}</strong>
      <div className="expense-ring">
        <svg viewBox="0 0 140 140" role="img" aria-label={`Tổng chi tiêu ${money(total)}`}>
          <circle className="expense-ring-track" cx="70" cy="70" r="53"/>
          {categories.map(([name, value], i) => {
            const before = categories.slice(0, i).reduce((s, [, v]) => s + v, 0) / total;
            return <circle key={name} cx="70" cy="70" r="53" fill="none" stroke={colors[i % colors.length]} strokeWidth="13" pathLength="100" strokeDasharray={`${value / total * 100} ${100 - value / total * 100}`} strokeDashoffset={-before * 100} transform="rotate(-90 70 70)"><title>{`${name}: ${money(value)}`}</title></circle>;
          })}
        </svg>
        <strong aria-hidden="true">VND<small>CHI TIÊU THÁNG</small></strong>
      </div>
      <div className="expense-legend">{categories.length ? categories.map(([name, value], i) => <div key={name}><i aria-hidden="true" style={{ background: colors[i % colors.length] }}/><span>{name}</span><strong>{money(value)}</strong><small>{Math.round(value / total * 100)}%</small></div>) : <p className="finance-empty-copy">Chưa có chi tiêu trong tháng này.</p>}</div>
    </section>
  </div>;
}

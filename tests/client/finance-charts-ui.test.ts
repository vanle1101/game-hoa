import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FinanceCharts from "@/components/game/FinanceCharts";
import { emptyFinance, type Transaction } from "@/finance";

const money = (value: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0,
}).format(value);

function transaction(kind: Transaction["kind"], amount: number, date: string, category = "Sinh hoạt"): Transaction {
  return { id: `${kind}-${date}-${amount}-${category}`, accountId: "cash", kind, amount, date, category, note: "" };
}

function render(month: string, transactions: Transaction[] = []) {
  const state = { ...emptyFinance(), transactions };
  const before = structuredClone(state);
  const html = renderToStaticMarkup(createElement(FinanceCharts, { state, month }));
  expect(state).toEqual(before);
  for (const svg of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)) {
    expect(svg[0]).not.toMatch(/NaN|Infinity|undefined/);
  }
  return html;
}

function assertDaily(html: string, month: string, daily: number[]) {
  let sum = 0;
  const cumulative = daily.map(value => (sum += value));
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  expect(body).toBeDefined();
  const actual = Array.from(body!.matchAll(/<tr>([\s\S]*?)<\/tr>/g), row =>
    Array.from(row[1].matchAll(/<td>([^<]*)<\/td>/g), cell => cell[1]));
  expect(actual).toEqual(daily.map((value, index) => [
    String(index + 1).padStart(2, "0"), money(value), money(cumulative[index]),
  ]));
  expect(html).toContain(`<caption>Dòng tiền trong kỳ ${month} · VND</caption>`);
  for (const heading of ["Ngày", "Thu − chi", "Lũy kế"]) {
    expect(html).toContain(`<th scope="col">${heading}</th>`);
  }
  expect(html).toContain("<summary>Xem số liệu theo ngày</summary>");
  expect(html).toContain(`aria-label="Dòng tiền lũy kế tháng ${month}, ${money(sum)}"`);
  const rawPoints = html.match(/<polyline[^>]*points="([^"]+)"/)?.[1];
  expect(rawPoints).toBeDefined();
  const points = rawPoints!.split(" ").map(point => point.split(",").map(Number));
  expect(points).toHaveLength(daily.length);
  const low = Math.min(0, ...cumulative);
  const high = Math.max(1, ...cumulative);
  points.forEach(([x, y], index) => {
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(x).toBeCloseTo(20 + index / (daily.length - 1) * 560, 8);
    expect(y).toBeCloseTo(150 - (cumulative[index] - low) / (high - low) * 125, 8);
  });
  expect(html).toContain(`<title>Mốc 0 VND</title>`);
}

function assertExpenses(html: string, total: number, categories: [string, number][]) {
  expect(html).toContain(`aria-label="Tổng chi tiêu ${money(total)}"`);
  const legend = html.match(/<div class="expense-legend">([\s\S]*?)<\/section>/)?.[1];
  expect(legend).toBeDefined();
  const rows = Array.from(legend!.matchAll(/<span>([^<]*)<\/span><strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g), row => row.slice(1));
  expect(rows).toEqual(categories.map(([name, value]) => [name, money(value), `${Math.round(value / total * 100)}%`]));
  const arcs = Array.from(html.matchAll(/<circle[^>]*stroke-dasharray="([^"]+)"/g), match => match[1].split(" ").map(Number));
  expect(arcs).toHaveLength(categories.length);
  arcs.forEach(([portion, rest], index) => {
    expect(portion).toBeCloseTo(categories[index][1] / total * 100, 8);
    expect(portion + rest).toBeCloseTo(100, 8);
  });
}

describe("finance chart actual rendered data", () => {
  it("shows honest empty states without invented transactions or chart points", () => {
    const html = render("2026-02");
    expect(html).toContain("Chưa có dòng tiền trong kỳ");
    expect(html).toContain("Chưa có chi tiêu trong tháng này.");
    expect(html).not.toContain("<polyline");
    expect(html).not.toContain("<tbody>");
    assertExpenses(html, 0, []);
  });

  it("aggregates income and expense by date, excludes transfer/adjustment and other months", () => {
    const html = render("2026-02", [
      transaction("income", 1000, "2026-02-01"),
      transaction("income", 500, "2026-02-01"),
      transaction("expense", 300, "2026-02-01", "Ăn uống"),
      transaction("expense", 200, "2026-02-03", "Đi lại"),
      transaction("expense", 100, "2026-02-03", "Ăn uống"),
      transaction("transfer-in", 9000, "2026-02-02"),
      transaction("transfer-out", 9000, "2026-02-02"),
      transaction("adjustment", -7000, "2026-02-04"),
      transaction("income", 999999, "2026-01-31"),
      transaction("expense", 888888, "2026-03-01", "Ngoài kỳ"),
    ]);
    assertDaily(html, "2026-02", [1200, 0, -300, ...Array<number>(25).fill(0)]);
    assertExpenses(html, 600, [["Ăn uống", 400], ["Đi lại", 200]]);
    expect(html).not.toContain("Ngoài kỳ");
  });

  it("keeps transfer-only months at zero without fake expense arcs", () => {
    const html = render("2026-04", [transaction("transfer-in", 800000, "2026-04-10"), transaction("transfer-out", 800000, "2026-04-10")]);
    assertDaily(html, "2026-04", Array<number>(30).fill(0));
    assertExpenses(html, 0, []);
    expect(html).toContain("Chuyển khoản nội bộ và đối soát không tính vào dòng tiền này.");
  });

  it("renders negative cumulative cashflow and its exact daily balances", () => {
    const html = render("2026-02", [transaction("expense", 900, "2026-02-01"), transaction("income", 200, "2026-02-02"), transaction("expense", 400, "2026-02-28")]);
    assertDaily(html, "2026-02", [-900, 200, ...Array<number>(25).fill(0), -400]);
    assertExpenses(html, 1300, [["Sinh hoạt", 1300]]);
    expect(html).toContain(`Cao nhất: ${money(-700)}`);
    expect(html).toContain(`Thấp nhất: ${money(-1100)}`);
  });

  it("preserves large safe monetary amounts and a long category without truncating data", () => {
    const category = "Chi phí chăm sóc sức khỏe và học tập dài hạn của gia đình trong tháng";
    const html = render("2026-02", [transaction("income", 4000000000000, "2026-02-01"), transaction("expense", 1750000000000, "2026-02-02", category)]);
    assertDaily(html, "2026-02", [4000000000000, -1750000000000, ...Array<number>(26).fill(0)]);
    assertExpenses(html, 1750000000000, [[category, 1750000000000]]);
    expect(html).toContain(`<title>${category}: ${money(1750000000000)}</title>`);
  });

  it.each([["2024-02", 29], ["2026-02", 28]] as const)("uses the exact calendar length for %s", (month, days) => {
    const daily = Array<number>(days).fill(0);
    daily[days - 1] = 42;
    const html = render(month, [transaction("income", 42, `${month}-${days}`)]);
    assertDaily(html, month, daily);
    assertExpenses(html, 0, []);
    expect(html).toContain(`text-anchor="end">${days}</text>`);
  });
});

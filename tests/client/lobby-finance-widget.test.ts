import { describe, expect, it } from "vitest";
import { emptyFinance, type FinanceState } from "@/finance";
import { lobbyFinanceData } from "@/components/game/LobbyFinanceWidget";

function ledger(): FinanceState {
  const finance = emptyFinance();
  finance.accounts = [{ id: "bank", name: "Ngân hàng", openingBalance: 0, balance: 8_000_000, currency: "VND" }];
  finance.transactions = [
    { id: "previous", accountId: "bank", kind: "income", amount: 2_000_000, category: "Lương", note: "", date: "2026-09-18" },
    { id: "income", accountId: "bank", kind: "income", amount: 10_000_000, category: "Lương", note: "", date: "2026-10-02" },
    { id: "expense", accountId: "bank", kind: "expense", amount: 3_000_000, category: "Ăn uống", note: "", date: "2026-10-30" },
    { id: "transfer", accountId: "bank", kind: "transfer-out", amount: 1_000_000, category: "Chuyển khoản", note: "", date: "2026-10-30" },
  ];
  return finance;
}

describe("LobbyFinanceWidget real-data aggregation", () => {
  it("uses posted income and expense only, with previous-month comparison", () => {
    const data = lobbyFinanceData(ledger(), "2026-10");
    expect(data.report).toMatchObject({ income: 10_000_000, expense: 3_000_000, net: 7_000_000, balance: 8_000_000 });
    expect(data.previous.income).toBe(2_000_000);
    expect(data.savingsPercent).toBe(70);
    expect(data.transactionCount).toBe(2);
    expect(data.daily).toHaveLength(30);
    expect(data.daily[0]).toEqual({ date: "2026-10-02", income: 10_000_000, expense: 0 });
    expect(data.daily.at(-1)).toEqual({ date: "2026-10-31", income: 0, expense: 0 });
    expect(data.daily.find(day => day.date === "2026-10-30")).toMatchObject({ expense: 3_000_000 });
  });

  it("reports an honestly empty period without inventing transactions", () => {
    const data = lobbyFinanceData(emptyFinance(), "2026-02");
    expect(data.report.income).toBe(0);
    expect(data.savingsPercent).toBe(0);
    expect(data.transactionCount).toBe(0);
    expect(data.daily).toHaveLength(30);
    expect(data.daily[0]?.date).toBe("2026-01-30");
    expect(data.daily.every(day => day.income === 0 && day.expense === 0)).toBe(true);
  });
});

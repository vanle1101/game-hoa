import { describe, expect, it } from "vitest";
import { emptyFinance, financeReport } from "@/finance";
import { hasLocalDemoFinanceData, isPristineFinance, seedLocalDemoFinance } from "@/finance/local-demo";

const now = new Date("2026-10-27T05:00:00.000Z");

describe("opt-in local finance demo", () => {
  it("seeds an internally balanced ledger and clearly identifies every illustrative transaction", () => {
    const state = seedLocalDemoFinance(null, "local-demo-player", true, now);
    expect(state.accounts).toHaveLength(1);
    expect(state.transactions.length).toBeGreaterThan(10);
    expect(state.transactions.every(row => row.note.startsWith("Dữ liệu mẫu · "))).toBe(true);
    expect(state.transactions.every(row => row.date <= "2026-10-27")).toBe(true);
    expect(state.accounts[0].balance).toBe(state.accounts[0].openingBalance + state.transactions.reduce(
      (sum, row) => sum + (row.kind === "income" ? row.amount : -row.amount), 0));
    expect(financeReport(state, "2026-10").income).toBeGreaterThan(0);
    expect(financeReport(state, "2026-10").expense).toBeGreaterThan(0);
    expect(hasLocalDemoFinanceData(state)).toBe(true);
    expect(seedLocalDemoFinance(state, "local-demo-player", true, now)).toBe(state);
  });

  it("never changes actual accounts or any existing finance configuration", () => {
    const existing = emptyFinance();
    existing.accounts.push({ id: "real", name: "My bank", openingBalance: 500, balance: 500, currency: "VND" });
    expect(seedLocalDemoFinance(existing, "local-demo-player", true, now)).toBe(existing);
    expect(hasLocalDemoFinanceData(existing)).toBe(false);
    const configured = emptyFinance();
    configured.goals.push({ id: "goal", name: "Emergency", target: 1_000_000, saved: 0 });
    expect(isPristineFinance(configured)).toBe(false);
    expect(seedLocalDemoFinance(configured, "local-demo-player", true, now)).toBe(configured);
  });

  it("does not seed a production account or an ordinary local player", () => {
    expect(seedLocalDemoFinance(null, "local-demo-player", false, now)).toEqual(emptyFinance());
    expect(seedLocalDemoFinance(null, "local-player", true, now)).toEqual(emptyFinance());
  });
});

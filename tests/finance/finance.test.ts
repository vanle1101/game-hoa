import { describe, expect, it } from "vitest";
import { applyFinance, emptyFinance, financeReport, previewImport, safeAdd, type FinanceCommand, type FinanceState } from "../../src/finance";

function harness() {
  let seq = 0; let state = emptyFinance();
  const run = (command: FinanceCommand, key = `request-${++seq}`) => state = applyFinance(state, command, key, () => `id-${++seq}`);
  const account = (name = "Ngân hàng", openingBalance = 1_000_000) => { run({ type: "account.create", name, openingBalance }); return state.accounts.at(-1)!.id; };
  return { run, account, state: () => state };
}
describe("private finance ledger", () => {
  it("stores exact integer VND and rejects fractional/unsafe amounts", () => {
    const h = harness(); const accountId = h.account();
    h.run({ type: "transaction.create", accountId, kind: "expense", amount: 99_999, category: "Ăn uống", date: "2026-10-15", note: "" });
    expect(h.state().accounts[0].balance).toBe(900_001);
    expect(() => h.run({ type: "transaction.create", accountId, kind: "income", amount: 0.1, category: "Lương", date: "2026-10-15", note: "" })).toThrow();
    expect(() => safeAdd(Number.MAX_SAFE_INTEGER, 1)).toThrow("giới hạn");
  });
  it("retries are idempotent and cannot reuse key for a different payload", () => {
    const h = harness(); const accountId = h.account();
    const command: FinanceCommand = { type: "transaction.create", accountId, kind: "income", amount: 50_000, category: "Lương", date: "2026-10-15", note: "" };
    h.run(command, "same-key"); h.run(command, "same-key");
    expect(h.state().transactions).toHaveLength(1); expect(h.state().accounts[0].balance).toBe(1_050_000);
    expect(() => h.run({ ...command, amount: 70_000 }, "same-key")).toThrow("nội dung khác");
  });
  it("transfers preserve total balance and do not inflate income or expense", () => {
    const h = harness(); const fromId = h.account(); const toId = h.account("Ví tiền", 0);
    h.run({ type: "transfer", fromId, toId, amount: 250_000, date: "2026-10-15", note: "Rút ATM" });
    expect(h.state().accounts.map(a => a.balance)).toEqual([750_000, 250_000]);
    expect(financeReport(h.state(), "2026-10")).toMatchObject({ income: 0, expense: 0, balance: 1_000_000 });
    expect(h.state().transactions[0].transferId).toBe(h.state().transactions[1].transferId);
    expect(() => h.run({ type: "transfer", fromId, toId: fromId, amount: 1, date: "2026-10-15", note: "" })).toThrow("khác nhau");
  });
  it("failed transfer is atomic and rejects unowned destination", () => {
    const h = harness(); const fromId = h.account(); const prior = structuredClone(h.state());
    expect(() => h.run({ type: "transfer", fromId, toId: "foreign", amount: 5000, date: "2026-10-15", note: "" })).toThrow();
    expect(h.state()).toEqual(prior);
  });
  it("CSV preview marks existing and same-file duplicates; import stays atomic", () => {
    const h = harness(); const accountId = h.account();
    const row = { accountId, kind: "expense" as const, amount: 50000, category: "Ăn uống", date: "2026-10-15", note: "Trưa" };
    const preview = previewImport(h.state(), [row, row, { ...row, amount: 0.1 }]);
    expect(preview.map(p => p.duplicate)).toEqual([false, true, false]); expect(preview[2].error).not.toBe("");
    h.run({ type: "import", rows: [row] });
    expect(previewImport(h.state(), [row])[0].duplicate).toBe(true);
    const prior = structuredClone(h.state());
    expect(() => h.run({ type: "import", rows: [{ ...row, amount: 1 }, row] })).toThrow("trùng");
    expect(h.state()).toEqual(prior);
  });
  it("reconciliation preserves history and is excluded from cashflow", () => {
    const h = harness(); const accountId = h.account();
    h.run({ type: "reconcile", accountId, actualBalance: 999_500, date: "2026-10-15", note: "Phí ngân hàng cần đối soát" });
    expect(h.state().accounts[0].balance).toBe(999_500); expect(h.state().transactions[0].amount).toBe(-500);
    expect(financeReport(h.state(), "2026-10")).toMatchObject({ income: 0, expense: 0 });
    expect(() => h.run({ type: "reconcile", accountId, actualBalance: 999_500, date: "2026-10-15", note: "Đã khớp" })).toThrow("đã khớp");
  });
  it("budget reports respect month and savings tracking never moves balances", () => {
    const h = harness(); const accountId = h.account();
    h.run({ type: "budget.set", category: "Ăn uống", amount: 2_000_000, month: "2026-10" });
    h.run({ type: "transaction.create", accountId, kind: "expense", amount: 50000, category: "Ăn uống", date: "2026-09-30", note: "" });
    h.run({ type: "transaction.create", accountId, kind: "expense", amount: 100000, category: "Ăn uống", date: "2026-10-01", note: "" });
    expect(financeReport(h.state(), "2026-10").categories).toEqual({ "Ăn uống": 100000 });
    h.run({ type: "goal.create", name: "Quỹ dự phòng", target: 1_000_000 });
    const balance = h.state().accounts[0].balance; const goalId = h.state().goals[0].id;
    h.run({ type: "goal.save", goalId, amount: 500000 }); expect(h.state().accounts[0].balance).toBe(balance);
    expect(() => h.run({ type: "goal.save", goalId, amount: 500001 })).toThrow("vượt");
  });
  it("monthly bill pays once per period and clamps end-of-month dates", () => {
    const h = harness(); const accountId = h.account();
    h.run({ type: "bill.create", name: "Internet", accountId, amount: 200000, category: "Nhà ở", dueDate: "2026-01-31" }); const billId = h.state().bills[0].id;
    h.run({ type: "bill.pay", billId, date: "2026-01-31" }, "pay-bill");
    h.run({ type: "bill.pay", billId, date: "2026-01-31" }, "pay-bill");
    expect(h.state().bills[0].dueDate).toBe("2026-02-28"); expect(h.state().transactions).toHaveLength(1);
    expect(() => h.run({ type: "bill.pay", billId, date: "2026-01-31" })).toThrow("chưa đến");
  });
  it("rejects invalid calendar dates and game mutation fields", () => {
    const h = harness(); const accountId = h.account();
    expect(() => h.run({ type: "transaction.create", accountId, kind: "expense", amount: 1, category: "Khác", date: "2026-02-30", note: "" })).toThrow();
    expect(() => applyFinance(h.state(), { type: "account.create", name: "X", openingBalance: 0, gold: 10000 }, "bad", () => "id")).toThrow();
    expect(Object.keys(h.state())).not.toContain("game"); expect(Object.keys(h.state())).not.toContain("gold");
  });
  it("does not mutate caller state on overflowing destination", () => {
    const h = harness(); const fromId = h.account(); const toId = h.account("Max", Number.MAX_SAFE_INTEGER);
    const prior: FinanceState = structuredClone(h.state());
    expect(() => h.run({ type: "transfer", fromId, toId, amount: 1, date: "2026-10-15", note: "" })).toThrow("giới hạn");
    expect(h.state()).toEqual(prior);
  });
});

import { z } from "zod";

const money = z.number().int().safe().nonnegative();
const positiveMoney = z.number().int().safe().positive();
const name = z.string().trim().min(1).max(120);
const id = z.string().min(1).max(100);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const parsed = new Date(`${value}T00:00:00Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value; }, "Ngày không hợp lệ");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const transactionInput = z.object({ accountId: id, kind: z.enum(["income", "expense"]), amount: positiveMoney, category: name, note: z.string().trim().max(300).default(""), date }).strict();
export const financeCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("account.create"), name, openingBalance: money }).strict(),
  z.object({ type: z.literal("transaction.create"), ...transactionInput.shape }).strict(),
  z.object({ type: z.literal("transfer"), fromId: id, toId: id, amount: positiveMoney, date, note: z.string().max(300).default("") }).strict(),
  z.object({ type: z.literal("budget.set"), category: name, amount: positiveMoney, month }).strict(),
  z.object({ type: z.literal("goal.create"), name, target: positiveMoney }).strict(),
  z.object({ type: z.literal("goal.save"), goalId: id, amount: positiveMoney }).strict(),
  z.object({ type: z.literal("bill.create"), name, accountId: id, amount: positiveMoney, category: name, dueDate: date }).strict(),
  z.object({ type: z.literal("bill.pay"), billId: id, date }).strict(),
  z.object({ type: z.literal("reconcile"), accountId: id, actualBalance: z.number().int().safe(), date, note: name }).strict(),
  z.object({ type: z.literal("import"), rows: z.array(transactionInput).min(1).max(500) }).strict(),
]);
export type FinanceCommand = z.infer<typeof financeCommandSchema>;
export type ImportRow = z.infer<typeof transactionInput>;
export type Account = { id: string; name: string; openingBalance: number; balance: number; currency: "VND" };
export type Transaction = { id: string; accountId: string; kind: "income" | "expense" | "transfer-in" | "transfer-out" | "adjustment"; amount: number; category: string; note: string; date: string; transferId?: string; fingerprint?: string };
export type FinanceState = { version: 1; accounts: Account[]; transactions: Transaction[]; budgets: { category: string; amount: number; month: string }[]; goals: { id: string; name: string; target: number; saved: number }[]; bills: { id: string; name: string; accountId: string; amount: number; category: string; dueDate: string; paidDates: string[] }[]; applied: Record<string, string> };
export class FinanceError extends Error { constructor(message: string) { super(message); this.name = "FinanceError"; } }
export const emptyFinance = (): FinanceState => ({ version: 1, accounts: [], transactions: [], budgets: [], goals: [], bills: [], applied: {} });
export function readFinance(value: unknown): FinanceState { if (!value) return emptyFinance(); if (typeof value !== "object" || !("version" in value) || value.version !== 1) throw new FinanceError("Dữ liệu tài chính cần được chuyển đổi phiên bản."); return value as FinanceState; }
export function safeAdd(a: number, b: number): number { const sum = a + b; if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(sum)) throw new FinanceError("Số tiền vượt giới hạn chính xác được hỗ trợ."); return sum; }
export function fingerprint(row: ImportRow): string { return JSON.stringify([row.accountId, row.date, row.kind, row.amount, row.category.toLocaleLowerCase("vi"), row.note.trim().toLocaleLowerCase("vi")]); }
export function applyFinance(current: FinanceState, raw: unknown, requestId: string, newId: () => string): FinanceState {
  const command = financeCommandSchema.parse(raw);
  if (!requestId || requestId.length > 100) throw new FinanceError("Thiếu mã thao tác hợp lệ.");
  const encoded = JSON.stringify(command);
  if (current.applied[requestId]) { if (current.applied[requestId] !== encoded) throw new FinanceError("Mã thao tác đã được dùng cho nội dung khác."); return current; }
  const state = structuredClone(current);
  const account = (accountId: string) => { const found = state.accounts.find(a => a.id === accountId); if (!found) throw new FinanceError("Không tìm thấy tài khoản của bạn."); return found; };
  const addTransaction = (row: Omit<Transaction, "id">) => { const target = account(row.accountId); const delta = ["expense", "transfer-out"].includes(row.kind) ? -row.amount : row.amount; target.balance = safeAdd(target.balance, delta); state.transactions.unshift({ id: newId(), ...row }); };
  switch (command.type) {
    case "account.create": if (state.accounts.some(a => a.name.toLocaleLowerCase() === command.name.toLocaleLowerCase())) throw new FinanceError("Tên tài khoản đã tồn tại."); state.accounts.push({ id: newId(), name: command.name, currency: "VND", openingBalance: command.openingBalance, balance: command.openingBalance }); break;
    case "transaction.create": addTransaction({ ...command, fingerprint: fingerprint(command) }); break;
    case "transfer": { if (command.fromId === command.toId) throw new FinanceError("Hãy chọn hai tài khoản khác nhau."); account(command.fromId); account(command.toId); const transferId = newId(); const base = { amount: command.amount, date: command.date, category: "Chuyển khoản", note: command.note, transferId }; addTransaction({ ...base, accountId: command.fromId, kind: "transfer-out" }); addTransaction({ ...base, accountId: command.toId, kind: "transfer-in" }); break; }
    case "budget.set": state.budgets = [...state.budgets.filter(b => !(b.category === command.category && b.month === command.month)), { category: command.category, amount: command.amount, month: command.month }]; break;
    case "goal.create": state.goals.push({ id: newId(), name: command.name, target: command.target, saved: 0 }); break;
    case "goal.save": { const goal = state.goals.find(g => g.id === command.goalId); if (!goal) throw new FinanceError("Không tìm thấy mục tiêu."); const value = safeAdd(goal.saved, command.amount); if (value > goal.target) throw new FinanceError("Khoản ghi nhận vượt mục tiêu còn lại."); goal.saved = value; break; }
    case "bill.create": account(command.accountId); state.bills.push({ id: newId(), name: command.name, accountId: command.accountId, amount: command.amount, category: command.category, dueDate: command.dueDate, paidDates: [] }); break;
    case "bill.pay": { const bill = state.bills.find(b => b.id === command.billId); if (!bill) throw new FinanceError("Không tìm thấy hóa đơn."); if (command.date.slice(0, 7) < bill.dueDate.slice(0, 7)) throw new FinanceError("Hóa đơn kỳ này chưa đến tháng thanh toán."); if (bill.paidDates.includes(bill.dueDate)) throw new FinanceError("Kỳ hóa đơn này đã thanh toán."); addTransaction({ accountId: bill.accountId, kind: "expense", amount: bill.amount, category: bill.category, note: `Hóa đơn: ${bill.name} (${bill.dueDate})`, date: command.date }); bill.paidDates.push(bill.dueDate); const [year, monthNumber, day] = bill.dueDate.split("-").map(Number); const next = new Date(Date.UTC(year, monthNumber, 1)); const maxDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(); next.setUTCDate(Math.min(day, maxDay)); bill.dueDate = next.toISOString().slice(0, 10); break; }
    case "reconcile": { const target = account(command.accountId); const amount = safeAdd(command.actualBalance, -target.balance); if (!amount) throw new FinanceError("Số dư đã khớp, không cần điều chỉnh."); addTransaction({ accountId: target.id, kind: "adjustment", amount, category: "Đối soát", note: command.note, date: command.date }); break; }
    case "import": { const existing = new Set(state.transactions.filter(t => t.fingerprint).map(t => t.fingerprint)); for (const row of command.rows) { const key = fingerprint(row); if (existing.has(key)) throw new FinanceError("Tệp chứa giao dịch trùng. Hãy loại bỏ các dòng được đánh dấu trước khi nhập."); account(row.accountId); existing.add(key); } for (const row of command.rows) addTransaction({ ...row, fingerprint: fingerprint(row) }); break; }
  }
  state.applied[requestId] = encoded;
  return state;
}
export function financeReport(state: FinanceState, forMonth: string) {
  const rows = state.transactions.filter(t => t.date.startsWith(forMonth));
  const income = rows.filter(t => t.kind === "income").reduce((sum, t) => safeAdd(sum, t.amount), 0);
  const expense = rows.filter(t => t.kind === "expense").reduce((sum, t) => safeAdd(sum, t.amount), 0);
  const categories: Record<string, number> = {};
  for (const row of rows.filter(t => t.kind === "expense")) categories[row.category] = safeAdd(categories[row.category] ?? 0, row.amount);
  return { income, expense, net: safeAdd(income, -expense), balance: state.accounts.reduce((sum, a) => safeAdd(sum, a.balance), 0), categories };
}
export function previewImport(state: FinanceState, rawRows: unknown[]) {
  if (rawRows.length > 500) throw new FinanceError("Mỗi lần nhập tối đa 500 giao dịch.");
  const existing = new Set(state.transactions.filter(t => t.fingerprint).map(t => t.fingerprint));
  return rawRows.map((raw, index) => {
    const parsed = transactionInput.safeParse(raw);
    if (!parsed.success) return { line: index + 2, row: null, duplicate: false, error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
    if (!state.accounts.some(a => a.id === parsed.data.accountId)) return { line: index + 2, row: null, duplicate: false, error: "Tài khoản không tồn tại" };
    const key = fingerprint(parsed.data); const duplicate = existing.has(key); existing.add(key);
    return { line: index + 2, row: parsed.data, duplicate, error: "" };
  });
}

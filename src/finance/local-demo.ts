import { emptyFinance, readFinance, type FinanceState, type Transaction } from "./index";

const DEMO_ACCOUNT_ID = "local-demo:finance-account";
const DEMO_TRANSACTION_PREFIX = "local-demo:finance:";

export function isPristineFinance(state: FinanceState): boolean {
  return state.accounts.length === 0 && state.transactions.length === 0 &&
    state.budgets.length === 0 && state.goals.length === 0 && state.bills.length === 0 &&
    Object.keys(state.applied).length === 0;
}

export function hasLocalDemoFinanceData(state: FinanceState): boolean {
  return state.transactions.some(row => row.id.startsWith(DEMO_TRANSACTION_PREFIX));
}

/** Only the opt-in local mock player may receive illustrative private finance entries. */
export function seedLocalDemoFinance(value: unknown, userId: string, localDemo: boolean, now = new Date()): FinanceState {
  const current = readFinance(value);
  if (!localDemo || userId !== "local-demo-player" || !isPristineFinance(current)) return current;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const day = new Date(`${today}T00:00:00.000Z`);
  const specs: { offset: number; kind: "income" | "expense"; amount: number; category: string; note: string }[] = [
    { offset: -38, kind: "income", amount: 17_000_000, category: "Lương", note: "Lương tháng trước" },
    { offset: -35, kind: "expense", amount: 5_200_000, category: "Nhà ở", note: "Tiền nhà tháng trước" },
    { offset: -31, kind: "expense", amount: 1_100_000, category: "Ăn uống", note: "Ăn uống tháng trước" },
    { offset: -26, kind: "expense", amount: 780_000, category: "Di chuyển", note: "Di chuyển tháng trước" },
    { offset: -24, kind: "income", amount: 18_000_000, category: "Lương", note: "Lương" },
    { offset: -23, kind: "expense", amount: 1_500_000, category: "Ăn uống", note: "Mua thực phẩm" },
    { offset: -20, kind: "expense", amount: 320_000, category: "Di chuyển", note: "Di chuyển" },
    { offset: -19, kind: "expense", amount: 6_000_000, category: "Nhà ở", note: "Tiền nhà" },
    { offset: -16, kind: "income", amount: 2_400_000, category: "Dự án", note: "Dự án cá nhân" },
    { offset: -15, kind: "expense", amount: 750_000, category: "Ăn uống", note: "Ăn uống" },
    { offset: -12, kind: "expense", amount: 480_000, category: "Giải trí", note: "Xem phim" },
    { offset: -10, kind: "expense", amount: 230_000, category: "Di chuyển", note: "Di chuyển" },
    { offset: -8, kind: "expense", amount: 900_000, category: "Mua sắm", note: "Mua sắm" },
    { offset: -6, kind: "expense", amount: 340_000, category: "Ăn uống", note: "Ăn uống" },
    { offset: -4, kind: "income", amount: 1_600_000, category: "Dự án", note: "Thưởng dự án" },
    { offset: -3, kind: "expense", amount: 670_000, category: "Sức khỏe", note: "Phòng tập" },
    { offset: 0, kind: "expense", amount: 260_000, category: "Ăn uống", note: "Cà phê" },
  ];
  const transactions: Transaction[] = specs.map((entry, index) => {
    const date = new Date(day);
    date.setUTCDate(date.getUTCDate() + entry.offset);
    return {
      id: `${DEMO_TRANSACTION_PREFIX}${index + 1}`, accountId: DEMO_ACCOUNT_ID,
      kind: entry.kind, amount: entry.amount, category: entry.category,
      note: `Dữ liệu mẫu · ${entry.note}`, date: date.toISOString().slice(0, 10),
    };
  }).reverse();
  const openingBalance = 4_000_000;
  const balance = transactions.reduce((sum, entry) =>
    sum + (entry.kind === "income" ? entry.amount : -entry.amount), openingBalance);
  return {
    ...emptyFinance(),
    accounts: [{ id: DEMO_ACCOUNT_ID, name: "Tài khoản demo · Dữ liệu mẫu", openingBalance, balance, currency: "VND" }],
    transactions,
  };
}

import { z } from "zod";
import type { GameState } from "@/domain/types";
import type { FinanceState } from "@/finance";
import { safeAdd } from "@/finance";
import { buildingStateSchema } from "@/construction/schema";
import { constructionContext, validateConstruction } from "@/construction/engine";
import { meaningfulBossSchema } from "@/boss/schema";
import { appearanceSchema, cosmeticSlotSchema } from "@/character/schema";
import { COSMETICS, STARTER_COSMETICS } from "@/character/catalog";
import { HOUSING_BUILDINGS } from "@/housing/catalog";

const integer = z.number().int().safe();
const nonnegative = integer.nonnegative();
const text = z.string().max(10000);
const id = z.string().min(1).max(200);
const record = z.record(z.string(), z.unknown());
const identified = z.object({ id }).passthrough();
const gameSchema = z.object({
  version: z.literal(1), userId: id, revision: nonnegative, createdAt: z.iso.datetime(),
  character: z.object({ name: text, title: text, xp: nonnegative, hp: z.number().min(0).max(100), energy: z.number().min(0).max(100), mood: z.number().min(0).max(100), social: z.number().min(0).max(100), career: text, skillXp: z.record(z.string(), nonnegative), skillNodes: z.array(text), careerRank: nonnegative, skin: text, outfit: text, hair: text, hairstyle: z.enum(["short", "swept", "mohawk"]), appearance: appearanceSchema.optional() }).passthrough(),
  meaningfulBosses: z.array(meaningfulBossSchema).optional(), activeMeaningfulBossId: id.optional(), ownedCosmetics: z.array(id).optional(), equippedCosmetics: z.partialRecord(cosmeticSlotSchema, id).optional(),
  focusSessions: z.array(z.object({ id, occurrenceId: id, startedAt: z.iso.datetime(), endedAt: z.iso.datetime().optional(), confirmedAt: z.iso.datetime().optional(), status: z.enum(["running", "ended", "confirmed"]) }).strict()).optional(),
  gold: nonnegative, tasks: z.array(identified.extend({ title: text, archived: z.boolean() })), occurrences: z.array(identified.extend({ taskId: id, status: z.enum(["open", "completed", "missed", "canceled"]) })), campaigns: z.array(identified),
  bosses: z.array(identified.extend({ definitionId: id, hp: nonnegative, phase: z.union([z.literal(1), z.literal(2), z.literal(3)]) })), activeBossId: text,
  inventory: z.array(identified.extend({ definitionId: id, enhancement: integer.min(0).max(10) })), equipment: z.record(z.string(), id),
  materials: z.record(z.string(), nonnegative), ownedFurniture: z.record(z.string(), nonnegative), placements: z.array(identified.extend({ furnitureId: id, roomId: id, x: z.number().finite(), z: z.number().finite(), rotation: z.number().finite() })), unlockedRooms: z.array(id),
  pets: z.array(identified), achievements: z.array(id), journal: z.array(identified), ledger: z.array(identified.extend({ amount: integer, balance: nonnegative })),
  consumables: z.record(z.string(), nonnegative).optional(), activeBuffs: z.array(z.object({ id, attackBonus: nonnegative, remainingQuests: nonnegative })).optional(),
  realLifeRewards: z.array(z.object({ id, name: text, description: text, cost: nonnegative, redemptions: nonnegative, archived: z.boolean(), lastRedeemedAt: z.iso.datetime().optional() })).optional(),
  activePetId: id.optional(), ownedPetAccessories: z.array(id).optional(), petAccessories: z.record(z.string(), id).optional(), undoUnavailableReason: text.optional(),
  rewardBudgets: z.record(z.string(), z.object({ xp: nonnegative, gold: nonnegative, completed: nonnegative })),
  settings: z.object({ hardcore: z.boolean(), equipmentLossAccepted: z.boolean(), timezone: text, restDays: z.array(text), graphics: z.enum(["ultra", "high", "balanced", "performance"]), reducedMotion: z.boolean() }),
  undo: z.unknown().optional(),
  building: buildingStateSchema.optional(),
  residence: z.object({ districtId: z.literal("district07"), buildingId: id, floor: z.union([z.literal(8), z.literal(16), z.literal(24)]), layoutId: z.enum(["studio", "one-bedroom", "open-plan"]), completedAt: z.iso.datetime() }).strict().refine(value => HOUSING_BUILDINGS.some(building => building.id === value.buildingId && building.districtId === value.districtId), "Nơi ở không thuộc danh mục hợp lệ.").optional(),
  housingStarterEligible: z.boolean().optional(),
  starterCosmeticsVersion: nonnegative.optional(),
}).strict();
const financeSchema = z.object({
  version: z.literal(1), accounts: z.array(z.object({ id, name: text, openingBalance: nonnegative, balance: integer, currency: z.literal("VND") })),
  transactions: z.array(z.object({ id, accountId: id, kind: z.enum(["income", "expense", "transfer-in", "transfer-out", "adjustment"]), amount: integer, category: text, note: text, date: text, transferId: id.optional(), fingerprint: text.optional() }).passthrough()),
  budgets: z.array(z.object({ category: text, amount: nonnegative, month: text })), goals: z.array(z.object({ id, name: text, target: nonnegative, saved: nonnegative })),
  bills: z.array(z.object({ id, name: text, accountId: id, amount: nonnegative, category: text, dueDate: text, paidDates: z.array(text) })), applied: z.record(z.string(), z.string().max(250000)),
}).strict().nullable();
const backupSchema = z.object({ format: z.literal("life-level-backup"), version: z.literal(1), exportedAt: z.iso.datetime(), sourceUserId: id, game: gameSchema, finance: financeSchema, proposals: z.record(z.string(), record) }).strict();
export type BackupEnvelope = { format: "life-level-backup"; version: 1; exportedAt: string; sourceUserId: string; game: GameState; finance: FinanceState | null; proposals: Record<string, Record<string, unknown>> };
export class BackupError extends Error { constructor(message: string) { super(message); this.name = "BackupError"; } }
function safeStructure(value: unknown, depth = 0): void {
  if (depth > 40) throw new BackupError("Bản sao lưu có cấu trúc quá sâu.");
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value) && value.length > 100000) throw new BackupError("Bản sao lưu có quá nhiều bản ghi.");
  for (const [key, entry] of Object.entries(value)) { if (["__proto__", "constructor", "prototype"].includes(key)) throw new BackupError("Bản sao lưu chứa khóa không an toàn."); safeStructure(entry, depth + 1); }
}
function uniqueIds(rows: { id: string }[], label: string) { if (new Set(rows.map(row => row.id)).size !== rows.length) throw new BackupError(`${label}: mã bản ghi bị trùng.`); }
export function validateBackup(input: unknown): BackupEnvelope {
  safeStructure(input);
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) throw new BackupError(`Bản sao lưu không hợp lệ: ${parsed.error.issues.slice(0, 4).map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`);
  const data = parsed.data;
  if (data.game.userId !== data.sourceUserId) throw new BackupError("Chủ sở hữu bản sao lưu không khớp.");
  if (data.game.residence && data.game.housingStarterEligible === true) throw new BackupError("Nơi ở đã xác nhận không thể nhận lại gói khởi đầu.");
  for (const key of ["tasks", "occurrences", "campaigns", "bosses", "inventory", "placements", "pets", "journal", "ledger"] as const) uniqueIds(data.game[key], key);
  const itemIds = new Set(data.game.inventory.map(item => item.id));
  for (const itemId of Object.values(data.game.equipment)) if (!itemIds.has(itemId)) throw new BackupError("Trang bị tham chiếu vật phẩm không sở hữu.");
  const taskIds = new Set(data.game.tasks.map(task => task.id));
  if (data.game.meaningfulBosses) {
    uniqueIds(data.game.meaningfulBosses, "meaningfulBosses");
    for (const boss of data.game.meaningfulBosses) {
      if (boss.habit) { if (new Set(boss.habit.checkpoints.map((c) => c.date)).size !== boss.habit.checkpoints.length) throw new BackupError("Ngày xác nhận thói quen bị trùng."); if (boss.habit.taskId && !taskIds.has(boss.habit.taskId)) throw new BackupError("Boss tham chiếu nhiệm vụ không tồn tại."); }
      if (boss.project) for (const milestone of boss.project.milestones) if (!taskIds.has(milestone.taskId)) throw new BackupError("Mốc dự án tham chiếu nhiệm vụ không tồn tại.");
    }
  }
  const ownedCosmetics = data.game.ownedCosmetics ?? STARTER_COSMETICS;
  if (new Set(ownedCosmetics).size !== ownedCosmetics.length || ownedCosmetics.some((id) => !COSMETICS.some((item) => item.id === id))) throw new BackupError("Bộ sưu tập trang phục không hợp lệ.");
  for (const [slot, id] of Object.entries(data.game.equippedCosmetics ?? {})) if (!ownedCosmetics.includes(id!) || !COSMETICS.some((item) => item.id === id && item.slot === slot)) throw new BackupError("Trang phục chưa sở hữu hoặc sai vị trí.");
  for (const occurrence of data.game.occurrences) if (!taskIds.has(occurrence.taskId)) throw new BackupError("Lần thực hiện tham chiếu nhiệm vụ không tồn tại.");
  // Export preserves legitimately acquired structures after a later Hardcore level loss;
  // validate ownership/topology here, while new construction still checks unlocks on commit.
  if(data.game.building){try{const game=data.game as unknown as GameState;const context=constructionContext(game);validateConstruction(data.game.building,data.game.building.plan,{...context,characterLevel:Math.max(100,context.characterLevel),defeatedCampaign:true});}catch(error){throw new BackupError(`Công trình không hợp lệ: ${error instanceof Error?error.message:"validation failed"}`);}}
  if (data.finance) {
    const finance = data.finance; uniqueIds(finance.accounts, "accounts"); uniqueIds(finance.transactions, "transactions"); uniqueIds(finance.goals, "goals"); uniqueIds(finance.bills, "bills");
    const accountIds = new Set(finance.accounts.map(account => account.id));
    for (const row of finance.transactions) { if (!accountIds.has(row.accountId)) throw new BackupError("Giao dịch tham chiếu tài khoản không tồn tại."); if (row.kind !== "adjustment" && row.amount <= 0) throw new BackupError("Số tiền giao dịch không hợp lệ."); }
    for (const account of finance.accounts) {
      const expected = finance.transactions.filter(row => row.accountId === account.id).reduce((sum, row) => safeAdd(sum, ["expense", "transfer-out"].includes(row.kind) ? -row.amount : row.amount), account.openingBalance);
      if (expected !== account.balance) throw new BackupError("Số dư tài khoản không khớp sổ giao dịch.");
    }
    for (const goal of finance.goals) if (goal.saved > goal.target) throw new BackupError("Mục tiêu tiết kiệm không hợp lệ.");
    for (const bill of finance.bills) if (!accountIds.has(bill.accountId)) throw new BackupError("Hóa đơn tham chiếu tài khoản không tồn tại.");
  }
  return structuredClone(data) as unknown as BackupEnvelope;
}
export function createBackup(sourceUserId: string, game: GameState, finance: unknown, proposals: unknown, exportedAt = new Date().toISOString()): BackupEnvelope {
  return validateBackup({ format: "life-level-backup", version: 1, exportedAt, sourceUserId, game, finance, proposals });
}
export function parseBackup(json: string): BackupEnvelope {
  if (new TextEncoder().encode(json).length > 20_000_000) throw new BackupError("Bản sao lưu vượt giới hạn 20 MB.");
  let value: unknown; try { value = JSON.parse(json); } catch { throw new BackupError("Bản sao lưu không phải JSON hợp lệ."); }
  return validateBackup(value);
}
/** An isolated memory copy only. This utility has no database/filesystem dependencies or writes. */
export function restoreIsolated(json: string, sandboxId: string): { namespace: string; read: () => BackupEnvelope } {
  if (!/^test-[a-zA-Z0-9-]{1,80}$/.test(sandboxId)) throw new BackupError("Chỉ cho phép môi trường thử nghiệm test-*.");
  const snapshot = parseBackup(json);
  return { namespace: sandboxId, read: () => structuredClone(snapshot) };
}

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import { ZodError } from "zod";
import { applyFinance, FinanceError, financeCommandSchema, readFinance, type FinanceCommand, type FinanceState } from "@/finance";
import { actionSchema } from "@/domain/validation";
import type { Action, ActionResult } from "@/domain/types";
import { database } from "./database";
import { HttpError } from "./errors";
import { isLocalDevelopment } from "./runtime-mode";
import { commandIntents, guestClaims, playerStates } from "./schema";
import { gameCommand, readGame, readPrivate, updateFinance } from "./store";

type Domain = "game" | "finance";
type Intent = typeof commandIntents.$inferSelect;
type Payload = { action: Action } | { command: FinanceCommand };
const openStatuses = ["queued", "running", "failed"];
const leaseMs = 90_000;
const maxAttempts = 6;

function hash(domain: Domain, payload: Payload): string {
  return createHash("sha256").update(JSON.stringify({ domain, payload })).digest("hex");
}

function publicIntent(row: Intent) {
  return { key: row.key, domain: row.domain, status: row.status, command: row.domain === "game"
    ? (row.payload as { action: Action }).action : (row.payload as { command: FinanceCommand }).command,
    error: row.error, createdAt: row.createdAt };
}

/** Admission is serialized by the player row across all sessions of an account. */
async function admit(userId: string, domain: Domain, key: string, payload: Payload, expectedRevision?: number): Promise<void> {
  await readGame(userId);
  const fingerprint = hash(domain, payload);
  await database().transaction(async tx => {
    const [owner] = await tx.select({ revision: playerStates.revision }).from(playerStates)
      .where(eq(playerStates.userId, userId)).for("update");
    if (!owner) throw new HttpError(401, "Phiên người dùng không hợp lệ.");
    if (/^[a-f0-9]{64}$/.test(userId)) {
      const [claim] = await tx.select({ guestUserId: guestClaims.guestUserId }).from(guestClaims)
        .where(eq(guestClaims.guestUserId, userId));
      if (claim) throw new HttpError(409, "Dữ liệu khách đã chuyển vào tài khoản; hãy đăng nhập để tiếp tục.");
    }
    const [prior] = await tx.select().from(commandIntents).where(and(eq(commandIntents.userId, userId),
      eq(commandIntents.domain, domain), eq(commandIntents.key, key)));
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new HttpError(409, "Mã thao tác đã dùng cho nội dung khác.");
      if (prior.status === "failed") await tx.update(commandIntents).set({ status: "queued", attempts: 0,
        runAt: new Date(), error: null, updatedAt: new Date() }).where(and(eq(commandIntents.userId, userId),
        eq(commandIntents.domain, domain), eq(commandIntents.key, key)));
      return;
    }
    const [open] = await tx.select({ key: commandIntents.key }).from(commandIntents).where(and(
      eq(commandIntents.userId, userId), eq(commandIntents.domain, domain),
      inArray(commandIntents.status, openStatuses),
    )).limit(1);
    if (open) throw new HttpError(409, "Một thao tác đã được máy chủ tiếp nhận. Hãy đồng bộ lại trước khi tạo thao tác mới.");
    if (domain === "game" && expectedRevision !== undefined && owner.revision !== expectedRevision) {
      throw new HttpError(409, "Trạng thái đã thay đổi ở thiết bị khác. Hãy đồng bộ trước khi thao tác.");
    }
    await tx.insert(commandIntents).values({ userId, domain, key, fingerprint, payload });
  });
}

async function claimOne(workerId: string, target?: { userId: string; domain: Domain; key: string }): Promise<Intent | null> {
  const now = new Date();
  return database().transaction(async tx => {
    const ready = or(and(eq(commandIntents.status, "queued"), lte(commandIntents.runAt, now)),
      and(eq(commandIntents.status, "running"), lte(commandIntents.leaseUntil, now)));
    const criteria = target ? and(ready, eq(commandIntents.userId, target.userId),
      eq(commandIntents.domain, target.domain), eq(commandIntents.key, target.key)) : ready;
    const [row] = await tx.select().from(commandIntents).where(criteria)
      .orderBy(asc(commandIntents.createdAt)).limit(1).for("update", { skipLocked: true });
    if (!row) return null;
    if (row.attempts >= maxAttempts) {
      await tx.update(commandIntents).set({ status: "failed", lockedBy: null, leaseUntil: null,
        error: "Tác vụ cần được đồng bộ lại sau nhiều lần thử.", updatedAt: now }).where(and(
        eq(commandIntents.userId, row.userId), eq(commandIntents.domain, row.domain), eq(commandIntents.key, row.key)));
      return null;
    }
    const [claimed] = await tx.update(commandIntents).set({ status: "running", lockedBy: workerId,
      leaseUntil: new Date(now.getTime() + leaseMs), attempts: row.attempts + 1, updatedAt: now })
      .where(and(eq(commandIntents.userId, row.userId), eq(commandIntents.domain, row.domain),
        eq(commandIntents.key, row.key))).returning();
    return claimed;
  });
}

function identity(row: Intent) {
  return and(eq(commandIntents.userId, row.userId), eq(commandIntents.domain, row.domain), eq(commandIntents.key, row.key));
}

/** Domain mutation and its own idempotency receipt commit atomically in store.ts. */
async function execute(row: Intent): Promise<ActionResult | FinanceState> {
  if (row.domain === "game") {
    const action = actionSchema.parse((row.payload as { action: unknown }).action);
    return gameCommand(row.userId, row.key, action);
  }
  if (row.domain === "finance") {
    const command = financeCommandSchema.parse((row.payload as { command: unknown }).command);
    return updateFinance(row.userId, current => {
      const state = applyFinance(readFinance(current), command, row.key, randomUUID);
      return { state, result: state };
    });
  }
  throw new HttpError(422, "Loại thao tác không hợp lệ.");
}

async function finish(row: Intent, workerId: string, result: ActionResult | FinanceState): Promise<void> {
  const receipt = row.domain === "game" ? { events: (result as ActionResult).events, message: (result as ActionResult).message } : null;
  await database().update(commandIntents).set({ status: "applied", result: receipt, error: null, errorStatus: null,
    lockedBy: null, leaseUntil: null, updatedAt: new Date() }).where(and(identity(row),
    eq(commandIntents.status, "running"), eq(commandIntents.lockedBy, workerId)));
}

async function fail(row: Intent, workerId: string, error: unknown): Promise<void> {
  const rejected = error instanceof FinanceError || error instanceof ZodError || error instanceof HttpError && error.status < 500 ||
    error instanceof Error && error.name === "DomainError";
  const status = error instanceof HttpError ? error.status : rejected ? 422 : 500;
  const message = rejected && error instanceof Error ? error.message.slice(0, 500) : "Máy chủ chưa xử lý được thao tác. Hãy đồng bộ lại.";
  const terminal = rejected || row.attempts >= maxAttempts;
  const delay = Math.min(60_000, 1_000 * 2 ** Math.max(0, row.attempts - 1));
  await database().update(commandIntents).set({ status: rejected ? "rejected" : terminal ? "failed" : "queued",
    error: message, errorStatus: rejected ? status : null, runAt: new Date(Date.now() + delay),
    lockedBy: null, leaseUntil: null, updatedAt: new Date() }).where(and(identity(row),
    eq(commandIntents.status, "running"), eq(commandIntents.lockedBy, workerId)));
}

async function processClaimed(row: Intent, workerId: string): Promise<void> {
  try { await finish(row, workerId, await execute(row)); }
  catch (error) { await fail(row, workerId, error); }
}

async function outcome(userId: string, domain: Domain, key: string) {
  const [row] = await database().select().from(commandIntents).where(and(eq(commandIntents.userId, userId),
    eq(commandIntents.domain, domain), eq(commandIntents.key, key)));
  if (!row) throw new HttpError(500, "Không tìm thấy biên nhận thao tác đã tiếp nhận.");
  if (row.status === "rejected") throw new HttpError(row.errorStatus ?? 422, row.error ?? "Thao tác không hợp lệ.");
  return row.status === "applied" ? { status: "applied" as const, result: row.result } :
    { status: "pending" as const, intent: publicIntent(row) };
}

async function submit(userId: string, domain: Domain, key: string, payload: Payload, expectedRevision?: number) {
  await admit(userId, domain, key, payload, expectedRevision);
  const workerId = randomUUID();
  const claimed = await claimOne(workerId, { userId, domain, key });
  if (claimed) await processClaimed(claimed, workerId);
  return outcome(userId, domain, key);
}

export async function submitGameIntent(userId: string, key: string, action: Action, expectedRevision?: number) {
  // Reconciliation is a read/settle operation invoked on every refresh. It does
  // not create a command receipt in store.ts and must not grow the intent table.
  if (action.type === "reconcile" || isLocalDevelopment()) return { status: "applied" as const, result: await gameCommand(userId, key, action) };
  const response = await submit(userId, "game", key, { action }, expectedRevision);
  if (response.status === "pending") return response;
  // Later same-key retries must return the newest state, as gameCommand did before.
  const saved = response.result as Pick<ActionResult, "events" | "message">;
  return { status: "applied" as const, result: { ...saved, state: await readGame(userId) } };
}

export async function submitFinanceIntent(userId: string, key: string, command: FinanceCommand) {
  if (isLocalDevelopment()) {
    const result = await updateFinance(userId, current => { const state = applyFinance(readFinance(current), command, key, randomUUID); return { state, result: state }; });
    return { status: "applied" as const, result };
  }
  const response = await submit(userId, "finance", key, { command });
  return response.status === "pending" ? response :
    { status: "applied" as const, result: readFinance(await readPrivate(userId, "finance")) };
}

export async function readOpenIntent(userId: string, domain: Domain) {
  if (isLocalDevelopment()) return null;
  const [row] = await database().select().from(commandIntents).where(and(eq(commandIntents.userId, userId),
    eq(commandIntents.domain, domain), inArray(commandIntents.status, openStatuses)))
    .orderBy(asc(commandIntents.createdAt)).limit(1);
  return row ? publicIntent(row) : null;
}

/** Returns true when it claimed work. Leases and domain receipts make crash replays safe. */
export async function processPendingCommandIntents(workerId: string): Promise<boolean> {
  if (isLocalDevelopment()) return false;
  const claimed = await claimOne(workerId);
  if (!claimed) return false;
  await processClaimed(claimed, workerId);
  return true;
}

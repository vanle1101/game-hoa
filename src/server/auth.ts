import "server-only";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, eq, gt, isNull } from "drizzle-orm";
import { database } from "./database";
import * as schema from "./schema";
import { constructionDrafts, userPortraits } from "./artifacts-schema";
import { backgroundJobs } from "./jobs-schema";
import { HttpError } from "./errors";
import { createInitialState } from "@/domain";
import type { GameState } from "@/domain/types";

export const AUTH_COOKIE = "lifelevel-auth";
export const GUEST_COOKIE = "lifelevel-session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_BYTES = 64;
const MAX_ACTIVE_PASSWORD_HASHES = 4;
let activePasswordHashes = 0;
const attempts = new Map<string, { startedAt: number; count: number }>();

export function normalizeEmail(input: string): string {
  return input.trim().normalize("NFKC").toLowerCase();
}

/** A bounded per-process brake; production must add a shared proxy limiter. */
export function consumeAuthAttempt(operation: "login" | "register", email: string) {
  const key = createHash("sha256").update(`${operation}:${normalizeEmail(email)}`).digest("hex");
  const now = Date.now();
  const previous = attempts.get(key);
  const current = previous && now - previous.startedAt < 15 * 60_000 ? previous : { startedAt: now, count: 0 };
  if (current.count >= 8) throw new HttpError(429, "Quá nhiều lần thử. Hãy thử lại sau 15 phút.");
  current.count++;
  attempts.set(key, current);
  if (attempts.size > 10_000) {
    for (const [id, value] of attempts) if (now - value.startedAt >= 15 * 60_000) attempts.delete(id);
  }
}

export function clearLoginAttempts(email: string) {
  const key = createHash("sha256").update(`login:${normalizeEmail(email)}`).digest("hex");
  attempts.delete(key);
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activePasswordHashes >= MAX_ACTIVE_PASSWORD_HASHES)
    throw new HttpError(429, "Máy chủ đang xử lý nhiều yêu cầu đăng nhập. Hãy thử lại sau.");
  activePasswordHashes++;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      activePasswordHashes--;
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  const match = encoded?.match(/^scrypt\$(32768)\$(8)\$(1)\$([a-f0-9]{32})\$([a-f0-9]{128})$/);
  const salt = match ? Buffer.from(match[4], "hex") : randomBytes(16);
  const expected = match ? Buffer.from(match[5], "hex") : randomBytes(SCRYPT_BYTES);
  const actual = await derive(password, salt);
  return Boolean(match) && timingSafeEqual(actual, expected);
}

export function validAuthToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function validGuestToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function guestUserIdFromToken(token: string): string {
  if (!validGuestToken(token)) throw new HttpError(401, "Không có phiên khách hợp lệ.");
  return createHash("sha256").update(`guest:${token}`).digest("hex");
}

function sessionHash(token: string): string {
  return createHash("sha256").update(`account-session:${token}`).digest("hex");
}

function newSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  return { token, row: { tokenHash: sessionHash(token), userId, expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) } };
}

export async function registerAccount(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const passwordHash = await hashPassword(password);
  const userId = `account:${randomUUID()}`;
  const session = newSession(userId);
  try {
    await database().transaction(async tx => {
      await tx.insert(schema.accounts).values({ userId, email, passwordHash });
      await tx.insert(schema.authSessions).values(session.row);
    });
  } catch (error) {
    const sqlError = error as { code?: string; cause?: { code?: string } };
    if (sqlError.code === "23505" || sqlError.cause?.code === "23505") throw new HttpError(409, "Không thể tạo tài khoản với email này.");
    throw error;
  }
  return { userId, email, token: session.token };
}

export async function loginAccount(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const [account] = await database().select().from(schema.accounts).where(eq(schema.accounts.email, email));
  const valid = await verifyPassword(password, account?.passwordHash);
  if (!account || !valid || account.disabledAt) throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
  const session = newSession(account.userId);
  await database().insert(schema.authSessions).values(session.row);
  return { userId: account.userId, email: account.email, token: session.token };
}

export async function findAccountSession(token: string | undefined) {
  if (!validAuthToken(token)) return null;
  const [row] = await database().select({ userId: schema.accounts.userId, email: schema.accounts.email })
    .from(schema.authSessions).innerJoin(schema.accounts, eq(schema.authSessions.userId, schema.accounts.userId))
    .where(and(eq(schema.authSessions.tokenHash, sessionHash(token)), gt(schema.authSessions.expiresAt, new Date()),
      isNull(schema.authSessions.revokedAt), isNull(schema.accounts.disabledAt)));
  return row ?? null;
}

export async function revokeAccountSession(token: string | undefined) {
  if (!validAuthToken(token)) return;
  await database().update(schema.authSessions).set({ revokedAt: new Date() })
    .where(and(eq(schema.authSessions.tokenHash, sessionHash(token)), isNull(schema.authSessions.revokedAt)));
}

export async function hasClaimableGuestSave(guestUserId: string) {
  const [row] = await database().select({ userId: schema.playerStates.userId }).from(schema.playerStates)
    .where(eq(schema.playerStates.userId, guestUserId));
  if (!row) return false;
  const [claim] = await database().select({ accountUserId: schema.guestClaims.accountUserId }).from(schema.guestClaims)
    .where(eq(schema.guestClaims.guestUserId, guestUserId));
  return !claim;
}

/** Claimed guest rows remain for recovery but old cookies must lose read access. */
export async function isClaimedGuest(guestUserId: string): Promise<boolean> {
  const [claim] = await database().select({ guestUserId: schema.guestClaims.guestUserId })
    .from(schema.guestClaims).where(eq(schema.guestClaims.guestUserId, guestUserId));
  return Boolean(claim);
}

export function cloneGameForOwner(source: GameState, userId: string): GameState {
  const copy = structuredClone(source);
  copy.userId = userId;
  if (copy.undo) copy.undo.before.userId = userId;
  return copy;
}

/** Atomic, non-destructive transfer. Existing account progress is never overwritten. */
export async function claimGuestSave(accountUserId: string, guestUserId: string) {
  if (accountUserId === guestUserId || !/^[a-f0-9]{64}$/.test(guestUserId)) throw new HttpError(400, "Phiên khách không hợp lệ.");
  return database().transaction(async tx => {
    const [account] = await tx.select({ userId: schema.accounts.userId }).from(schema.accounts)
      .where(and(eq(schema.accounts.userId, accountUserId), isNull(schema.accounts.disabledAt))).for("update");
    if (!account) throw new HttpError(401, "Cần đăng nhập để chuyển dữ liệu.");
    const [guest] = await tx.select().from(schema.playerStates).where(eq(schema.playerStates.userId, guestUserId)).for("update");
    if (!guest) throw new HttpError(404, "Chưa có dữ liệu khách để chuyển.");
    const [previousClaim] = await tx.select().from(schema.guestClaims).where(eq(schema.guestClaims.guestUserId, guestUserId));
    if (previousClaim) {
      if (previousClaim.accountUserId !== accountUserId) throw new HttpError(409, "Dữ liệu khách đã được chuyển sang tài khoản khác.");
      return { claimed: true, alreadyClaimed: true, userId: accountUserId };
    }
    const [target] = await tx.select().from(schema.playerStates).where(eq(schema.playerStates.userId, accountUserId)).for("update");
    const [targetFinance] = await tx.select().from(schema.financeStates).where(eq(schema.financeStates.userId, accountUserId));
    const targetCommands = await tx.select({ key: schema.commandRecords.key }).from(schema.commandRecords)
      .where(eq(schema.commandRecords.userId, accountUserId)).limit(1);
    const targetProposals = await tx.select({ id: schema.aiProposals.id }).from(schema.aiProposals)
      .where(eq(schema.aiProposals.userId, accountUserId)).limit(1);
    const [targetDraft] = await tx.select({ userId: constructionDrafts.userId }).from(constructionDrafts)
      .where(eq(constructionDrafts.userId, accountUserId)).for("update");
    const targetJobs = await tx.select({ id: backgroundJobs.id }).from(backgroundJobs)
      .where(eq(backgroundJobs.userId, accountUserId)).limit(1);
    const guestJobs = await tx.select().from(backgroundJobs)
      .where(eq(backgroundJobs.userId, guestUserId)).for("update");
    const targetIntents = await tx.select({ key: schema.commandIntents.key }).from(schema.commandIntents)
      .where(eq(schema.commandIntents.userId, accountUserId)).limit(1);
    const guestIntents = await tx.select().from(schema.commandIntents)
      .where(eq(schema.commandIntents.userId, guestUserId)).for("update");
    if ((target && !isDeepStrictEqual(target.state, createInitialState(accountUserId, target.state.createdAt))) ||
        targetFinance || targetCommands.length || targetProposals.length || targetDraft || targetJobs.length || targetIntents.length) {
      throw new HttpError(409, "Tài khoản đã có dữ liệu. Không tự động ghi đè; dữ liệu khách vẫn được giữ nguyên.");
    }
    if (guestJobs.some(job => job.status !== "succeeded" && job.status !== "failed"))
      throw new HttpError(409, "Dữ liệu khách còn tác vụ đang chờ. Hãy đợi tác vụ hoàn tất rồi chuyển lại.");
    if (guestIntents.some(intent => intent.status !== "applied" && intent.status !== "rejected"))
      throw new HttpError(409, "Dữ liệu khách còn thao tác đang chờ. Hãy đợi thao tác hoàn tất rồi chuyển lại.");
    const copiedJobIds = new Map(guestJobs.map(job => [job.id, randomUUID()]));
    const state = cloneGameForOwner(guest.state, accountUserId);
    if (target) {
      await tx.update(schema.playerStates).set({ state, revision: guest.revision, updatedAt: new Date() })
        .where(eq(schema.playerStates.userId, accountUserId));
    } else {
      await tx.insert(schema.playerStates).values({ userId: accountUserId, state, revision: guest.revision });
    }
    const [finance] = await tx.select().from(schema.financeStates).where(eq(schema.financeStates.userId, guestUserId));
    if (finance) await tx.insert(schema.financeStates).values({ userId: accountUserId, state: finance.state });
    const proposals = await tx.select().from(schema.aiProposals).where(eq(schema.aiProposals.userId, guestUserId));
    const proposalIds = new Map(proposals.map(row => [row.id, copiedJobIds.get(row.id) ?? randomUUID()]));
    for (let offset = 0; offset < proposals.length; offset += 500) {
      await tx.insert(schema.aiProposals).values(proposals.slice(offset, offset + 500).map(row => ({
        id: proposalIds.get(row.id)!, userId: accountUserId,
        proposal: { ...(row.proposal as Record<string, unknown>), id: proposalIds.get(row.id)! },
        status: row.status, createdAt: row.createdAt,
      })));
    }
    const commands = await tx.select().from(schema.commandRecords).where(eq(schema.commandRecords.userId, guestUserId));
    for (let offset = 0; offset < commands.length; offset += 500) {
      await tx.insert(schema.commandRecords).values(commands.slice(offset, offset + 500).map(row => {
        const proposalId = row.key.startsWith("ai-proposal:") ? row.key.slice("ai-proposal:".length) : null;
        return { userId: accountUserId, key: proposalId && proposalIds.has(proposalId) ? `ai-proposal:${proposalIds.get(proposalId)}` : row.key,
          fingerprint: row.fingerprint, result: row.result, createdAt: row.createdAt };
      }));
    }
    for (let offset = 0; offset < guestIntents.length; offset += 500) {
      await tx.insert(schema.commandIntents).values(guestIntents.slice(offset, offset + 500).map(intent => {
        if (intent.domain !== "game" && intent.domain !== "finance")
          throw new HttpError(409, "Lịch sử thao tác khách không tương thích; bản gốc vẫn được giữ nguyên.");
        const result = intent.result && typeof intent.result === "object" && !Array.isArray(intent.result)
          ? structuredClone(intent.result) as Record<string, unknown> : intent.result;
        if (intent.domain === "game" && result && typeof result === "object" && "state" in result && result.state)
          result.state = cloneGameForOwner(result.state as GameState, accountUserId);
        return {
          userId: accountUserId, domain: intent.domain, key: intent.key,
          fingerprint: intent.fingerprint, payload: intent.payload,
          status: intent.status, result, error: intent.error, errorStatus: intent.errorStatus,
          attempts: intent.attempts, runAt: intent.runAt, leaseUntil: null, lockedBy: null,
          createdAt: intent.createdAt, updatedAt: intent.updatedAt,
        };
      }));
    }
    for (let offset = 0; offset < guestJobs.length; offset += 500) {
      await tx.insert(backgroundJobs).values(guestJobs.slice(offset, offset + 500).map(job => {
        const proposalId = job.result?.proposalId;
        if (proposalId && !proposalIds.has(proposalId))
          throw new HttpError(409, "Lịch sử tác vụ khách thiếu kết quả tương ứng; bản gốc vẫn được giữ nguyên.");
        return {
          id: copiedJobIds.get(job.id)!, userId: accountUserId, type: job.type,
          status: job.status, idempotencyKey: job.idempotencyKey, fingerprint: job.fingerprint,
          payload: job.payload, result: proposalId ? { proposalId: proposalIds.get(proposalId)! } : null,
          error: job.error, attempts: job.attempts, maxAttempts: job.maxAttempts,
          runAt: job.runAt, leaseUntil: null, lockedBy: null,
          createdAt: job.createdAt, updatedAt: job.updatedAt,
        };
      }));
    }
    // Portraits are derived from appearance and may already have been generated for
    // the untouched account. Keep those rows, adding all other guest portraits.
    const portraits = await tx.select().from(userPortraits).where(eq(userPortraits.userId, guestUserId)).for("update");
    for (let offset = 0; offset < portraits.length; offset += 500) {
      await tx.insert(userPortraits).values(portraits.slice(offset, offset + 500).map(row => ({
        userId: accountUserId, portraitKey: row.portraitKey, dataUrl: row.dataUrl, updatedAt: row.updatedAt,
      }))).onConflictDoNothing({ target: [userPortraits.userId, userPortraits.portraitKey] });
    }
    const [guestDraft] = await tx.select().from(constructionDrafts)
      .where(eq(constructionDrafts.userId, guestUserId)).for("update");
    if (guestDraft) await tx.insert(constructionDrafts).values({
      userId: accountUserId, plan: guestDraft.plan, baseRevision: guestDraft.baseRevision,
      draftRevision: guestDraft.draftRevision, updatedAt: guestDraft.updatedAt,
    });
    await tx.insert(schema.guestClaims).values({ guestUserId, accountUserId });
    return { claimed: true, alreadyClaimed: false, userId: accountUserId };
  });
}

import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, lte, or } from "drizzle-orm";
import { database } from "./database";
import { HttpError } from "./errors";
import { backgroundJobs } from "./jobs-schema";
import { aiProposals, guestClaims, playerStates } from "./schema";
import type { Proposal } from "./ai";

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type PublicJob = Pick<BackgroundJob, "id" | "type" | "status" | "attempts" | "maxAttempts" | "result" | "error" | "createdAt" | "updatedAt">;

function publicJob(job: BackgroundJob): PublicJob {
  const { id, type, status, attempts, maxAttempts, result, error, createdAt, updatedAt } = job;
  return { id, type, status, attempts, maxAttempts, result, error, createdAt, updatedAt };
}

/** The player row serializes admission for every session belonging to one account. */
export async function enqueueAiJob(userId: string, prompt: string, key: string): Promise<PublicJob> {
  if (!/^[a-f0-9-]{36}$/i.test(key)) throw new HttpError(400, "Mã yêu cầu không hợp lệ.");
  const fingerprint = createHash("sha256").update(JSON.stringify({ type: "ai.propose", prompt })).digest("hex");
  const db = database();
  return db.transaction(async tx => {
    const [owner] = await tx.select({ userId: playerStates.userId }).from(playerStates)
      .where(eq(playerStates.userId, userId)).for("update");
    if (!owner) throw new HttpError(401, "Phiên người dùng không hợp lệ.");
    if (/^[a-f0-9]{64}$/.test(userId)) {
      const [claim] = await tx.select({ guestUserId: guestClaims.guestUserId }).from(guestClaims)
        .where(eq(guestClaims.guestUserId, userId));
      if (claim) throw new HttpError(409, "Dữ liệu khách đã chuyển vào tài khoản; hãy đăng nhập để tiếp tục.");
    }

    const [prior] = await tx.select().from(backgroundJobs).where(and(
      eq(backgroundJobs.userId, userId), eq(backgroundJobs.idempotencyKey, key),
    ));
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new HttpError(409, "Mã yêu cầu đã dùng cho nội dung khác.");
      return publicJob(prior);
    }

    const [recent] = await tx.select({ total: count() }).from(backgroundJobs).where(and(
      eq(backgroundJobs.userId, userId), gte(backgroundJobs.createdAt, new Date(Date.now() - 60_000)),
    ));
    if ((recent?.total ?? 0) >= 6) throw new HttpError(429, "Bạn đã gửi nhiều yêu cầu. Hãy thử lại sau một phút.");
    const [open] = await tx.select({ total: count() }).from(backgroundJobs).where(and(
      eq(backgroundJobs.userId, userId),
      or(eq(backgroundJobs.status, "queued"), eq(backgroundJobs.status, "running")),
    ));
    if ((open?.total ?? 0) >= 3) throw new HttpError(429, "Ba kế hoạch đang chờ xử lý. Hãy đợi kết quả.");

    const [created] = await tx.insert(backgroundJobs).values({
      id: randomUUID(), userId, type: "ai.propose", status: "queued",
      idempotencyKey: key, fingerprint, payload: { prompt },
    }).returning();
    return publicJob(created);
  });
}

export async function readUserJob(userId: string, id: string): Promise<PublicJob | null> {
  const [row] = await database().select().from(backgroundJobs).where(and(
    eq(backgroundJobs.id, id), eq(backgroundJobs.userId, userId),
  ));
  return row ? publicJob(row) : null;
}

export async function listUserJobs(userId: string): Promise<PublicJob[]> {
  const rows = await database().select().from(backgroundJobs).where(eq(backgroundJobs.userId, userId))
    .orderBy(desc(backgroundJobs.createdAt)).limit(30);
  return rows.map(publicJob);
}

/** Reclaims an expired lease after worker death. SKIP LOCKED permits several workers safely. */
export async function claimJob(workerId: string, now = new Date()): Promise<BackgroundJob | null> {
  return database().transaction(async tx => {
    const [row] = await tx.select().from(backgroundJobs).where(or(
      and(eq(backgroundJobs.status, "queued"), lte(backgroundJobs.runAt, now)),
      and(eq(backgroundJobs.status, "running"), lte(backgroundJobs.leaseUntil, now)),
    )).orderBy(asc(backgroundJobs.runAt), asc(backgroundJobs.createdAt)).limit(1)
      .for("update", { skipLocked: true });
    if (!row) return null;
    if (row.attempts >= row.maxAttempts) {
      await tx.update(backgroundJobs).set({
        status: "failed", error: "Tác vụ gián đoạn quá số lần cho phép.",
        lockedBy: null, leaseUntil: null, updatedAt: now,
      }).where(eq(backgroundJobs.id, row.id));
      return null;
    }
    const [claimed] = await tx.update(backgroundJobs).set({
      status: "running", attempts: row.attempts + 1, lockedBy: workerId,
      leaseUntil: new Date(now.getTime() + 90_000), updatedAt: now,
    }).where(eq(backgroundJobs.id, row.id)).returning();
    return claimed;
  });
}

export async function renewJob(id: string, workerId: string): Promise<boolean> {
  const [row] = await database().update(backgroundJobs).set({
    leaseUntil: new Date(Date.now() + 90_000), updatedAt: new Date(),
  }).where(and(eq(backgroundJobs.id, id), eq(backgroundJobs.lockedBy, workerId),
    eq(backgroundJobs.status, "running"))).returning({ id: backgroundJobs.id });
  return Boolean(row);
}

/** Proposal insert and success transition commit atomically; a replay cannot create two results. */
export async function completeAiJob(id: string, workerId: string, proposal: Proposal): Promise<boolean> {
  return database().transaction(async tx => {
    const [job] = await tx.select().from(backgroundJobs).where(eq(backgroundJobs.id, id)).for("update");
    if (!job || job.status !== "running" || job.lockedBy !== workerId || job.type !== "ai.propose") return false;
    const stable = { ...proposal, id: job.id };
    // The proposal and success status share one transaction. A duplicate ID is
    // an integrity error; silently ignoring it could report a foreign result.
    await tx.insert(aiProposals).values({ id: job.id, userId: job.userId, proposal: stable, status: "pending" });
    await tx.update(backgroundJobs).set({
      status: "succeeded", result: { proposalId: job.id }, error: null,
      lockedBy: null, leaseUntil: null, updatedAt: new Date(),
    }).where(eq(backgroundJobs.id, id));
    return true;
  });
}

export async function failJob(id: string, workerId: string, message: string): Promise<void> {
  await database().transaction(async tx => {
    const [job] = await tx.select().from(backgroundJobs).where(eq(backgroundJobs.id, id)).for("update");
    if (!job || job.status !== "running" || job.lockedBy !== workerId) return;
    const terminal = job.attempts >= job.maxAttempts;
    const delay = Math.min(60_000, 1_000 * 2 ** Math.max(0, job.attempts - 1));
    await tx.update(backgroundJobs).set({
      status: terminal ? "failed" : "queued", error: message.slice(0, 500),
      runAt: new Date(Date.now() + delay), lockedBy: null, leaseUntil: null, updatedAt: new Date(),
    }).where(eq(backgroundJobs.id, id));
  });
}

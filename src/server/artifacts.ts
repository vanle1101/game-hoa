import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getBuilding } from "@/construction/engine";
import type { BuildingPlan } from "@/construction/types";
import { database } from "./database";
import { HttpError } from "./errors";
import { isLocalDevelopment } from "./runtime-mode";
import { assertPortraitQuota } from "./portrait-quota";
import { constructionDrafts, userPortraits } from "./artifacts-schema";
import { guestClaims, playerStates } from "./schema";
import { readGame } from "./store";

export type SavedDraft = { ownerId: string; plan: BuildingPlan | null; baseRevision?: number; draftRevision?: number };
type LocalArtifacts = { portraits: Record<string, string>; draft: Omit<SavedDraft, "ownerId"> | null };
let localQueue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = localQueue.then(fn, fn);
  localQueue = next.catch(() => undefined);
  return next;
}
function localFile(userId: string) {
  if (!/^(local-player|local-demo-player)$/.test(userId)) throw new HttpError(400, "Chủ dữ liệu local không hợp lệ.");
  const root = process.env.LOCAL_DATA_DIR ? path.resolve(process.env.LOCAL_DATA_DIR) : path.join(process.cwd(), ".local-data");
  return path.join(root, `${userId}.artifacts.json`);
}
async function readLocal(userId: string): Promise<LocalArtifacts> {
  try { return JSON.parse(await readFile(localFile(userId), "utf8")) as LocalArtifacts; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { portraits: {}, draft: null };
    throw error;
  }
}
async function writeLocal(userId: string, data: LocalArtifacts) {
  const file = localFile(userId);
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data), "utf8");
  await rename(temp, file);
}

async function lockWritableOwner(tx: Parameters<Parameters<ReturnType<typeof database>["transaction"]>[0]>[0], userId: string) {
  const [owner] = await tx.select().from(playerStates).where(eq(playerStates.userId, userId)).for("update");
  if (!owner) throw new HttpError(404, "Không tìm thấy dữ liệu người dùng.");
  const [claim] = await tx.select({ guestUserId: guestClaims.guestUserId }).from(guestClaims)
    .where(eq(guestClaims.guestUserId, userId));
  if (claim) throw new HttpError(409, "Bản lưu khách đã chuyển sang tài khoản; hãy tải lại phiên.");
  return owner;
}

export async function readPortrait(userId: string, key: string): Promise<string | null> {
  if (isLocalDevelopment()) return serial(async () => (await readLocal(userId)).portraits[key] ?? null);
  const [row] = await database().select({ dataUrl: userPortraits.dataUrl }).from(userPortraits)
    .where(and(eq(userPortraits.userId, userId), eq(userPortraits.portraitKey, key)));
  return row?.dataUrl ?? null;
}
export async function savePortrait(userId: string, key: string, dataUrl: string): Promise<void> {
  if (isLocalDevelopment()) return serial(async () => { const data = await readLocal(userId); data.portraits[key] = dataUrl; await writeLocal(userId, data); });
  await readGame(userId);
  await database().transaction(async tx => {
    await lockWritableOwner(tx, userId);
    const existing = await tx.select({ portraitKey: userPortraits.portraitKey, dataUrl: userPortraits.dataUrl })
      .from(userPortraits).where(eq(userPortraits.userId, userId));
    assertPortraitQuota(existing, key, dataUrl);
    await tx.insert(userPortraits).values({ userId, portraitKey: key, dataUrl })
      .onConflictDoUpdate({ target: [userPortraits.userId, userPortraits.portraitKey], set: { dataUrl, updatedAt: new Date() } });
  });
}

export async function readDraft(userId: string): Promise<SavedDraft> {
  if (isLocalDevelopment()) return serial(async () => ({ ownerId: userId, ...(await readLocal(userId)).draft ?? { plan: null } }));
  const [row] = await database().select().from(constructionDrafts).where(eq(constructionDrafts.userId, userId));
  return row ? { ownerId: userId, plan: row.plan, baseRevision: row.baseRevision, draftRevision: row.draftRevision }
    : { ownerId: userId, plan: null };
}

export async function saveDraft(userId: string, plan: BuildingPlan, baseRevision: number, expectedDraftRevision: number | null): Promise<SavedDraft> {
  if (isLocalDevelopment()) return serial(async () => {
    const data = await readLocal(userId);
    const current = data.draft;
    if ((current?.draftRevision ?? null) !== expectedDraftRevision) throw new HttpError(409, "Bản nháp đã thay đổi ở phiên khác.");
    const state = await readGame(userId);
    if (getBuilding(state).revision !== baseRevision) throw new HttpError(409, "Công trình đã thay đổi. Hãy đồng bộ trước khi lưu bản nháp.");
    const draftRevision = (current?.draftRevision ?? 0) + 1;
    data.draft = { plan, baseRevision, draftRevision };
    await writeLocal(userId, data);
    return { ownerId: userId, plan, baseRevision, draftRevision };
  });
  await readGame(userId);
  return database().transaction(async tx => {
    const owner = await lockWritableOwner(tx, userId);
    if (getBuilding(owner.state).revision !== baseRevision) throw new HttpError(409, "Công trình đã thay đổi. Hãy đồng bộ trước khi lưu bản nháp.");
    const [current] = await tx.select().from(constructionDrafts).where(eq(constructionDrafts.userId, userId));
    if ((current?.draftRevision ?? null) !== expectedDraftRevision) throw new HttpError(409, "Bản nháp đã thay đổi ở phiên khác.");
    const draftRevision = (current?.draftRevision ?? 0) + 1;
    if (current) await tx.update(constructionDrafts).set({ plan, baseRevision, draftRevision, updatedAt: new Date() })
      .where(eq(constructionDrafts.userId, userId));
    else await tx.insert(constructionDrafts).values({ userId, plan, baseRevision, draftRevision });
    return { ownerId: userId, plan, baseRevision, draftRevision };
  });
}

export async function clearDraft(userId: string, expectedDraftRevision: number | null): Promise<void> {
  if (isLocalDevelopment()) return serial(async () => {
    const data = await readLocal(userId);
    if ((data.draft?.draftRevision ?? null) !== expectedDraftRevision) throw new HttpError(409, "Bản nháp đã thay đổi ở phiên khác.");
    data.draft = null;
    await writeLocal(userId, data);
  });
  await database().transaction(async tx => {
    await lockWritableOwner(tx, userId);
    const [current] = await tx.select().from(constructionDrafts).where(eq(constructionDrafts.userId, userId));
    if ((current?.draftRevision ?? null) !== expectedDraftRevision) throw new HttpError(409, "Bản nháp đã thay đổi ở phiên khác.");
    if (current) await tx.delete(constructionDrafts).where(eq(constructionDrafts.userId, userId));
  });
}

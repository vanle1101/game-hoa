import { buildingPlanSchema } from "@/construction/schema";
import type { BuildingPlan } from "@/construction/types";

export type SyncedDraft = { plan: BuildingPlan; baseRevision: number; draftRevision: number };
export type DraftTransport = typeof fetch;

/** PostgreSQL JSONB may reorder object keys; array order remains part of the plan. */
export function draftFingerprint(plan: BuildingPlan): string {
  return JSON.stringify(plan, (_key, value: unknown) => {
    if (!value || Array.isArray(value) || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  });
}

export class DraftSyncError extends Error {
  constructor(public readonly kind: "conflict" | "network" | "invalid", message: string) {
    super(message);
    this.name = "DraftSyncError";
  }
}

function parseDraft(input: unknown, ownerId: string): SyncedDraft | null {
  if (!input || typeof input !== "object" || !("ownerId" in input) || input.ownerId !== ownerId || !("plan" in input)) throw new DraftSyncError("invalid", "Phản hồi bản nháp không hợp lệ.");
  if (input.plan === null) return null;
  if (!("baseRevision" in input) || !("draftRevision" in input) ||
    !Number.isSafeInteger(input.baseRevision) || Number(input.baseRevision) < 0 ||
    !Number.isSafeInteger(input.draftRevision) || Number(input.draftRevision) < 0) {
    throw new DraftSyncError("invalid", "Phiên bản bản nháp không hợp lệ.");
  }
  const parsed = buildingPlanSchema.safeParse(input.plan);
  if (!parsed.success) throw new DraftSyncError("invalid", "Cấu trúc bản nháp trên máy chủ không hợp lệ.");
  return { plan: parsed.data, baseRevision: Number(input.baseRevision), draftRevision: Number(input.draftRevision) };
}

export async function readServerDraft(ownerId: string, transport: DraftTransport = fetch): Promise<SyncedDraft | null> {
  let response: Response;
  try { response = await transport(`/api/construction/draft?expectedOwnerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" }); }
  catch { throw new DraftSyncError("network", "Không thể tải bản nháp từ máy chủ."); }
  if (response.status === 409) throw new DraftSyncError("conflict", "Phiên tài khoản đã thay đổi. Hãy tải lại ứng dụng.");
  if (!response.ok) throw new DraftSyncError("network", "Không thể tải bản nháp từ máy chủ.");
  return parseDraft(await response.json(), ownerId);
}

export async function saveServerDraft(ownerId: string, plan: BuildingPlan, baseRevision: number, expectedDraftRevision: number | null, transport: DraftTransport = fetch): Promise<SyncedDraft> {
  const parsed = buildingPlanSchema.safeParse(plan);
  if (!parsed.success) throw new DraftSyncError("invalid", "Bản nháp cần cấu trúc hợp lệ trước khi đồng bộ.");
  let response: Response;
  try {
    response = await transport("/api/construction/draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedOwnerId: ownerId, plan: parsed.data, baseRevision, expectedDraftRevision }),
    });
  } catch { throw new DraftSyncError("network", "Không thể đồng bộ bản nháp lên máy chủ."); }
  if (response.status === 409) throw new DraftSyncError("conflict", "Bản nháp đã đổi ở thiết bị khác. Bản hiện tại chưa được ghi đè.");
  if (!response.ok) throw new DraftSyncError("network", "Không thể đồng bộ bản nháp lên máy chủ.");
  const saved = parseDraft(await response.json(), ownerId);
  if (!saved || saved.baseRevision !== baseRevision) throw new DraftSyncError("invalid", "Máy chủ trả về phiên bản bản nháp không khớp.");
  return saved;
}

export async function clearServerDraft(ownerId: string, expectedDraftRevision: number | null, transport: DraftTransport = fetch): Promise<void> {
  let response: Response;
  try {
    response = await transport("/api/construction/draft", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedOwnerId: ownerId, expectedDraftRevision }),
    });
  } catch { throw new DraftSyncError("network", "Không thể xóa bản nháp trên máy chủ."); }
  if (response.status === 409) throw new DraftSyncError("conflict", "Bản nháp đã đổi ở thiết bị khác nên không bị xóa.");
  if (!response.ok) throw new DraftSyncError("network", "Không thể xóa bản nháp trên máy chủ.");
}

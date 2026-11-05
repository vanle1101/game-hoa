import { z } from "zod";
import { buildingPlanSchema } from "@/construction/schema";
import { clearDraft, readDraft, saveDraft } from "@/server/artifacts";
import { checkOrigin, errorResponse, HttpError, requireUser } from "@/server/identity";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ownerId = z.string().min(1).max(200);
const revision = z.number().int().nonnegative().safe();
const saveSchema = z.object({
  expectedOwnerId: ownerId, plan: buildingPlanSchema,
  baseRevision: revision, expectedDraftRevision: revision.nullable(),
}).strict();
const deleteSchema = z.object({ expectedOwnerId: ownerId, expectedDraftRevision: revision.nullable() }).strict();
const headers = { "Cache-Control": "private, no-store" };

function verifyOwner(expected: string, actual: string) {
  if (expected !== actual) throw new HttpError(409, "Phiên người dùng đã thay đổi. Hãy tải lại ứng dụng.");
}

export async function GET(request: Request) {
  try {
    const userId = await requireUser();
    const expected = ownerId.safeParse(new URL(request.url).searchParams.get("expectedOwnerId"));
    if (!expected.success) throw new HttpError(400, "Thiếu chủ sở hữu bản nháp.");
    verifyOwner(expected.data, userId);
    return Response.json(await readDraft(userId), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const userId = await requireUser();
    const parsed = saveSchema.safeParse(await readJSON(request, 2_000_000));
    if (!parsed.success) throw new HttpError(400, "Bản nháp công trình không hợp lệ.");
    verifyOwner(parsed.data.expectedOwnerId, userId);
    const saved = await saveDraft(userId, parsed.data.plan, parsed.data.baseRevision, parsed.data.expectedDraftRevision);
    return Response.json(saved, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const userId = await requireUser();
    const parsed = deleteSchema.safeParse(await readJSON(request, 10_000));
    if (!parsed.success) throw new HttpError(400, "Phiên bản bản nháp không hợp lệ.");
    verifyOwner(parsed.data.expectedOwnerId, userId);
    await clearDraft(userId, parsed.data.expectedDraftRevision);
    return Response.json({ ownerId: userId, plan: null }, { headers });
  } catch (error) { return errorResponse(error); }
}

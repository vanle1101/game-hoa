import { z } from "zod";
import { readPortrait, savePortrait } from "@/server/artifacts";
import { checkOrigin, errorResponse, HttpError, requireUser } from "@/server/identity";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const portraitKey = z.string().regex(/^[a-z0-9_-]{1,64}$/i);
const ownerId = z.string().min(1).max(200);
const inputSchema = z.object({ expectedOwnerId: ownerId, key: portraitKey, dataUrl: z.string().max(1_500_000) }).strict();
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function verifyOwner(expected: string, actual: string) {
  if (expected !== actual) throw new HttpError(409, "Phiên người dùng đã thay đổi. Hãy tải lại ứng dụng.");
}

function validatePng(dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new HttpError(400, "Ảnh nhân vật phải là PNG hợp lệ.");
  const image = Buffer.from(match[1], "base64");
  if (image.length < 24 || image.length > 1_000_000 ||
    !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    image.toString("ascii", 12, 16) !== "IHDR") throw new HttpError(400, "Ảnh nhân vật không hợp lệ hoặc quá lớn.");
  const width = image.readUInt32BE(16), height = image.readUInt32BE(20);
  if (width < 1 || width > 1024 || height < 1 || height > 1024) throw new HttpError(400, "Kích thước ảnh nhân vật không hợp lệ.");
}

export async function GET(request: Request) {
  try {
    const userId = await requireUser();
    const query = new URL(request.url).searchParams;
    const key = portraitKey.safeParse(query.get("key"));
    const expected = ownerId.safeParse(query.get("expectedOwnerId"));
    if (!key.success || !expected.success) throw new HttpError(400, "Tham số ảnh không hợp lệ.");
    verifyOwner(expected.data, userId);
    const dataUrl = await readPortrait(userId, key.data);
    if (!dataUrl) throw new HttpError(404, "Chưa có ảnh nhân vật.");
    return Response.json({ ownerId: userId, key: key.data, dataUrl }, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const userId = await requireUser();
    const parsed = inputSchema.safeParse(await readJSON(request, 1_500_000));
    if (!parsed.success) throw new HttpError(400, "Ảnh nhân vật không hợp lệ.");
    verifyOwner(parsed.data.expectedOwnerId, userId);
    validatePng(parsed.data.dataUrl);
    await savePortrait(userId, parsed.data.key, parsed.data.dataUrl);
    return Response.json({ ownerId: userId, key: parsed.data.key }, { headers });
  } catch (error) { return errorResponse(error); }
}

import { parse } from "csv-parse/sync";
import { ZodError } from "zod";
import { requireUser, checkOrigin, errorResponse, HttpError, isLocalDemo } from "@/server/identity";
import { readPrivate, updateFinance } from "@/server/store";
import { readFinance, FinanceError, previewImport, financeCommandSchema } from "@/finance";
import { isPristineFinance, seedLocalDemoFinance } from "@/finance/local-demo";
import { submitFinanceIntent } from "@/server/command-intents";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) { if (error instanceof FinanceError || error instanceof ZodError) return Response.json({ error: error instanceof ZodError ? error.issues.map(i => i.message).join("; ") : error.message }, { status: 422 }); return errorResponse(error); }
export async function GET(request: Request) { try { const userId = await requireUser(); const expected = new URL(request.url).searchParams.get("expectedOwnerId"); if (expected && expected !== userId) return Response.json({ code: "OWNER_CHANGED", error: "Phiên người dùng đã thay đổi." }, { status: 409, headers: { "Cache-Control": "private, no-store" } }); let state = readFinance(await readPrivate(userId, "finance")); if (isLocalDemo() && userId === "local-demo-player" && isPristineFinance(state)) { state = await updateFinance(userId, current => { const seeded = seedLocalDemoFinance(current, userId, true); return { state: seeded, result: seeded }; }); } return Response.json(state, { headers: { "Cache-Control": "private, no-store", "X-Owner-Id": userId } }); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  try {
    checkOrigin(request); const userId = await requireUser();
    const expected = request.headers.get("X-Expected-Owner-Id");
    if (expected && expected !== userId) return Response.json({ code: "OWNER_CHANGED", error: "Phiên người dùng đã thay đổi." }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    const body = await readJSON(request,250_000) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Nội dung không hợp lệ.");
    if (body.type === "import.preview") {
      if (typeof body.csv !== "string" || typeof body.accountId !== "string") throw new HttpError(422, "Chọn tài khoản và tệp CSV.");
      let rows: Record<string, string>[]; try { rows = parse(body.csv, { columns: true, skip_empty_lines: true, bom: true, trim: true, max_record_size: 10000 }) as Record<string, string>[]; } catch { throw new HttpError(422, "CSV không hợp lệ. Cần các cột date,kind,amount,category,note."); }
      return Response.json({ preview: previewImport(readFinance(await readPrivate(userId, "finance")), rows.map(row => ({ accountId: body.accountId, date: row.date, kind: row.kind, amount: /^\d+$/.test(row.amount ?? "") ? Number(row.amount) : NaN, category: row.category, note: row.note ?? "" }))) });
    }
    const key = request.headers.get("Idempotency-Key"); if (!key || key.length > 100) throw new HttpError(400, "Thiếu mã thao tác hợp lệ.");
    const command = financeCommandSchema.parse(body);
    const outcome = await submitFinanceIntent(userId, key, command);
    return Response.json(outcome.status === "applied" ? outcome.result : { status: "pending", key },
      { status: outcome.status === "applied" ? 200 : 202, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { ZodError } from "zod";
import { requireUser, checkOrigin, errorResponse, HttpError } from "@/server/identity";
import { readPrivate, updateFinance } from "@/server/store";
import { applyFinance, readFinance, FinanceError, previewImport } from "@/finance";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) { if (error instanceof FinanceError || error instanceof ZodError) return Response.json({ error: error instanceof ZodError ? error.issues.map(i => i.message).join("; ") : error.message }, { status: 422 }); return errorResponse(error); }
export async function GET() { try { const userId = await requireUser(); return Response.json(readFinance(await readPrivate(userId, "finance")), { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  try {
    checkOrigin(request); const userId = await requireUser();
    const body = await readJSON(request,250_000) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Nội dung không hợp lệ.");
    if (body.type === "import.preview") {
      if (typeof body.csv !== "string" || typeof body.accountId !== "string") throw new HttpError(422, "Chọn tài khoản và tệp CSV.");
      let rows: Record<string, string>[]; try { rows = parse(body.csv, { columns: true, skip_empty_lines: true, bom: true, trim: true, max_record_size: 10000 }) as Record<string, string>[]; } catch { throw new HttpError(422, "CSV không hợp lệ. Cần các cột date,kind,amount,category,note."); }
      return Response.json({ preview: previewImport(readFinance(await readPrivate(userId, "finance")), rows.map(row => ({ accountId: body.accountId, date: row.date, kind: row.kind, amount: /^\d+$/.test(row.amount ?? "") ? Number(row.amount) : NaN, category: row.category, note: row.note ?? "" }))) });
    }
    const key = request.headers.get("Idempotency-Key"); if (!key || key.length > 100) throw new HttpError(400, "Thiếu mã thao tác.");
    const state = await updateFinance(userId, current => { const state = applyFinance(readFinance(current), body, key, randomUUID); return { state, result: state }; });
    return Response.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

import { requireUser, errorResponse, HttpError } from "@/server/identity";
import { readUserJob } from "@/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    const job = await readUserJob(userId, id);
    if (!job) throw new HttpError(404, "Không tìm thấy tác vụ.");
    return Response.json({ job }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

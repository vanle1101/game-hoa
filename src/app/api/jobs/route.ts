import { requireUser, errorResponse } from "@/server/identity";
import { listUserJobs } from "@/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const userId = await requireUser();
    return Response.json({ jobs: await listUserJobs(userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

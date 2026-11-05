import { readOpenIntent } from "@/server/command-intents";
import { errorResponse, requireUser } from "@/server/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireUser();
    const expected = new URL(request.url).searchParams.get("expectedOwnerId");
    if (expected && expected !== userId) return Response.json({ code: "OWNER_CHANGED", error: "Phiên người chơi đã thay đổi." },
      { status: 409, headers: { "Cache-Control": "private, no-store" } });
    return Response.json({ ownerId: userId, intent: await readOpenIntent(userId, "finance") },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

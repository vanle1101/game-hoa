import { claimGuestSave } from "@/server/auth";
import { checkOrigin, errorResponse, existingGuestUserId, HttpError, requireAccount, rotateGuestCookie } from "@/server/identity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const account = await requireAccount();
    const guestUserId = await existingGuestUserId();
    if (!guestUserId) throw new HttpError(404, "Trình duyệt này không có phiên khách để chuyển.");
    const result = await claimGuestSave(account.userId, guestUserId);
    await rotateGuestCookie();
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

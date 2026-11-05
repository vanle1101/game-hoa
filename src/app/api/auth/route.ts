import { accountIdentity, existingGuestUserId, isLocalDevelopment } from "@/server/identity";
import { hasClaimableGuestSave } from "@/server/auth";
import { errorResponse } from "@/server/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await accountIdentity();
    const guestUserId = account ? await existingGuestUserId() : null;
    const guestSaveAvailable = guestUserId ? await hasClaimableGuestSave(guestUserId) : false;
    return Response.json({ authenticated: Boolean(account), account, guestSaveAvailable, localMode: isLocalDevelopment() },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

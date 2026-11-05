import { cookies } from "next/headers";
import { AUTH_COOKIE, revokeAccountSession } from "@/server/auth";
import { checkOrigin, clearAccountCookie, errorResponse } from "@/server/identity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await revokeAccountSession((await cookies()).get(AUTH_COOKIE)?.value);
    await clearAccountCookie();
    return Response.json({ authenticated: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

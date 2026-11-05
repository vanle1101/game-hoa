import { z } from "zod";
import { checkOrigin, errorResponse, isLocalDevelopment, setAccountCookie, HttpError } from "@/server/identity";
import { clearLoginAttempts, consumeAuthAttempt, loginAccount } from "@/server/auth";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) }).strict();

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (isLocalDevelopment()) throw new HttpError(503, "Tài khoản cần PostgreSQL; tắt chế độ dữ liệu local để thử đăng nhập.");
    const parsed = credentials.safeParse(await readJSON(request, 10_000));
    if (!parsed.success) throw new HttpError(400, "Thông tin đăng nhập không hợp lệ.");
    consumeAuthAttempt("login", parsed.data.email);
    const account = await loginAccount(parsed.data.email, parsed.data.password);
    await setAccountCookie(account.token);
    clearLoginAttempts(parsed.data.email);
    return Response.json({ authenticated: true, account: { userId: account.userId, email: account.email } },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

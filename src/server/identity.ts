import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { HttpError } from "./errors";
import { isLocalDevelopment, isLocalDemo } from "./runtime-mode";
import { AUTH_COOKIE, GUEST_COOKIE, SESSION_MAX_AGE_SECONDS, findAccountSession, guestUserIdFromToken, isClaimedGuest, validAuthToken, validGuestToken } from "./auth";
export { HttpError } from "./errors";
export { isLocalDevelopment, isLocalDemo } from "./runtime-mode";

// A loopback-bound production build may serve the owner's existing local save
// through the authenticated preview gateway. Both opt-ins are required; normal
// production and Vercel continue to require Postgres and guest isolation.
const cookieSecure = () => process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

export async function accountIdentity() {
  if (isLocalDevelopment()) return null;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return validAuthToken(token) ? findAccountSession(token) : null;
}

export async function requireAccount() {
  const account = await accountIdentity();
  if (!account) throw new HttpError(401, "Cần đăng nhập để thực hiện thao tác này.");
  return account;
}

/** Read an existing guest identity without creating or changing a cookie. */
export async function existingGuestUserId() {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  return validGuestToken(token) ? guestUserIdFromToken(token) : null;
}

export async function setAccountCookie(token: string) {
  if (!validAuthToken(token)) throw new HttpError(500, "Không thể tạo phiên đăng nhập.");
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAccountCookie() {
  (await cookies()).delete(AUTH_COOKIE);
}

export async function rotateGuestCookie() {
  (await cookies()).set(GUEST_COOKIE, randomBytes(32).toString("hex"), {
    httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
}

export async function requireUser() {
  if(isLocalDevelopment()) return isLocalDemo() ? "local-demo-player" : "local-player";
  const jar=await cookies();
  const authToken = jar.get(AUTH_COOKIE)?.value;
  if (validAuthToken(authToken)) {
    const account = await findAccountSession(authToken);
    if (account) return account.userId;
  }
  let token=jar.get(GUEST_COOKIE)?.value;
  if(!validGuestToken(token)){
    token=randomBytes(32).toString("hex");
    jar.set(GUEST_COOKIE,token,{httpOnly:true,secure:cookieSecure(),sameSite:"lax",path:"/",maxAge:60*60*24*365});
  }
  const guestUserId=guestUserIdFromToken(token);
  if(await isClaimedGuest(guestUserId)) throw new HttpError(401,"Bản lưu khách đã chuyển sang tài khoản. Hãy đăng nhập để tiếp tục.");
  return guestUserId;
}
export function checkOrigin(request:Request) {
  const origin=request.headers.get("origin");
  const url=new URL(request.url);
  const configured=process.env.APP_ORIGIN;
  if(process.env.NODE_ENV==="production" && !isLocalDevelopment() && !configured) throw new HttpError(503,"Chưa cấu hình địa chỉ HTTPS của ứng dụng.");
  let expected:string;
  if(configured){
    let canonical:URL;
    try{canonical=new URL(configured);}catch{throw new HttpError(503,"Địa chỉ ứng dụng không hợp lệ.");}
    if(canonical.protocol!=="https:"||canonical.username||canonical.password||canonical.pathname!=="/"||canonical.search||canonical.hash)
      throw new HttpError(503,"Địa chỉ ứng dụng phải là HTTPS origin.");
    expected=canonical.origin;
  }else{
    // Local development can listen on 0.0.0.0 while the browser uses localhost.
    const host=request.headers.get("host")??url.host;
    expected=`${url.protocol}//${host}`;
  }
  if(!origin||origin!==expected) throw new HttpError(403,"Nguồn yêu cầu không hợp lệ.");
}
export function errorResponse(error:unknown) {
  if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status});
  if(error instanceof Error && error.name==="DomainError")return Response.json({error:error.message},{status:422});
  console.error("Request failed",error instanceof Error?error.name:"UnknownError");
  return Response.json({error:"Không thể xử lý yêu cầu. Dữ liệu chưa được xác nhận; hãy thử lại."},{status:500});
}

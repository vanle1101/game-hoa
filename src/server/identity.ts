import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
// A loopback-bound production build may serve the owner's existing local save
// through the authenticated preview gateway. Both opt-ins are required; normal
// production and Vercel continue to require Postgres and guest isolation.
export const isLocalDevelopment = () => process.env.LOCAL_DEV_MODE === "true" && !process.env.VERCEL &&
  (process.env.NODE_ENV !== "production" || process.env.PREVIEW_LOCAL_SAVE === "true");
export const isLocalDemo = () => isLocalDevelopment() && process.env.NODE_ENV === "development" && process.env.LOCAL_DEV_MOCK_MODE === "true";
export async function requireUser() {
  if(isLocalDevelopment()) return isLocalDemo() ? "local-demo-player" : "local-player";
  const jar=await cookies();
  let token=jar.get("lifelevel-session")?.value;
  if(!token||! /^[a-f0-9]{64}$/.test(token)){
    token=randomBytes(32).toString("hex");
    jar.set("lifelevel-session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production"||!!process.env.VERCEL,sameSite:"lax",path:"/",maxAge:60*60*24*365});
  }
  return createHash("sha256").update(`guest:${token}`).digest("hex");
}
export function checkOrigin(request:Request) {
  const origin=request.headers.get("origin");
  const url=new URL(request.url);
  // Next can expose the listening address (0.0.0.0) internally; Host remains the browser destination.
  const host=request.headers.get("host")??url.host;
  const protocol=request.headers.get("x-forwarded-proto")?.split(",")[0].trim()??url.protocol.slice(0,-1);
  if(!origin || !["http","https"].includes(protocol) || origin!==`${protocol}://${host}`) throw new HttpError(403,"Nguồn yêu cầu không hợp lệ.");
}
export function errorResponse(error:unknown) {
  if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status});
  if(error instanceof Error && error.name==="DomainError")return Response.json({error:error.message},{status:422});
  console.error("Request failed",error instanceof Error?error.name:"UnknownError");
  return Response.json({error:"Không thể xử lý yêu cầu. Dữ liệu chưa được xác nhận; hãy thử lại."},{status:500});
}

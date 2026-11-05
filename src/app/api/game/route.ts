import { requireUser, checkOrigin, errorResponse, isLocalDevelopment, isLocalDemo, HttpError } from "@/server/identity";
import { readGame } from "@/server/store";
import { submitGameIntent } from "@/server/command-intents";
import { commandSchema } from "@/server/validation";
import { readJSON } from "@/server/request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{const userId=await requireUser();const state=await readGame(userId);return Response.json({state,mode:isLocalDemo()?"mock":isLocalDevelopment()?"local":"production"},{headers:{"Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}
// Three supported 16×16 floors plus walls/openings/surfaces exceed 64 KiB.
// The bounded stream reader and strict per-component count limits both remain enforced.
export async function POST(request:Request){try{checkOrigin(request);const userId=await requireUser();const parsed=commandSchema.safeParse(await readJSON(request,1_000_000));if(!parsed.success)throw new HttpError(400,parsed.error.issues[0]?.message||"Dữ liệu không hợp lệ.");if(parsed.data.expectedOwnerId!==undefined&&parsed.data.expectedOwnerId!==userId)return Response.json({code:"OWNER_CHANGED",error:"Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục."},{status:409,headers:{"Cache-Control":"private, no-store"}});const outcome=await submitGameIntent(userId,parsed.data.key,parsed.data.action,parsed.data.expectedRevision);return Response.json(outcome.status==="applied"?outcome.result:{status:"pending",key:parsed.data.key},{status:outcome.status==="applied"?200:202,headers:{"Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}

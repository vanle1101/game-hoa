import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID, randomInt } from "node:crypto";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";
import { isLocalDevelopment } from "./runtime-mode";
import { HttpError } from "./errors";
import { database } from "./database";
import { applyAction, createInitialState } from "@/domain";
import { settleHousing } from "@/housing/engine";
import type { GameState, Action, ActionResult } from "@/domain/types";

export type DataEnvelope = { game:GameState; finance:unknown; proposals:Record<string,unknown>; commands:Record<string,{fingerprint:string;result:unknown}> };
function localRoot(){
  if(!isLocalDevelopment())throw new HttpError(503,"Local storage is available only in local development or the opt-in owner preview.");
  return process.env.LOCAL_DATA_DIR?path.resolve(process.env.LOCAL_DATA_DIR):path.join(process.cwd(),".local-data");
}
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(fn:()=>Promise<T>):Promise<T>{const next=queue.then(fn,fn);queue=next.catch(()=>undefined);return next;}
async function localRead(userId:string):Promise<DataEnvelope>{
  try{return JSON.parse(await readFile(path.join(localRoot(),`${userId}.json`),"utf8")) as DataEnvelope;}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;const data={game:userId==="local-demo-player"?createLocalDemoState(userId):createInitialState(userId),finance:null,proposals:{},commands:{}};if(userId==="local-demo-player")await localWrite(userId,data);return data;}
}
function createLocalDemoState(userId:string):GameState{
  const initial=createInitialState(userId);
  const settled=settleHousing(initial,{districtId:"district07",buildingId:"neon-haven",floor:8,layoutId:"studio"},initial.createdAt).state;
  settled.ownedFurniture["cloud-bed"]=(settled.ownedFurniture["cloud-bed"]??0)+1;
  settled.ownedFurniture["ceiling-neon"]=2;
  settled.gold=9_999;
  settled.ledger.push({id:"local-demo:gold",eventId:"local-demo:seed",amount:9_999,balance:9_999,reason:"Local test fixture",at:initial.createdAt});
  settled.journal.push({id:"local-demo:seed",type:"local-demo.seed",title:"Local test fixture created",at:initial.createdAt,data:{gold:9_999}});
  return settled;
}
async function localWrite(userId:string,data:DataEnvelope){const root=localRoot();await mkdir(root,{recursive:true});const dest=path.join(root,`${userId}.json`);const temp=dest+`.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(data),"utf8");await rename(temp,dest);}
export async function readGame(userId:string):Promise<GameState>{
  if(isLocalDevelopment())return serial(async()=>(await localRead(userId)).game);
  const d=database();await d.insert(schema.playerStates).values({userId,state:createInitialState(userId)}).onConflictDoNothing();
  const [row]=await d.select().from(schema.playerStates).where(eq(schema.playerStates.userId,userId));return row.state;
}
export async function gameCommand(userId:string,key:string,action:Action):Promise<ActionResult>{
  const fingerprint=createHash("sha256").update(JSON.stringify(action)).digest("hex");
  const perform=(state:GameState)=>{
    const context={userId,now:new Date().toISOString(),random:()=>randomInt(0,1_000_000)/1_000_000,eventId:randomUUID()};
    if(action.type==="reconcile")return applyAction(state,action,context);
    const settled=applyAction(state,{type:"reconcile"},{...context,eventId:randomUUID(),seedStarterTasks:false});
    const result=applyAction(settled.state,action,context);
    return {...result,events:[...settled.events,...result.events]};
  };
  if(isLocalDevelopment())return serial(async()=>{const data=await localRead(userId);const previous=data.commands[key];if(previous){if(previous.fingerprint!==fingerprint)throw new HttpError(409,"Mã thao tác đã được dùng cho nội dung khác.");return {...previous.result as Omit<ActionResult,"state">,state:data.game};}const result=perform(data.game);if(action.type==="reconcile"&&result.state.revision===data.game.revision)return result;data.game=result.state;if(action.type!=="reconcile")data.commands[key]={fingerprint,result:{events:result.events,message:result.message}};await localWrite(userId,data);return result;});
  await readGame(userId);const d=database();
  return d.transaction(async tx=>{
    const [row]=await tx.select().from(schema.playerStates).where(eq(schema.playerStates.userId,userId)).for("update");
    if (/^[a-f0-9]{64}$/.test(userId)) {
      const [claim] = await tx.select({ guestUserId: schema.guestClaims.guestUserId }).from(schema.guestClaims)
        .where(eq(schema.guestClaims.guestUserId, userId));
      if (claim) throw new HttpError(409, "Dữ liệu khách đã chuyển vào tài khoản; hãy đăng nhập để tiếp tục.");
    }
    const [prior]=await tx.select().from(schema.commandRecords).where(and(eq(schema.commandRecords.userId,userId),eq(schema.commandRecords.key,key)));
    if(prior){if(prior.fingerprint!==fingerprint)throw new HttpError(409,"Mã thao tác đã được dùng cho nội dung khác.");return {...prior.result as Omit<ActionResult,"state">,state:row.state};}
    const result=perform(row.state);
    if(action.type==="reconcile"&&result.state.revision===row.state.revision)return result;
    await tx.update(schema.playerStates).set({state:result.state,revision:result.state.revision,updatedAt:new Date()}).where(eq(schema.playerStates.userId,userId));
    if(action.type!=="reconcile")await tx.insert(schema.commandRecords).values({userId,key,fingerprint,result:{events:result.events,message:result.message}});return result;
  });
}
// Finance and AI storage keep their own payloads and never enter model context implicitly.
export async function readPrivate(userId:string,domain:"finance"|"proposals"):Promise<unknown>{
  if(isLocalDevelopment())return serial(async()=>(await localRead(userId))[domain]);
  await readGame(userId);const d=database();
  if(domain==="finance"){const [row]=await d.select().from(schema.financeStates).where(eq(schema.financeStates.userId,userId));return row?.state??null;}
  const rows=await d.select().from(schema.aiProposals).where(eq(schema.aiProposals.userId,userId));return Object.fromEntries(rows.map(r=>[r.id,r.proposal]));
}
export async function updateFinance<T>(userId:string,fn:(current:unknown)=>{state:unknown;result:T}):Promise<T>{
  if(isLocalDevelopment())return serial(async()=>{const data=await localRead(userId);const out=fn(data.finance);data.finance=out.state;await localWrite(userId,data);return out.result;});
  await readGame(userId);const d=database();return d.transaction(async tx=>{
    await tx.select().from(schema.playerStates).where(eq(schema.playerStates.userId,userId)).for("update");
    if (/^[a-f0-9]{64}$/.test(userId)) {
      const [claim] = await tx.select({ guestUserId: schema.guestClaims.guestUserId }).from(schema.guestClaims)
        .where(eq(schema.guestClaims.guestUserId, userId));
      if (claim) throw new HttpError(409, "Dữ liệu khách đã chuyển vào tài khoản; hãy đăng nhập để tiếp tục.");
    }
    const [row]=await tx.select().from(schema.financeStates).where(eq(schema.financeStates.userId,userId));const out=fn(row?.state??null);
    await tx.insert(schema.financeStates).values({userId,state:out.state}).onConflictDoUpdate({target:schema.financeStates.userId,set:{state:out.state,updatedAt:new Date()}});return out.result;
  });
}
export async function saveProposal(userId:string,id:string,proposal:unknown){
  if(isLocalDevelopment())return serial(async()=>{const data=await localRead(userId);data.proposals[id]=proposal;await localWrite(userId,data);});
  await readGame(userId);await database().transaction(async tx=>{
    await tx.select({ userId: schema.playerStates.userId }).from(schema.playerStates).where(eq(schema.playerStates.userId,userId)).for("update");
    if (/^[a-f0-9]{64}$/.test(userId)) {
      const [claim] = await tx.select({ guestUserId: schema.guestClaims.guestUserId }).from(schema.guestClaims)
        .where(eq(schema.guestClaims.guestUserId, userId));
      if (claim) throw new HttpError(409, "Dữ liệu khách đã chuyển vào tài khoản; hãy đăng nhập để tiếp tục.");
    }
    await tx.insert(schema.aiProposals).values({id,userId,proposal}).onConflictDoUpdate({target:schema.aiProposals.id,set:{proposal},setWhere:eq(schema.aiProposals.userId,userId)});
  });
}
export async function compareAndSetProposal(userId:string,id:string,expectedStatus:string,nextProposal:unknown):Promise<boolean>{
  if(isLocalDevelopment())return serial(async()=>{const data=await localRead(userId);const current=data.proposals[id] as {status?:string}|undefined;if(current?.status!==expectedStatus)return false;data.proposals[id]=nextProposal;await localWrite(userId,data);return true;});
  return database().transaction(async tx=>{
    await tx.select({ userId: schema.playerStates.userId }).from(schema.playerStates).where(eq(schema.playerStates.userId,userId)).for("update");
    if (/^[a-f0-9]{64}$/.test(userId)) {
      const [claim] = await tx.select({ guestUserId: schema.guestClaims.guestUserId }).from(schema.guestClaims)
        .where(eq(schema.guestClaims.guestUserId, userId));
      if (claim) throw new HttpError(409, "Dữ liệu khách đã chuyển vào tài khoản; hãy đăng nhập để tiếp tục.");
    }
    const [row]=await tx.select().from(schema.aiProposals).where(and(eq(schema.aiProposals.userId,userId),eq(schema.aiProposals.id,id))).for("update");
    if(!row||(row.proposal as {status?:string}).status!==expectedStatus)return false;
    await tx.update(schema.aiProposals).set({proposal:nextProposal,status:(nextProposal as {status:string}).status}).where(and(eq(schema.aiProposals.userId,userId),eq(schema.aiProposals.id,id)));
    return true;
  });
}

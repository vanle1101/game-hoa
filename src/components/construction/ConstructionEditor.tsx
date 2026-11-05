"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronDown, CircleDollarSign, Copy, DoorOpen, Eraser, Grid2X2, Hammer, Home, Layers3, LoaderCircle, MousePointer2, Move, Paintbrush, Redo2, RotateCw, Save, ShoppingBag, Square, Undo2, X } from "lucide-react";
import type { GameState } from "@/domain/types";
import { syncPendingGameCommand, type PendingGameCommand } from "@/components/game/command-client";
import { canApplyConstructionResponse, initialOwnedFurniture, migrateConstructionCommand, reconcileConstructionDraft, runConstructionCommand, validateConstructionState, type ConstructionAction, type ConstructionOwnerContext } from "./command-state";
import { CommandLockError, withOwnerCommandLock } from "@/components/game/command-lock";
import type { BuildingPlan, BuildingState, GridPoint } from "@/construction/types";
import { BUILDING_CATALOG, LEVEL_HEIGHT } from "@/construction/catalog";
import { getBuilding, quoteConstruction, validateConstruction } from "@/construction";
import { APARTMENT_TERRACE_PLOT, materializeWallOpenings } from "@/construction/migration";
import { buildShortcut } from "./build-shortcuts";
import { beginFurnitureMove, cancelFurnitureMove, finishFurnitureMove, furnitureSelectionIntent, type FurnitureMoveSession } from "./furniture-selection";
import { CAMERA_PAN_CODES } from "./input-codes";
import { useApartmentPlan, useApartmentStore } from "@/components/construction/apartment-store";
import { detectRooms } from "@/construction/topology";
import { adjacentCells, cellKey } from "@/construction/grid";
import { wallEdgesBetweenVertices } from "@/construction/wall-edges";
import { furnitureFootprint, occupiedCells } from "@/construction/navigation";
import { attachToSlot, moveFurnitureTree, nearestAvailableSlot, requiresSurfaceSlot, snapGroundedToWall, withLotObject, withoutFurnitureTree } from "@/construction/lot-objects";
import { isWallInsert, wallInsertPlacementValid } from "@/construction/wall-inserts";
import { FURNITURE, FURNITURE_TEST_MODE, PET_ACCESSORIES } from "@/domain/catalog";
import { levelProgress } from "@/domain/engine";
import { resolveEquipmentLoadout } from "@/equipment/loadout";
import { CURVE_FRAMES, CURVE_MATERIALS, CURVE_PROFILE_LIMITS, customizeCurve, isValidCurveProfile, snapCurveRotation } from "@/construction/curves";
import { addCurveDraft, moveCurveDraft, removeCurveDraft, rotateCurveDraft, addLedStripDraft, removeLedStripDraft, updateLedStripColor, demolishWallEdges, cellId, edgeId, pushDraft, undoDraft, redoDraft, toolDraft, type DraftHistory, type EdgeRef, type EditorSelection, type EditorTool } from "./draft";
import { getFurnitureProjection } from "@/components/furniture/furniture-projection";
import { clearServerDraft, DraftSyncError, draftFingerprint, readServerDraft, saveServerDraft, type SyncedDraft } from "./draft-sync-client";
import FluidMechanicalFrame from "@/components/game/FluidMechanicalFrame";
import "./construction.css";
import "../game/cyber-hud-modules.css";
import "./construction-frame.css";

const ConstructionWorld=dynamic(()=>import("@/components/construction/ConstructionWorld"),{ssr:false,loading:()=> <div className="world-loading"><LoaderCircle className="spin"/>Đang dựng kiến trúc…</div>});
function FurnitureThumbnail({item}:{item:(typeof FURNITURE)[number]}){
 const projection=getFurnitureProjection(item);
 if(!projection.faces.length)return <ShoppingBag size={28} style={{color:item.color}}/>;
 return <svg className="furniture-projection-svg" viewBox="0 0 100 92" aria-hidden="true" focusable="false">
  <ellipse cx="50" cy="83" rx="32" ry="5" fill="#06101b" opacity=".52"/>
  {projection.faces.map(face=><path key={face.key} d={face.path} fill={face.fill} fillOpacity={face.opacity} fillRule="evenodd"/>)}
 </svg>;
}
const BUY_CATEGORIES=[{id:"all",label:"Tất cả"},{id:"inventory",label:"📥 Kho đồ sở hữu"},{id:"doors",label:"Cửa"},{id:"windows",label:"Cửa sổ"},{id:"bed",label:"Giường"},{id:"sofa",label:"Sofa"},{id:"desk",label:"Bàn làm việc"},{id:"light",label:"Đèn"},{id:"plant",label:"Cây cảnh"},{id:"tech",label:"Công nghệ"},{id:"decor",label:"Trang trí"}] as const;
function matchesBuyCategory(f:typeof FURNITURE[number],category:string):boolean{if(category==="all")return true;if(category==="doors"||category==="windows")return f.category===category;if(category==="bed")return f.category==="bed";if(category==="sofa")return f.category==="seating"||f.category==="chair";if(category==="desk")return f.category==="desk";if(category==="light")return f.category==="light";if(category==="plant")return f.id.includes("plant")||f.name.toLowerCase().includes("cây")||f.id.includes("bonsai");if(category==="tech")return f.category==="electronics"||f.id.includes("pc")||f.id.includes("tower")||f.id.includes("terminal");if(category==="decor")return f.category==="decor"||f.category==="collectible"||f.category==="storage"||f.category==="kitchen"||f.category==="workshop";return true;}
const tools:{id:EditorTool;name:string;icon:typeof Home;hint:string}[]=[
 {id:"select",name:"Chọn",icon:MousePointer2,hint:"Chọn một cấu kiện để xem và chỉnh sửa."},
 {id:"room",name:"Phòng",icon:Square,hint:"Kéo từ góc đầu đến góc cuối để vẽ phòng. Có thể nhập tọa độ bên dưới."},
 {id:"wall",name:"Tường",icon:Grid2X2,hint:"Kéo giữa các giao điểm lưới để dựng từng đoạn 1m. Giữ Ctrl và kéo để tháo dỡ."},
 {id:"curve",name:"Kính cong",icon:RotateCw,hint:"Chọn mẫu rồi chạm lưới để đặt tâm cung. R xoay theo bước 15°. Cần sàn đỡ toàn bộ cung."},
 {id:"floor",name:"Sàn",icon:Layers3,hint:"Kéo vùng cần lát sàn."},
 {id:"door",name:"Cửa đi",icon:DoorOpen,hint:"Chạm vào cạnh tường để gắn cửa ra vào."},
 {id:"window",name:"Cửa sổ",icon:Grid2X2,hint:"Chạm vào tường để tạo cửa sổ thật."},
 {id:"paint",name:"Vật liệu",icon:Paintbrush,hint:"Chọn vật liệu rồi chạm tường."},
 {id:"erase",name:"Tháo dỡ",icon:Eraser,hint:"Rê lên cạnh tường để xem đoạn 1m; click hoặc kéo để tháo. Cửa gắn tường sẽ về kho."},
 {id:"move",name:"Di chuyển",icon:Move,hint:"Chọn kính cong hoặc nội thất rồi chạm vị trí mới."},
 {id:"copy",name:"Lấy mẫu",icon:Copy,hint:"Chạm sàn hoặc tường để lấy vật liệu."},
 {id:"ceiling",name:"Trần",icon:Layers3,hint:"Kéo vùng trần bên trên sàn."},
 {id:"roof",name:"Mái",icon:Home,hint:"Kéo vùng mái phẳng."},
 {id:"stairs",name:"Cầu thang",icon:Layers3,hint:"Mở ở cấp 3; cần sàn hỗ trợ tầng trên."},
 {id:"led",name:"Vẽ Dải Neon",icon:Layers3,hint:"Kéo trên sàn để vẽ dải LED thẳng theo trục X hoặc Z."},
];
const fixedApartmentHints:Partial<Record<EditorTool,string>>={
 select:"Chọn tường, mặt sàn, cửa hoặc nội thất để chỉnh sửa.",
 room:"Kéo vùng hoặc nhập tọa độ bên dưới để ngăn phòng tự do trong căn hộ 120 m².",
 wall:"Kéo dọc cạnh lưới trong căn hộ hoặc trên sân thượng để dựng tường.",
 floor:"Kéo vùng trên sân thượng để mở rộng mặt sàn.",
 door:"Chạm vào vách ngăn hoặc khung bao để gắn cửa đi.",
 window:"Chạm vào khung bao hoặc vách ngăn để mở cửa sổ.",
 paint:"Chọn vật liệu rồi chạm vào vách ngăn hoặc khung bao để ốp.",
 erase:"Click hoặc kéo qua từng đốt tường 1m, kể cả tường bao ngoài, để tháo dỡ.",
};
function isPerimeterWall(plot:BuildingState["plot"],wall:{x:number;z:number;level:number;orientation:"x"|"z"}){
 return wall.level===0&&((wall.orientation==="x"&&(wall.z===plot.minZ||wall.z===plot.maxZ)&&wall.x>=plot.minX&&wall.x<plot.maxX)||(wall.orientation==="z"&&(wall.x===plot.minX||wall.x===plot.maxX)&&wall.z>=plot.minZ&&wall.z<plot.maxZ));
}
function isAuthoritativeFixedApartment(building:BuildingState){
 return building.foundation?.mode==="fixed-apartment";
}
function applyApartmentRoomGesture(present:BuildingPlan,plot:BuildingState["plot"],a:GridPoint,b:GridPoint,floorMaterial:string,wallMaterial:string):BuildingPlan{
 const raw=toolDraft(present,"room",a,b,floorMaterial,undefined,wallMaterial);
 const minX=Math.max(plot.minX,Math.min(a.x,b.x)),maxX=Math.min(plot.maxX-1,Math.max(a.x,b.x)),minZ=Math.max(plot.minZ,Math.min(a.z,b.z)),maxZ=Math.min(plot.maxZ-1,Math.max(a.z,b.z));
 const floors=present.floors.map(cell=>cell.level===a.level&&cell.x>=minX&&cell.x<=maxX&&cell.z>=minZ&&cell.z<=maxZ?{...cell,materialId:floorMaterial}:cell);
 const shellByEdge=new Map(present.walls.filter(w=>isPerimeterWall(plot,w)).map(w=>[edgeId(w),w]));
 const walls=raw.walls.filter(w=>w.x>=plot.minX&&w.x<=plot.maxX&&w.z>=plot.minZ&&w.z<=plot.maxZ&&!(w.orientation==="x"&&w.x>=plot.maxX)&&!(w.orientation==="z"&&w.z>=plot.maxZ)&&(!isPerimeterWall(plot,w)||shellByEdge.has(edgeId(w)))).map(w=>shellByEdge.get(edgeId(w))??w);
 for(const shellWall of shellByEdge.values()){if(!walls.some(w=>edgeId(w)===edgeId(shellWall)))walls.push(shellWall);}
 return {...raw,floors,walls};
}
function applyApartmentFloorGesture(present:BuildingPlan,a:GridPoint,b:GridPoint,floorMaterial:string):BuildingPlan{
 return toolDraft(present,"floor",a,b,floorMaterial);
}
const curveMaterialLabels:Record<string,string>={clear:"Trong suốt",blue:"Xanh dương",violet:"Tím",frosted:"Kính mờ",smoke:"Khói"} satisfies Record<(typeof CURVE_MATERIALS)[number],string>;
const curveFrameLabels:Record<string,string>={aluminium:"Nhôm",graphite:"Than chì",brass:"Đồng thau"} satisfies Record<(typeof CURVE_FRAMES)[number],string>;
const defaults:Record<string,string>={room:"floor-concrete",floor:"floor-concrete",wall:"wall-basic",paint:"wall-basic",door:"door-standard",window:"window-small",ceiling:"ceiling-basic",roof:"roof-flat",stairs:"stairs-basic",curve:"curve-bay"};

interface ConstructionEditorProps { state:GameState;onState:(s:GameState)=>void;onExit:()=>void;onInteract:(s:string)=>void;startMode?:"live"|"build"|"buy";initialFurnitureId?:string; }

export default function ConstructionEditor(props:ConstructionEditorProps){
 return <OwnedConstructionEditor key={props.state.userId} {...props}/>;
}

function OwnedConstructionEditor({state,onState,onExit,onInteract,startMode="build",initialFurnitureId}:ConstructionEditorProps){
 const ownerId=state.userId;const equipment=resolveEquipmentLoadout(state);
 const ownerContext=useRef<ConstructionOwnerContext>({state,epoch:0});
 const active=useRef(false);const inFlight=useRef(false);
 useLayoutEffect(()=>{const context=ownerContext.current;active.current=true;return()=>{active.current=false;context.epoch+=1;};},[]);
 useLayoutEffect(()=>{if(state.revision>=ownerContext.current.state.revision)ownerContext.current.state=state;},[state]);
 const isCurrent=useCallback((epoch=ownerContext.current.epoch)=>active.current&&ownerContext.current.epoch===epoch&&ownerContext.current.state.userId===ownerId,[ownerId]);
 const [base,setBase]=useState<BuildingState>(()=>getBuilding(state));
 const [history,setHistory]=useState<DraftHistory>(()=>({past:[],present:structuredClone(getBuilding(state).plan),future:[]}));
  const historyRef=useRef(history);
  useLayoutEffect(()=>{historyRef.current=history;},[history]);
  const originalFurnitureState=useRef<FurnitureMoveSession|null>(null);
  const draftRevision=useRef<number|null>(null);
  const [lastSyncedDraft,setLastSyncedDraft]=useState(()=>draftFingerprint(getBuilding(state).plan));
  const draftSaving=useRef(false);
  const initialDraftLoad=useRef(false);
  const [draftLoaded,setDraftLoaded]=useState(false);
  const [draftStatus,setDraftStatus]=useState<"loading"|"saved"|"saving"|"error"|"conflict">("loading");
  const [staleDraft,setStaleDraft]=useState<SyncedDraft|null>(null);
 const [mode,setMode]=useState<"live"|"build"|"buy">(startMode);const [tool,setTool]=useState<EditorTool>("select");const [material,setMaterial]=useState("floor-concrete");const [wallMaterial,setWallMaterial]=useState("wall-basic");
 const [floor,setFloor]=useState(0);const [selection,setSelection]=useState<EditorSelection>(null);const [selectedFurniture,setSelectedFurniture]=useState(()=>initialOwnedFurniture(state,initialFurnitureId));const [activeFurniture,setActiveFurniture]=useState<BuildingPlan["furniture"][number]|undefined>(()=>{if(startMode!=="buy"||!initialFurnitureId)return undefined;const definition=FURNITURE.find(item=>item.id===initialFurnitureId);const placed=getBuilding(state).plan.furniture.filter(item=>item.furnitureId===initialFurnitureId).length+state.placements.filter(item=>item.furnitureId===initialFurnitureId).length;if(!definition||(state.ownedFurniture[initialFurnitureId]??0)<=placed)return undefined;return {id:"active-initial",furnitureId:initialFurnitureId,x:0,z:0,level:0,rotation:0,neonColor:state.furnitureNeonColors?.[initialFurnitureId]??definition.neonColor,placementType:definition.placementType};});const [rotation,setRotation]=useState<0|90|180|270>(0);const [cutaway,setCutaway]=useState(true);const [ceiling,setCeiling]=useState(false);const [cameraReset,setCameraReset]=useState(0);
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const [confirm,setConfirm]=useState(false);const [fps,setFps]=useState(0);const [manual,setManual]=useState(false);const [search,setSearch]=useState("");const [buyCategory,setBuyCategory]=useState<string>("all");const [ledColor,setLedColor]=useState("#00f0ff");const [pending,setPending]=useState<PendingGameCommand|null>(null);
 const [activeChildren,setActiveChildren]=useState<BuildingPlan["furniture"]>([]);
 const [liveLightId,setLiveLightId]=useState<string>();
 const [liveLightColor,setLiveLightColor]=useState("#ff8c3b");
 const [liveLightDimmer,setLiveLightDimmer]=useState(3);
 const [storageReady,setStorageReady]=useState(false);const [storageError,setStorageError]=useState("");
  const loadDraft=useCallback(async()=>{
   const epoch=ownerContext.current.epoch;
   try{
    const remote=await readServerDraft(ownerId);
    if(!isCurrent(epoch))return;
    draftRevision.current=remote?.draftRevision??null;
    if(remote&&remote.baseRevision!==base.revision){setStaleDraft(remote);setDraftStatus("conflict");setNotice("Có bản nháp từ phiên bản công trình cũ trên máy chủ. Hãy chọn khôi phục hoặc bỏ bản nháp.");}
    else if(remote){setHistory({past:[],present:materializeWallOpenings(remote.plan),future:[]});setLastSyncedDraft(draftFingerprint(remote.plan));setDraftStatus("saved");setNotice("Đã khôi phục bản nháp xây dựng từ máy chủ.");}
    else{setLastSyncedDraft(draftFingerprint(base.plan));setDraftStatus("saved");}
   }catch(error){if(isCurrent(epoch)){setDraftStatus("error");setNotice(error instanceof Error?error.message:"Không thể tải bản nháp từ máy chủ.");}}
   finally{if(isCurrent(epoch))setDraftLoaded(true);}
   },[ownerId,base.revision,base.plan,isCurrent,setDraftStatus,setNotice]);
  useEffect(()=>{if(initialDraftLoad.current)return;initialDraftLoad.current=true;queueMicrotask(()=>void loadDraft());},[loadDraft]);
 const refreshPending=useCallback(async()=>{const epoch=ownerContext.current.epoch;const getCurrentOwnerId=()=>active.current&&ownerContext.current.epoch===epoch?ownerContext.current.state.userId:undefined;try{await withOwnerCommandLock({ownerId,getCurrentOwnerId},async()=>{migrateConstructionCommand(window.sessionStorage,window.localStorage,ownerId);if(getCurrentOwnerId()!==ownerId)return;const serverPending=await syncPendingGameCommand(ownerId,window.localStorage);if(getCurrentOwnerId()!==ownerId)return;setPending(serverPending);setStorageError("");setStorageReady(true);});}catch(error){if(getCurrentOwnerId()===ownerId){setStorageError(error instanceof Error?error.message:"Không thể đọc thao tác đang chờ trên máy chủ.");setStorageReady(false);}}},[ownerId]);
 useEffect(()=>{let cancelled=false;queueMicrotask(()=>{if(!cancelled)void refreshPending();});const sync=(event:StorageEvent)=>{if(event.key===`lifelevel-pending-command:${ownerId}`)void refreshPending();};window.addEventListener("storage",sync);return()=>{cancelled=true;window.removeEventListener("storage",sync);};},[refreshPending,ownerId]);
  const transactionBlocked=!storageReady||!!storageError||!!pending;
   const editBlocked=busy||transactionBlocked||!draftLoaded||!!staleDraft||draftStatus==="conflict";
  const [curveInputs,setCurveInputs]=useState<{id:string;values:Partial<Record<"radius"|"angle"|"height"|"thickness",string>>}>({id:"",values:{}});
 const [curveRotation,setCurveRotation]=useState(0);
  const plan=mode==="live"?base.plan:history.present;const serializedPlan=useMemo(()=>draftFingerprint(history.present),[history.present]);const baseFingerprint=useMemo(()=>draftFingerprint(base.plan),[base.plan]);const dirty=serializedPlan!==baseFingerprint;const current=getBuilding(state);const conflict=current.revision!==base.revision;
  const draftUnsynced=dirty&&serializedPlan!==lastSyncedDraft;
  const draftCommitBlocked=!draftLoaded||draftUnsynced||draftStatus==="saving"||draftStatus==="error"||draftStatus==="conflict"||!!staleDraft;
  useEffect(()=>{
   if(!draftLoaded||staleDraft||draftStatus==="error"||draftStatus==="conflict"||!dirty||!draftUnsynced||pending||activeFurniture)return;
   const epoch=ownerContext.current.epoch;
   const timer=window.setTimeout(async()=>{
    if(draftSaving.current||!isCurrent(epoch))return;
    draftSaving.current=true;setDraftStatus("saving");
    try{
     const saved=await saveServerDraft(ownerId,historyRef.current.present,base.revision,draftRevision.current);
     if(!isCurrent(epoch))return;
     draftRevision.current=saved.draftRevision;
     setLastSyncedDraft(draftFingerprint(saved.plan));
     setDraftStatus("saved");
    }catch(error){if(isCurrent(epoch)){setDraftStatus(error instanceof DraftSyncError&&error.kind==="conflict"?"conflict":"error");setNotice(error instanceof Error?error.message:"Không thể đồng bộ bản nháp.");}}
    finally{draftSaving.current=false;}
   },500);
   return()=>window.clearTimeout(timer);
  },[draftLoaded,staleDraft,draftStatus,dirty,draftUnsynced,serializedPlan,pending,base.revision,isCurrent,ownerId,activeFurniture]);
  useEffect(()=>{if(!draftUnsynced)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[draftUnsynced]);
  async function restoreStaleDraft(){
   if(!staleDraft||draftSaving.current)return;
   const epoch=ownerContext.current.epoch;
   draftSaving.current=true;
   setDraftStatus("saving");
   try{
    const saved=await saveServerDraft(ownerId,materializeWallOpenings(staleDraft.plan),base.revision,staleDraft.draftRevision);
    if(!isCurrent(epoch))return;
    draftRevision.current=saved.draftRevision;setLastSyncedDraft(draftFingerprint(saved.plan));
    setHistory({past:[],present:structuredClone(saved.plan),future:[]});setStaleDraft(null);setDraftStatus("saved");setNotice("Đã khôi phục bản nháp cũ. Máy chủ sẽ kiểm tra giá và cấu trúc khi lưu công trình.");
   }catch(error){if(isCurrent(epoch)){setDraftStatus("conflict");setNotice(error instanceof Error?error.message:"Không thể khôi phục bản nháp.");}}
   finally{draftSaving.current=false;}
  }
  async function discardStaleDraft(){
   if(!staleDraft||draftSaving.current)return;
   const epoch=ownerContext.current.epoch;
   draftSaving.current=true;
   setDraftStatus("saving");
   try{
    await clearServerDraft(ownerId,staleDraft.draftRevision);
    if(!isCurrent(epoch))return;
    draftRevision.current=null;setLastSyncedDraft(draftFingerprint(base.plan));
    setStaleDraft(null);setDraftStatus("saved");setNotice("Đã bỏ bản nháp cũ trên máy chủ.");
   }catch(error){if(isCurrent(epoch)){setDraftStatus("conflict");setNotice(error instanceof Error?error.message:"Không thể bỏ bản nháp cũ.");}}
   finally{draftSaving.current=false;}
  }
  async function adoptServerDraftAfterConflict(){
   if(draftUnsynced&&!window.confirm("Bản nháp hiện tại chưa đồng bộ. Tải bản trên máy chủ sẽ thay thế những thay đổi này. Tiếp tục?"))return;
   setDraftStatus("loading");
   const epoch=ownerContext.current.epoch;
   try{
    const remote=await readServerDraft(ownerId);
    if(!isCurrent(epoch))return;
    draftRevision.current=remote?.draftRevision??null;
    if(remote&&remote.baseRevision!==base.revision){setStaleDraft(remote);setDraftStatus("conflict");setNotice("Bản nháp trên máy chủ thuộc phiên bản công trình cũ.");return;}
    const next=remote?.plan??base.plan;
    setLastSyncedDraft(draftFingerprint(next));
    setHistory({past:[],present:materializeWallOpenings(next),future:[]});setDraftStatus("saved");setNotice("Đã tải bản nháp mới nhất từ máy chủ.");
   }catch(error){if(isCurrent(epoch)){setDraftStatus("error");setNotice(error instanceof Error?error.message:"Không thể tải bản nháp.");}}
  }
 const sharedPlan=useApartmentPlan(ownerId,base.revision,base.plan,mode!=="live");
 useEffect(()=>{
   const store=useApartmentStore.getState();
   if(mode!=="live"&&dirty)store.edit(ownerId,history.present);
   else store.discard(ownerId);
 },[ownerId,mode,dirty,history.present]);
 useEffect(()=>()=>useApartmentStore.getState().discard(ownerId),[ownerId]);
 const context={gold:state.gold,characterLevel:levelProgress(state.character.xp).level,ownedFurniture:state.ownedFurniture,defeatedCampaign:state.campaigns.some(c=>!!c.completedAt)};
 let quote:ReturnType<typeof quoteConstruction>|undefined;let validation="";
 try{quote=quoteConstruction(base,history.present,state.gold);validateConstruction(base,history.present,context);}catch(e){validation=e instanceof Error?e.message:"Bản nháp không hợp lệ.";}
 const rooms=detectRooms(plan);const selectedWall=selection?.kind==="wall"?plan.walls.find(w=>edgeId(w)===selection.id):undefined;const selectedFloor=selection?.kind==="floor"?plan.floors.find(f=>cellId(f)===selection.id):undefined;const selectedPlaced=selection?.kind==="furniture"?plan.furniture.find(f=>f.id===selection.id):undefined;const selectedLed=selection?.kind==="led"?plan.ledStrips?.find(strip=>strip.id===selection.id):undefined;const activeOrSelectedFurniture=activeFurniture??selectedPlaced;const sellRefund=activeOrSelectedFurniture?Math.floor((FURNITURE.find(f=>f.id===activeOrSelectedFurniture.furnitureId)?.price??0)*0.8):0;
 const selectedCurve=selection?.kind==="curve"?(plan.curves??[]).find(curve=>curve.id===selection.id):undefined;
 const fixedApartment=isAuthoritativeFixedApartment(base);
 const legacyPreserved=base.foundation?.mode==="legacy-preserved"||(!fixedApartment&&base.plan.floors.length>0&&base.plan.floors.length<100);
 const plotSpanX=base.plot.maxX-base.plot.minX,plotSpanZ=base.plot.maxZ-base.plot.minZ,floorArea=plan.floors.length;
 const enclosedRooms=rooms.filter(r=>r.enclosed);
 const selectedWallRole=selectedWall?(isPerimeterWall(base.plot,selectedWall)?"Tường bao mặt ngoài · có thể tháo":"Vách ngăn nội thất · tùy chỉnh"):undefined;
 const curveInputError=!!selectedCurve&&curveInputs.id===selectedCurve.id&&Object.keys(curveInputs.values).length>0;
  function editCurveNumber(key:"radius"|"angle"|"height"|"thickness",raw:string){
   if(editBlocked||inFlight.current||!selectedCurve)return;
   const value=Number(raw);const profile={...selectedCurve,[key]:value};
   if(!raw.trim()||!isValidCurveProfile(profile)){setCurveInputs(previous=>({id:selectedCurve.id,values:{...(previous.id===selectedCurve.id?previous.values:{}),[key]:raw}}));return;}
   setCurveInputs(previous=>{const values={...(previous.id===selectedCurve.id?previous.values:{})};delete values[key];return {id:selectedCurve.id,values};});
   change({...history.present,curves:history.present.curves?.map(curve=>curve.id===selectedCurve.id?customizeCurve(curve,{[key]:value}):curve)});
  }
  function editCurveChoice(key:"material"|"frame",value:string){
   if(editBlocked||inFlight.current||!selectedCurve||!isValidCurveProfile({...selectedCurve,[key]:value}))return;
   change({...history.present,curves:history.present.curves?.map(curve=>curve.id===selectedCurve.id?customizeCurve(curve,{[key]:value}):curve)});
  }
  const affordability=dirty&&(quote?.insufficientGold??0)>0?`Cần thêm ${quote!.insufficientGold} Gold. Hoàn thành nhiệm vụ để tích lũy hoặc thu nhỏ bản thiết kế.`:"";
 const change=(p:BuildingPlan)=>{if(editBlocked||inFlight.current)return;setHistory(h=>pushDraft(h,p));setNotice("");};
 function placeLedStrip(start:GridPoint,end:GridPoint,color=ledColor){
  if(editBlocked||inFlight.current)return;
  const horizontal=Math.abs(end.x-start.x)>=Math.abs(end.z-start.z);
  const orthogonal=horizontal?{...end,z:start.z}:{...end,x:start.x};
  if(start.x===orthogonal.x&&start.z===orthogonal.z){setNotice("Kéo dải neon dài ít nhất một ô.");return;}
  const length=Math.max(Math.abs(orthogonal.x-start.x),Math.abs(orthogonal.z-start.z));
  const supported=new Set(history.present.floors.map(cellKey));
  if(length>24||Array.from({length:length+1},(_,index)=>cellKey({x:start.x+Math.sign(orthogonal.x-start.x)*index,z:start.z+Math.sign(orthogonal.z-start.z)*index,level:start.level})).some(key=>!supported.has(key))){setNotice("Dải neon cần sàn đỡ trên toàn bộ chiều dài (tối đa 25 ô).");return;}
  change(addLedStripDraft(history.present,start,orthogonal,color,crypto.randomUUID()));
 }
 function furnitureDefinition(item: BuildingPlan["furniture"][number]){return FURNITURE.find(def=>def.id===item.furnitureId);}
 function furniturePlacementValid(source: BuildingPlan, item: BuildingPlan["furniture"][number]){
  const definition=furnitureDefinition(item);
  const placementType = item.placementType ?? definition?.placementType ?? "floor";
  if(placementType==="wall_insert")return wallInsertPlacementValid(source,item);
  if(requiresSurfaceSlot(item.furnitureId)) return Boolean(item.parent_id&&item.slot_hash&&source.furniture.some(parent=>parent.id===item.parent_id&&parent.level===item.level&&furnitureDefinition(parent)?.slots?.some(slot=>slot.hash===item.slot_hash))&&!source.furniture.some(other=>other.id!==item.id&&other.parent_id===item.parent_id&&other.slot_hash===item.slot_hash));
  if(placementType==="wall") return Boolean(item.wallNormal&&Number.isFinite(item.wallY)&&item.wallY! >= 0&&item.wallY! <= 2.75);
  const cells=furnitureFootprint(item);
  if(!cells.length)return false;
  const floors=new Set(source.floors.filter(cell=>cell.level===item.level).map(cellKey));
  if(cells.some(cell=>!floors.has(cellKey(cell))))return false;
  const otherFurniture=source.furniture.filter(candidate=>candidate.id!==item.id);
  if(placementType!=="ceiling") {
   const blocked=occupiedCells({...source,furniture:otherFurniture});
   if(cells.some(cell=>blocked.has(cellKey(cell))))return false;
  } else {
   if(!Number.isFinite(item.ceilingY)||item.ceilingY! < 0||item.ceilingY! > LEVEL_HEIGHT) return false;
   const ceilingOccupied = new Set(otherFurniture.filter(candidate => {
    const candidateDefinition=furnitureDefinition(candidate);
    return (candidate.placementType ?? candidateDefinition?.placementType ?? "floor") === "ceiling";
   }).flatMap(furnitureFootprint).map(cellKey));
   if(cells.some(cell=>ceilingOccupied.has(cellKey(cell))))return false;
  }
  const stairs=new Set(source.stairs.filter(stair=>stair.level===item.level).map(cellKey));
  if(cells.some(cell=>stairs.has(cellKey(cell))))return false;
  const footprintKeys=new Set(cells.map(cellKey));
  return !source.walls.some(wall=>{
   const [a,b]=adjacentCells(wall);
   return footprintKeys.has(cellKey(a))&&footprintKeys.has(cellKey(b));
  });
 }
 function rotateFurniture(id:string, amount=90){
  if(editBlocked||inFlight.current)return;
  const current=history.present.furniture.find(item=>item.id===id);
  if(!current)return;
  if(isWallInsert(current)){setNotice("Cửa tự căn góc theo tường và không xoay 90°.");return;}
  pickUpFurniture(id);
  setActiveFurniture(item=>item?{...item,rotation:((item.rotation+amount+360)%360) as 0|90|180|270}:item);
  setNotice("Đã xoay bản xem trước. Click trái hoặc Enter để đặt; Esc để giữ nguyên vị trí và góc cũ.");
 }
 function rotateActiveFurniture(amount=90){
  if(editBlocked||inFlight.current)return;
  if(activeFurniture&&isWallInsert(activeFurniture)){setNotice("Cửa tự căn góc theo tường và không xoay 90°.");return;}
  setActiveFurniture(item=>item?{...item,rotation:((item.rotation+amount+360)%360) as 0|90|180|270}:item);
  setRotation(value=>((value+amount+360)%360) as 0|90|180|270);
 }
 function pickUpFurniture(id:string){
  if(editBlocked||inFlight.current)return;
  const move=beginFurnitureMove(history,id);
  if(!move)return;
  const item=move.originalItem;
  const definition=furnitureDefinition(item);
  const placementType: "floor" | "wall" | "ceiling" | "wall_insert" = item.placementType ?? definition?.placementType ?? "floor";
  const activeItem={...item,placementType};
  originalFurnitureState.current=move;
  setActiveChildren(move.children);
  setHistory(current=>({...current,present:move.preview}));
  setActiveFurniture(activeItem);
  setSelectedFurniture(item.furnitureId);
  setRotation(item.rotation);
  setSelection(null);
  setTool("move");
  setNotice(placementType==="wall_insert"?"Đã nhấc cửa. Rê lên tường rồi click trái hoặc Enter để đặt; Esc để hủy.":"Đã nhấc nội thất. Click trái hoặc Enter để đặt; Esc để trả về chỗ cũ.");
 }
 function placeActiveFurniture(point:GridPoint, placement?: { normal?:[number,number,number]; y?:number; ceilingY?:number; wallId?:string; wallU?:number }){
  if(editBlocked||inFlight.current||!activeFurniture)return;
  const definition=furnitureDefinition(activeFurniture);
  const placementType: "floor" | "wall" | "ceiling" | "wall_insert" = activeFurniture.placementType ?? definition?.placementType ?? "floor";
  const slot=requiresSurfaceSlot(activeFurniture.furnitureId)?nearestAvailableSlot(history.present,activeFurniture.furnitureId,point):undefined;
  const grounded=snapGroundedToWall(history.present,activeFurniture,point);
  const candidate=slot?attachToSlot({...activeFurniture,placementType},slot.parentId,slot.slotHash,history.present):withLotObject({...grounded,placementType,rotation:placementType==="wall_insert"?0:grounded.rotation,...(placement?.normal?{wallNormal:placement.normal,wallY:placement.y}:{}),...(placement?.wallId?{wall_id:placement.wallId,wall_u:placement.wallU}:{}),...(placement?.ceilingY!==undefined?{ceilingY:placement.ceilingY}:{} )});
  if(!candidate){setNotice("Món đồ nhỏ cần một khe trống trên mặt bàn.");return;}
  if(!furniturePlacementValid(history.present,candidate)){
   setNotice(placementType==="wall_insert"?"Cửa cần một dải tường liền, không có cửa khác.":definition?.placementType==="wall"?"Chọn đúng mặt tường để gắn vật phẩm.":"Vị trí mới không đủ sàn hoặc đang bị chắn. Hãy chọn một ô trống.");
   return;
  }
  const placed={...candidate,id:activeFurniture.id.startsWith("active-")?crypto.randomUUID():activeFurniture.id};
  const family={...history.present,furniture:[...history.present.furniture,placed,...activeChildren]};
  const placedPlan=activeChildren.length?moveFurnitureTree(family,placed):family;
  const original=originalFurnitureState.current;
  setHistory(current=>original?finishFurnitureMove(original,placedPlan):pushDraft(current,placedPlan));
  originalFurnitureState.current=null;
  setActiveFurniture(undefined);
  setActiveChildren([]);
  setSelection({kind:"furniture",id:placed.id});
  setNotice("Đã đặt nội thất.");
 }
 function restoreActiveFurniture(){
  if(!activeFurniture)return;
  if(originalFurnitureState.current){setHistory(cancelFurnitureMove(originalFurnitureState.current));originalFurnitureState.current=null;}
  setActiveFurniture(undefined);
  setActiveChildren([]);
  setNotice(activeFurniture.id.startsWith("active-")?"Đã trả vật phẩm mới vào Kho đồ sở hữu.":"Đã hủy di chuyển; vật phẩm trở về vị trí ban đầu.");
 }
 function placeOwnedFurniture(id:string){
  if(editBlocked||inFlight.current||activeFurniture)return;
  const placed=history.present.furniture.filter(item=>item.furnitureId===id).length+state.placements.filter(item=>item.furnitureId===id).length;
  if((state.ownedFurniture[id]??0)<=placed){setNotice("Món này đã được đặt hết. Hãy cất một bản vào kho hoặc mua thêm.");return;}
  const definition=FURNITURE.find(item=>item.id===id);
  if(!definition)return;
  setSelectedFurniture(id);
  setActiveFurniture({id:`active-${crypto.randomUUID()}`,furnitureId:id,x:0,z:0,level:floor,rotation,neonColor:state.furnitureNeonColors?.[id]??definition.neonColor,placementType:definition.placementType});
  setSelection(null);
  setTool("select");
  setNotice("Đang cầm nội thất trong kho. Chọn vị trí trống để đặt.");
 }
 function cancelAction(){
  if(busy||inFlight.current)return;
  if(activeFurniture) restoreActiveFurniture();
  setSelection(null);
  setSelectedFurniture("");
  setTool("select");
  setConfirm(false);
  if(!activeFurniture)setNotice("");
 }
 function stashFurniture(){
  if(editBlocked||inFlight.current)return;
  if(activeFurniture){const original=originalFurnitureState.current;if(original){setHistory(current=>finishFurnitureMove(original,current.present));originalFurnitureState.current=null;}setActiveFurniture(undefined);setActiveChildren([]);setSelection(null);setNotice("Đã cất nội thất cùng mọi món đặt trên nó vào kho. Lưu công trình để xác nhận.");return;}
  if(selectedPlaced){change(withoutFurnitureTree(history.present,selectedPlaced.id));setSelection(null);setNotice("Đã cất nội thất cùng mọi món đặt trên nó vào kho. Lưu công trình để xác nhận.");}
 }
 async function sellFurniture(target?:BuildingPlan["furniture"][number]){
  if(editBlocked||inFlight.current)return;
  const item=target??activeFurniture??selectedPlaced;
  if(!item){setNotice("Chọn một nội thất trước.");return;}
  const placementId=item.id.startsWith("active-")?undefined:item.id;
  if(placementId){
   const savedItem=base.plan.furniture.find(candidate=>candidate.id===placementId);
   if(!savedItem){setNotice("Hãy lưu công trình trước khi bán món vừa đặt.");return;}
   const expected=structuredClone(base.plan);
   expected.furniture=withoutFurnitureTree(expected,placementId).furniture;
   if(JSON.stringify(history.present)!==JSON.stringify(expected)&&JSON.stringify(history.present)!==JSON.stringify(base.plan)){
    setNotice("Hãy lưu hoặc hủy các thay đổi khác trước khi bán nội thất.");return;
   }
  }
  await command({type:"furniture.sell",furnitureId:item.furnitureId,...(placementId?{placementId}:{})});
 }
 function chooseTool(t:EditorTool){if(editBlocked||inFlight.current)return;if(t==="door"||t==="window"){setMode("buy");setBuyCategory(t==="door"?"doors":"windows");setTool("select");setSelection(null);return;}if(t==="move"&&selectedPlaced){pickUpFurniture(selectedPlaced.id);return;}setCurveInputs({id:"",values:{}});setTool(t);if(t!=="move")setSelection(null);if(defaults[t])setMaterial(defaults[t]);if(t==="wall")setWallMaterial("wall-basic");}
 function rotateCurve(amount:number){if(editBlocked||inFlight.current)return;if(selectedCurve){change(rotateCurveDraft(history.present,selectedCurve.id,selectedCurve.rotation+amount));}else setCurveRotation(value=>snapCurveRotation(value+amount));}
 function removeSelected(){if(editBlocked||inFlight.current)return;if(selectedLed){change(removeLedStripDraft(history.present,selectedLed.id));setSelection(null);return;}if(selectedCurve){change(removeCurveDraft(history.present,selectedCurve.id));setSelection(null);return;}if(selectedWall&&!selectedWall.opening){demolishEdges([selectedWall]);return;}const p=structuredClone(history.present);if(selectedWall){const w=p.walls.find(w=>edgeId(w)===edgeId(selectedWall))!;if(w.opening)delete w.opening;}if(selectedFloor){if(fixedApartment&&selectedFloor.x>=base.plot.minX&&selectedFloor.x<base.plot.maxX&&selectedFloor.z>=base.plot.minZ&&selectedFloor.z<base.plot.maxZ){setNotice("Mặt sàn gốc của căn hộ cần được giữ để đỡ công trình.");return;}p.floors=p.floors.filter(f=>cellId(f)!==selection?.id);p.ceilings=p.ceilings.filter(f=>cellId(f)!==selection?.id);p.roofs=p.roofs.filter(f=>cellId(f)!==selection?.id);}if(selectedPlaced)p.furniture=withoutFurnitureTree(p,selectedPlaced.id).furniture;change(p);setSelection(null);}
 function demolishEdges(edges:EdgeRef[]):number{
  if(editBlocked||inFlight.current)return 0;
  const targets=edges.filter(edge=>history.present.walls.some(wall=>edgeId(wall)===edgeId(edge)));
  const next=demolishWallEdges(history.present,targets);
  if(next===history.present)return 0;
  const before=quoteConstruction(base,history.present,state.gold).refund;
  const after=quoteConstruction(base,next,state.gold).refund;
  setHistory(current=>pushDraft(current,demolishWallEdges(current.present,targets)));
  setSelection(null);
  setNotice(after>before?`+${after-before} G hoàn lại khi lưu công trình. Cửa gắn trên đoạn tường đã về kho.`:"Đã tháo đoạn tường. Cửa gắn trên đoạn tường đã về kho.");
  return Math.max(0,after-before);
 }
 function gesture(a:GridPoint,b:GridPoint,edge?:EdgeRef){if(mode==="live"||editBlocked||inFlight.current)return;if(![a.x,a.z,a.level,b.x,b.z,b.level].every(Number.isFinite)){setNotice("Tọa độ phải là số hữu hạn.");return;}try{
   if(mode==="buy"){setNotice(activeFurniture?"Chọn vị trí để đặt vật phẩm đang cầm.":"Mua hoặc chọn một vật phẩm trước khi đặt.");return;}
   if(tool==="copy"){const w=edge&&plan.walls.find(w=>edgeId(w)===edgeId(edge));const f=plan.floors.find(f=>cellId(f)===cellId(a));if(w){setMaterial(w.materialId);setWallMaterial(w.materialId);setTool("paint");}else if(f){setMaterial(f.materialId);setTool("floor");}return;}
   if(tool==="curve"){const id=crypto.randomUUID();change(addCurveDraft(history.present,material,a,id,curveRotation));setSelection({kind:"curve",id});return;}
   if(tool==="wall"){
    if(wallEdgesBetweenVertices(a,b).length===0)return;
    setHistory(current=>pushDraft(current,toolDraft(current.present,"wall",a,b,material,edge,wallMaterial)));
    setNotice("");return;
   }
    if(tool==="move"){if(selectedCurve)change(moveCurveDraft(history.present,selectedCurve.id,b));else setNotice("Chọn kính cong hoặc nội thất trước khi di chuyển.");return;}
    if(tool==="select")return;
   if(fixedApartment&&tool==="room"){change(applyApartmentRoomGesture(history.present,base.plot,a,b,material,wallMaterial));return;}
   if(fixedApartment&&tool==="floor"){change(applyApartmentFloorGesture(history.present,a,b,material));return;}
   if(tool==="erase"&&edge){demolishEdges([edge]);return;}
   if(fixedApartment&&tool==="erase"){setNotice("Chọn một đốt tường hoặc vật phẩm để tháo dỡ.");return;}
   change(toolDraft(history.present,tool,a,b,material,edge,wallMaterial));
 }catch(e){setNotice((e as Error).message);}}
 function select(hit:NonNullable<EditorSelection>){if(mode==="live"||editBlocked||inFlight.current||activeFurniture)return;if(hit.kind==="led"){const strip=plan.ledStrips?.find(item=>item.id===hit.id);if(strip){setLedColor(strip.color);setSelection(hit);}return;}if(hit.kind==="curve"){const curve=(plan.curves??[]).find(item=>item.id===hit.id);if(!curve)return;if(tool==="erase"){change(removeCurveDraft(history.present,curve.id));setSelection(null);return;}if(tool==="copy"){setMaterial(curve.catalogId);setCurveRotation(curve.rotation);setTool("curve");setSelection(null);return;}setSelection(hit);if(tool==="curve")setTool("select");return;}if(hit.kind==="furniture"){const intent=furnitureSelectionIntent(tool,mode);if(intent==="sell"){const item=plan.furniture.find(candidate=>candidate.id===hit.id);if(item){void sellFurniture(item);return;}}if(intent==="pickup"){pickUpFurniture(hit.id);return;}setSelection(hit);return;}setSelection(hit);if(tool==="copy"){const w=plan.walls.find(w=>edgeId(w)===hit.id);const f=plan.floors.find(f=>cellId(f)===hit.id);if(w){setMaterial(w.materialId);setWallMaterial(w.materialId);setTool("paint");}else if(f){setMaterial(f.materialId);setTool("floor");}}}
  async function reload(discardDraft=false){
   if(busy||transactionBlocked||!draftLoaded||inFlight.current||!isCurrent())return;
   if(!discardDraft&&draftUnsynced&&!window.confirm("Bản nháp hiện tại chưa đồng bộ và sẽ bị thay thế khi tải lại. Tiếp tục?"))return;
   const epoch=ownerContext.current.epoch;inFlight.current=true;setBusy(true);
   try{
    if(discardDraft&&draftRevision.current!==null){await clearServerDraft(ownerId,draftRevision.current);draftRevision.current=null;}
    const response=await fetch("/api/game",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Không thể tải công trình mới nhất.");
   const latest=validateConstructionState(result.state,ownerId);
   if(!isCurrent(epoch))return;
   if(!canApplyConstructionResponse(ownerId,epoch,ownerContext.current,latest))throw new Error("Đã có dữ liệu mới hơn. Không thay bản nháp bằng phản hồi cũ.");
    const b=getBuilding(latest);
    const remote=discardDraft?null:await readServerDraft(ownerId);
    if(!isCurrent(epoch))return;
    ownerContext.current.state=latest;onState(latest);setBase(b);
    if(remote&&remote.baseRevision!==b.revision){setStaleDraft(remote);setDraftStatus("conflict");setHistory({past:[],present:structuredClone(b.plan),future:[]});}
    else{const next=remote?.plan??b.plan;setHistory({past:[],present:structuredClone(next),future:[]});setStaleDraft(null);setDraftStatus("saved");setLastSyncedDraft(draftFingerprint(next));}
    draftRevision.current=remote?.draftRevision??null;
    setActiveFurniture(undefined);setActiveChildren([]);setSelection(null);setConfirm(false);setNotice(remote&&remote.baseRevision!==b.revision?"Bản nháp máy chủ thuộc phiên bản công trình cũ. Hãy chọn khôi phục hoặc bỏ.":"Đã tải công trình mới nhất. Giao dịch chưa xác nhận vẫn được giữ để thử lại.");
  }catch(error){if(isCurrent(epoch))setNotice(error instanceof Error?error.message:"Không thể tải công trình. Bản nháp được giữ lại.");}finally{inFlight.current=false;if(isCurrent(epoch)){await refreshPending();if(isCurrent(epoch))setBusy(false);}}
 }
 async function command(action?:ConstructionAction){
  if(inFlight.current||!isCurrent())return;const epoch=ownerContext.current.epoch;inFlight.current=true;setBusy(true);setNotice("");
  try{
   const storage=window.localStorage;
   const retry=action?undefined:pending;const submitted=action??retry?.action;
   if(!submitted)throw new Error("Không có giao dịch đang chờ để thử lại.");
   const latest=await runConstructionCommand({storage,ownerId,action:submitted,revision:ownerContext.current.state.revision,retryKey:retry?.key,getCurrentOwnerId:()=>isCurrent(epoch)?ownerContext.current.state.userId:undefined,preflight:()=>migrateConstructionCommand(window.sessionStorage,storage,ownerId)});
   if(!isCurrent(epoch))return;
   setConfirm(false);
   if(!canApplyConstructionResponse(ownerId,epoch,ownerContext.current,latest)){setNotice("Giao dịch đã được xác nhận. Dữ liệu mới hơn và bản nháp hiện tại được giữ lại.");return;}
   ownerContext.current.state=latest;onState(latest);
    if(submitted.type==="construction.commit"){
     const b=getBuilding(latest);const submittedPlan=submitted.plan;
     let draftClearMessage="";
     if(JSON.stringify(historyRef.current.present)===JSON.stringify(submittedPlan)&&draftRevision.current!==null){
      try{await clearServerDraft(ownerId,draftRevision.current);draftRevision.current=null;setLastSyncedDraft(draftFingerprint(b.plan));}
      catch(error){draftClearMessage=error instanceof Error?` Công trình đã lưu nhưng ${error.message}`:" Công trình đã lưu nhưng chưa xóa được bản nháp cũ.";}
     }
     if(!isCurrent(epoch))return;
     setBase(b);setHistory(h=>reconcileConstructionDraft(h,base.plan,submittedPlan,b.plan));setSelection(null);setNotice(`Công trình đã lưu. Gold và kiến trúc được cập nhật cùng một giao dịch.${draftClearMessage}`);
   }else if(submitted.type==="furniture.buy"){const definition=FURNITURE.find(item=>item.id===submitted.furnitureId);setSelectedFurniture(initialOwnedFurniture(latest,submitted.furnitureId));setActiveChildren([]);setActiveFurniture({id:`active-${crypto.randomUUID()}`,furnitureId:submitted.furnitureId,x:0,z:0,level:floor,rotation,neonColor:latest.furnitureNeonColors?.[submitted.furnitureId]??definition?.neonColor,placementType:definition?.placementType??"floor"});setSelection(null);setNotice("Đã mua. Vật phẩm đang gắn với con trỏ; chọn vị trí để đặt rồi lưu bản nháp.");}
   else if(submitted.type==="furniture.sell"){const b=getBuilding(latest);ownerContext.current.state=latest;setBase(b);setHistory(h=>submitted.placementId?{past:[],present:structuredClone(b.plan),future:[]}:h);originalFurnitureState.current=null;setActiveFurniture(undefined);setActiveChildren([]);setSelection(null);setSelectedFurniture("");setNotice("Đã bán nội thất và hoàn lại Gold.");}
  }catch(error){if(isCurrent(epoch)){setNotice(error instanceof Error?error.message:"Chưa xác nhận được giao dịch. Hãy thử lại giao dịch đang chờ.");if(error instanceof CommandLockError&&error.code==="STALE_REVISION"){try{const response=await fetch("/api/game",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Không thể đồng bộ trạng thái.");const latest=validateConstructionState(result.state,ownerId);if(isCurrent(epoch)&&canApplyConstructionResponse(ownerId,epoch,ownerContext.current,latest)){ownerContext.current.state=latest;onState(latest);}}catch{if(isCurrent(epoch))setNotice("Trạng thái đã thay đổi. Hãy tải lại trạng thái trước khi gửi; bản nháp vẫn được giữ.");}}}}finally{inFlight.current=false;if(isCurrent(epoch)){await refreshPending();if(isCurrent(epoch))setBusy(false);}}
 }
  async function save(){if(activeFurniture){setNotice("Hãy đặt vật phẩm đang cầm hoặc nhấn Escape để trả lại vị trí cũ trước khi lưu.");return;}if(busy||transactionBlocked||draftCommitBlocked||conflict||validation||curveInputError||!dirty)return;await command({type:"construction.commit",expectedRevision:base.revision,plan:history.present});}
 async function buy(id:string){if(busy||transactionBlocked)return;await command({type:"furniture.buy",furnitureId:id});}
 function selectLiveLight(id:string){
  const item=base.plan.furniture.find(candidate=>candidate.id===id);
  if(!item)return;
  setLiveLightId(id);
  setLiveLightColor(item.light_color??item.neonColor??FURNITURE.find(def=>def.id===item.furnitureId)?.neonColor??"#ff8c3b");
  setLiveLightDimmer(item.light_dimmer_value??3);
 }
 async function saveLiveLight(id:string,color:string,dimmer:number){
  if(mode!=="live"||busy||transactionBlocked)return;
  const item=base.plan.furniture.find(candidate=>candidate.id===id);
  if(!item)return;
  const next=structuredClone(base.plan);
  next.furniture=next.furniture.map(candidate=>candidate.id===id?withLotObject({...candidate,light_color:color,neonColor:color,light_dimmer_value:dimmer}):candidate);
  await command({type:"construction.commit",expectedRevision:base.revision,plan:next});
 }
  useEffect(()=>{function key(e:KeyboardEvent){if(CAMERA_PAN_CODES.has(e.code)||e.isComposing||mode==="live"||busy||inFlight.current)return;if(activeFurniture&&e.code==="Escape"){e.preventDefault();cancelAction();return;}if(e.target instanceof HTMLElement&&(e.target.isContentEditable||["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)))return;if(editBlocked)return;const action=buildShortcut(e,mode==="build");if(!action)return;e.preventDefault();if(activeFurniture&&(action==="undo"||action==="redo")){setNotice("Đặt vật phẩm hoặc nhấn Esc để hủy trước khi hoàn tác.");return;}if(action==="undo"){setCurveInputs({id:"",values:{}});setHistory(h=>e.shiftKey?redoDraft(h):undoDraft(h));}else if(action==="redo"){setCurveInputs({id:"",values:{}});setHistory(redoDraft);}else if(action==="rotate"){if(activeFurniture)rotateActiveFurniture(e.shiftKey?-90:90);else if(selectedPlaced&&(mode==="build"||mode==="buy")){rotateFurniture(selectedPlaced.id,e.shiftKey?-90:90);}else if(mode==="build"&&tool==="curve")setCurveRotation(value=>snapCurveRotation(value+(e.shiftKey?-15:15)));else if(mode==="build"&&selection?.kind==="curve")setHistory(h=>{const curve=h.present.curves?.find(item=>item.id===selection.id);return curve?pushDraft(h,rotateCurveDraft(h.present,curve.id,curve.rotation+(e.shiftKey?-15:15))):h;});else setRotation(r=>(r+90)%360 as 0|90|180|270);}else if(action==="cancel")cancelAction();else if(action==="stash"){stashFurniture();setSelection(null);setSelectedFurniture("");}else if(action==="delete"){if(activeFurniture||selectedPlaced)void sellFurniture();else removeSelected();}else chooseTool(action);}window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[mode,tool,selection,selectedPlaced,activeFurniture,editBlocked,busy]);
 const activeFurnitureDetails=activeFurniture&&<div className="selection-details" data-rotation={activeFurniture.rotation}><span className="eyebrow">ĐANG CẦM</span><p>{FURNITURE.find(f=>f.id===activeFurniture.furnitureId)?.name??activeFurniture.furnitureId}</p>{!isWallInsert(activeFurniture)&&<small>Góc {activeFurniture.rotation}°</small>}<div className="curve-actions">{!isWallInsert(activeFurniture)&&<button onClick={()=>rotateActiveFurniture(90)}><RotateCw size={14}/>Xoay 90°</button>}<button onClick={stashFurniture}>📥 Cất kho</button><button className="construction-danger" onClick={()=>void sellFurniture()}>💰 Bán · +{sellRefund} G</button></div><p className="tool-hint">Click trái hoặc Enter tại vị trí xanh để đặt. Esc trả đồ về chỗ cũ; đồ mới sẽ về Kho. Chuột phải xoay đồ sàn.</p></div>;
 const category=tool==="room"?"floor":tool==="paint"?"wall":tool;const materials=BUILDING_CATALOG.filter(i=>i.category===category);
 function manualSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(editBlocked||inFlight.current)return;const f=new FormData(e.currentTarget);gesture({x:Number(f.get("x1")),z:Number(f.get("z1")),level:floor},{x:Number(f.get("x2")),z:Number(f.get("z2")),level:floor},{x:Number(f.get("x1")),z:Number(f.get("z1")),level:floor,orientation:String(f.get("edge")) as "x"|"z"});}
 return <div className={`construction-editor ${mode}`} aria-busy={busy} data-reduced-motion={state.settings.reducedMotion}>
  <header className="construction-top"><FluidMechanicalFrame frame="header" accent="magenta" animated={!state.settings.reducedMotion}/><button className="construction-back" onClick={()=>activeFurniture?setNotice("Hãy đặt hoặc nhấn Escape để trả vật phẩm về sàn trước khi rời trình xây dựng."):dirty?setNotice("Lưu hoặc hủy bản nháp trước khi rời trình xây dựng."):onExit()}><ArrowLeft size={18}/><span>LIFE<span>{"//"}</span>LEVEL</span></button><div className="mode-switch" role="group" aria-label="Chế độ không gian">{[["live","Sinh hoạt",Home],["build","Xây dựng",Hammer],["buy","Mua sắm",ShoppingBag]].map(([id,label,Icon])=>{const I=Icon as typeof Home;return <button disabled={editBlocked} key={String(id)} aria-pressed={mode===id} className={mode===id?"active":""} onClick={()=>{if(id==="live"&&(dirty||activeFurniture)){setNotice(activeFurniture?"Hãy đặt hoặc nhấn Escape để trả vật phẩm về sàn trước khi về sinh hoạt.":"Lưu hoặc hủy bản nháp trước khi về chế độ sinh hoạt.");return;}setMode(id as typeof mode);setSelection(null);}}><I size={16}/>{String(label)}</button>;})}</div><div className="construction-gold"><CircleDollarSign size={17}/><strong>{state.gold}</strong><span>GOLD</span></div></header>
  <div className="construction-viewport"><ConstructionWorld plan={sharedPlan??plan} plot={base.plot} paid={base.paid} showReferencePenthouse mode={mode} tool={mode==="buy"?"move":tool} materialId={material} wallMaterialId={wallMaterial} floorLevel={floor} residenceFloor={state.residence?.floor} curveRotation={curveRotation} movingCurve={tool==="move"?selectedCurve:undefined} onGesture={gesture} onDemolishEdges={demolishEdges} onSelect={select} onFurniturePlace={placeActiveFurniture} onFurnitureRotate={rotateActiveFurniture} activeFurniture={activeFurniture} selectedId={selection?.id} ghostFurniture={undefined} ledColor={ledColor} onLedStripPlace={placeLedStrip} character={state.character} cosmetics={state.equippedCosmetics} equipment={equipment} weaponId={equipment.weapon} activePet={state.pets.some(p=>p.id===state.activePetId)?{id:state.activePetId!,accessoryColor:PET_ACCESSORIES.find(a=>a.id===state.petAccessories?.[state.activePetId!])?.color}:undefined} quality={state.settings.graphics} onInteract={onInteract} onLightSelect={selectLiveLight} onLightToggle={(id,dimmer)=>{setLiveLightDimmer(dimmer);void saveLiveLight(id,base.plan.furniture.find(item=>item.id===id)?.light_color??base.plan.furniture.find(item=>item.id===id)?.neonColor??"#ff8c3b",dimmer);}} onNotice={setNotice} onFps={setFps} cameraReset={cameraReset} cutaway={cutaway} showCeiling={ceiling}/></div>
  {mode!=="live"&&<div className="construction-hud-status" aria-label="Trạng thái xây dựng"><div className="hud-badge hud-grid"><span className={`hud-dot ${mode==="build"?"active":""}`}/>Lưới xây dựng: {mode==="build"?"Bật":"Tắt"}</div><div className="hud-badge hud-ghost"><span className="hud-legend-title">Bóng ma:</span><span className="ghost-pill valid"><span className="dot cyan"/>Cyan hợp lệ</span><span className="ghost-pill invalid"><span className="dot red"/>Đỏ không hợp lệ</span></div></div>}
  <div className="construction-label"><span className="eyebrow">NEON HAVEN · XƯỞNG KIẾN TRÚC</span><h1>{mode==="live"?"Nhà của bạn. Phong cách của bạn.":mode==="buy"?"Sắp đặt không gian của bạn.":"Xây dựng chương tiếp theo."}</h1><p>{(fixedApartment?APARTMENT_TERRACE_PLOT:base.plot).maxX-(fixedApartment?APARTMENT_TERRACE_PLOT:base.plot).minX} × {(fixedApartment?APARTMENT_TERRACE_PLOT:base.plot).maxZ-(fixedApartment?APARTMENT_TERRACE_PLOT:base.plot).minZ} m khu đất · {rooms.filter(r=>r.enclosed).length} phòng · Phiên bản {base.revision}</p></div>
  <div className="construction-camera"><label>Tầng<select disabled={editBlocked} aria-label="Chọn tầng" value={floor} onChange={e=>setFloor(Number(e.target.value))}>{Array.from({length:base.plot.maxLevel+1},(_,n)=><option value={n} key={n}>{n+1}</option>)}</select></label><button className={cutaway?"on":""} onClick={()=>setCutaway(x=>!x)}>Cắt tường</button><button className={ceiling?"on":""} onClick={()=>setCeiling(x=>!x)}>Trần</button><button aria-label="Đặt lại góc nhìn" onClick={()=>setCameraReset(x=>x+1)}><RotateCw size={16}/></button></div>
  {mode!=="live"&&<><div className="construction-palette-shell"><FluidMechanicalFrame frame="sidebar" accent={mode==="buy"?"magenta":"cyan"} animated={!state.settings.reducedMotion}/><aside className="construction-palette"><fieldset disabled={editBlocked} className="construction-fields"><div className="palette-heading"><span className="eyebrow">{mode==="build"?"BỘ CÔNG CỤ XÂY DỰNG":"DANH MỤC NỘI THẤT"}</span><h2>{mode==="build"?tools.find(t=>t.id===tool)?.name:"Không gian của bạn"}</h2></div>{mode==="build"?<>
    <button type="button" className="construction-open-inventory" onClick={()=>{setMode("buy");setBuyCategory("inventory");}}>📥 Mở Kho đồ sở hữu</button>
    <p className="tool-hint">{tools.find(t=>t.id===tool)?.hint}</p><div className="material-list">{materials.map(m=><button key={m.id} className={material===m.id?"selected":""} onClick={()=>{setMaterial(m.id);if(m.category==="wall")setWallMaterial(m.id);}}><span className="material-swatch" style={{background:m.color}}/><span><strong>{m.name}</strong><small>{m.price} G · Cấp {m.level}{m.campaignUnlock?" · Bản thiết kế":""}</small>{m.curve&&<small className="curve-dimensions">R {m.curve.radius} m · {m.curve.angle}°<br/>Cao {m.curve.height} m · Dày {m.curve.thickness} m</small>}</span>{material===m.id&&<Check size={14}/>}</button>)}</div>
    {tool==="led"&&<div className="led-tool-panel"><label htmlFor="led-color">Màu dải neon</label><input id="led-color" aria-label="Màu dải neon" type="color" value={ledColor} onChange={e=>{setLedColor(e.target.value);if(selectedLed)change(updateLedStripColor(history.present,selectedLed.id,e.target.value));}}/><span>{ledColor.toUpperCase()}</span><p className="tool-hint">Kéo trên mặt sàn. Dải sẽ tự thẳng theo trục dài hơn.</p></div>}
    {(tool==="curve"||selectedCurve)&&<p className="curve-topology-note">Kính cong là vách ngăn, không tạo phòng kín. Phòng kín vẫn cần tường thẳng và cửa.</p>}
     {tool==="curve"&&<div className="curve-actions"><button aria-label="Xoay mẫu kính lùi 15 độ" onClick={()=>setCurveRotation(value=>snapCurveRotation(value-15))}>−15°</button><span>{curveRotation}°</span><button aria-label="Xoay mẫu kính tiến 15 độ" onClick={()=>setCurveRotation(value=>snapCurveRotation(value+15))}>+15°</button></div>}
     {tool==="room"&&<label>Vật liệu tường<select value={wallMaterial} onChange={e=>setWallMaterial(e.target.value)}>{BUILDING_CATALOG.filter(x=>x.category==="wall").map(x=><option key={x.id} value={x.id}>{x.name} · {x.price} G</option>)}</select></label>}
    {tool==="select"&&rooms.filter(r=>r.enclosed&&r.level===floor).map(r=><label key={r.id} className="construction-room-name">Tên phòng · {r.area} m²<input aria-label={`Tên phòng ${r.id}`} value={history.present.roomNames[r.id]??r.name} maxLength={60} onChange={e=>change({...history.present,roomNames:{...history.present.roomNames,[r.id]:e.target.value}})}/></label>)}
    {activeFurnitureDetails}
    {selection&&<div className="selection-details"><span className="eyebrow">ĐÃ CHỌN</span><p>{selectedWall?"Tường":selectedFloor?"Sàn":selectedLed?"Dải neon":selectedCurve?BUILDING_CATALOG.find(item=>item.id===selectedCurve.catalogId)?.name:selectedPlaced?FURNITURE.find(f=>f.id===selectedPlaced.furnitureId)?.name:selection.id}</p>{selectedLed&&<div className="curve-actions"><label>Màu <input aria-label="Đổi màu dải neon" type="color" value={selectedLed.color} onChange={e=>{setLedColor(e.target.value);change(updateLedStripColor(history.present,selectedLed.id,e.target.value));}}/></label><button className="construction-danger" onClick={removeSelected}>Xóa dải</button></div>}{selectedCurve&&<><div className="curve-profile">
       {([["radius","Bán kính","m"],["angle","Góc cung","°"],["height","Chiều cao","m"],["thickness","Độ dày","m"]] as const).map(([key,label,unit])=>{const invalid=curveInputs.id===selectedCurve.id&&curveInputs.values[key]!==undefined;return <div key={key}><label htmlFor={`curve-${key}`}>{label}</label><input id={`curve-${key}`} aria-label={`${label} kính cong`} aria-invalid={invalid} aria-describedby={invalid?"curve-profile-error":undefined} type="number" min={CURVE_PROFILE_LIMITS[key].min} max={CURVE_PROFILE_LIMITS[key].max} step={key==="angle"?CURVE_PROFILE_LIMITS.angle.step:"any"} value={invalid?curveInputs.values[key]:selectedCurve[key]} onChange={event=>editCurveNumber(key,event.target.value)} required/><small>{CURVE_PROFILE_LIMITS[key].min}–{CURVE_PROFILE_LIMITS[key].max} {unit}{key==="angle"?` · bước ${CURVE_PROFILE_LIMITS.angle.step}°`:""}</small></div>;})}
       <label>Vật liệu kính<select aria-label="Vật liệu kính cong" value={selectedCurve.material} onChange={event=>editCurveChoice("material",event.target.value)}>{CURVE_MATERIALS.map(value=><option key={value} value={value}>{curveMaterialLabels[value]}</option>)}</select></label>
       <label>Khung kính<select aria-label="Khung kính cong" value={selectedCurve.frame} onChange={event=>editCurveChoice("frame",event.target.value)}>{CURVE_FRAMES.map(value=><option key={value} value={value}>{curveFrameLabels[value]}</option>)}</select></label>
       {curveInputError&&<p id="curve-profile-error" role="alert">Nhập số trong giới hạn hiển thị; góc cung phải theo bước {CURVE_PROFILE_LIMITS.angle.step}°. Giá và hình xem trước giữ giá trị hợp lệ gần nhất.</p>}
      </div><p className="curve-dimensions">R {selectedCurve.radius} m · {selectedCurve.angle}° · Cao {selectedCurve.height} m<br/>Dày {selectedCurve.thickness} m · {curveMaterialLabels[selectedCurve.material]} / {curveFrameLabels[selectedCurve.frame]}<br/>Tâm ({selectedCurve.x}, {selectedCurve.z}) · Hướng {selectedCurve.rotation}°</p><div className="curve-actions"><button aria-label="Xoay kính đã chọn lùi 15 độ" onClick={()=>rotateCurve(-15)}>−15°</button><button aria-label="Xoay kính đã chọn tiến 15 độ" onClick={()=>rotateCurve(15)}>+15°</button><button className={tool==="move"?"selected":""} onClick={()=>setTool("move")}><Move size={14}/>Di chuyển</button></div><form className="curve-position" key={selectedCurve.id+":"+selectedCurve.x+":"+selectedCurve.z} onSubmit={event=>{event.preventDefault();if(editBlocked||inFlight.current)return;const values=new FormData(event.currentTarget);const x=Number(values.get("curve-x")),z=Number(values.get("curve-z"));if(!Number.isFinite(x)||!Number.isFinite(z)){setNotice("Tọa độ phải là số hữu hạn.");return;}change(moveCurveDraft(history.present,selectedCurve.id,{x,z,level:floor}));}}><label>Tâm X<input name="curve-x" type="number" step={1} min={base.plot.minX} max={base.plot.maxX} defaultValue={selectedCurve.x} required/></label><button type="submit">Đặt tâm</button></form></>}{selectedPlaced&&<div className="curve-actions">{!isWallInsert(selectedPlaced)&&<button aria-label="Xoay nội thất đã chọn sang phải 90 độ" onClick={()=>rotateFurniture(selectedPlaced.id,90)}><RotateCw size={14}/>Xoay 90°</button>}<button className={tool==="move"?"selected":""} onClick={()=>chooseTool("move")}><Move size={14}/>Di chuyển</button></div>}{!selectedPlaced&&<button className="construction-danger" onClick={removeSelected}>{selectedWall?.opening?"Tháo cửa / cửa sổ":"Tháo cấu kiện"}</button>}</div>}
    <button className="coordinates-toggle" aria-expanded={manual} onClick={()=>setManual(x=>!x)}>Nhập tọa độ chính xác <ChevronDown size={14}/></button>{manual&&<form className="coordinate-form" onSubmit={manualSubmit}><div>{["x1","z1","x2","z2"].map((n,i)=><label key={n}>{n.toUpperCase()}<input type="number" name={n} defaultValue={i<2?0:1} min={-16} max={16} required/></label>)}</div><label>Cạnh<select name="edge"><option value="x">X (ngang)</option><option value="z">Z (dọc)</option></select></label><button type="submit">Thêm vào bản nháp</button></form>}
   </>:<>{activeFurnitureDetails}<input className="catalog-search" aria-label="Tìm nội thất" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm nội thất…"/><div className="buy-category-pills" role="tablist" aria-label="Phân loại nội thất">{BUY_CATEGORIES.map(c=><button key={c.id} type="button" role="tab" id={`construction-category-${c.id}`} aria-controls="construction-buy-items" className={buyCategory===c.id?"active":""} aria-selected={buyCategory===c.id} onClick={()=>setBuyCategory(c.id)}>{c.label}</button>)}</div><div className="buy-items" id="construction-buy-items" role="tabpanel" aria-labelledby={`construction-category-${buyCategory}`}>{FURNITURE.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())&&(buyCategory==="inventory"?(state.ownedFurniture[f.id]??0)>plan.furniture.filter(p=>p.furnitureId===f.id).length+state.placements.filter(p=>p.furnitureId===f.id).length:matchesBuyCategory(f,buyCategory))).map(f=>{const placed=plan.furniture.filter(p=>p.furnitureId===f.id).length+state.placements.filter(p=>p.furnitureId===f.id).length;const owned=state.ownedFurniture[f.id]||0;const available=Math.max(0,owned-placed);return <article className={selectedFurniture===f.id?"selected":""} key={f.id}><button onClick={()=>{setSelectedFurniture(f.id);setSelection(null);}}><span className="furniture-thumbnail" style={{color:f.color}}><FurnitureThumbnail item={f}/></span><div className="catalog-badges">{owned>0?<span className="badge-owned">Đã sở hữu {owned}</span>:<span className="badge-unowned">Chưa mua</span>}{placed>0&&<span className="badge-placed">Đã đặt {placed}</span>}</div><strong>{f.name}</strong><small>{f.width} × {f.depth}m · Trong kho {available}</small></button><div><span>{buyCategory==="inventory"?"0 G":FURNITURE_TEST_MODE?"FREE":`${f.price} G`}</span>{buyCategory==="inventory"?<button disabled={editBlocked||!!activeFurniture||available<1} onClick={()=>placeOwnedFurniture(f.id)}>Đặt vào phòng</button>:<button disabled={busy||transactionBlocked||(!FURNITURE_TEST_MODE&&state.gold<f.price)} onClick={()=>buy(f.id)}>{FURNITURE_TEST_MODE?"Mua miễn phí":"Mua"}</button>}</div></article>;})}</div>{buyCategory==="inventory"&&FURNITURE.every(f=>(state.ownedFurniture[f.id]??0)<=plan.furniture.filter(p=>p.furnitureId===f.id).length+state.placements.filter(p=>p.furnitureId===f.id).length)&&<p className="tool-hint">Kho đồ đang trống. Mua nội thất hoặc cất một món đã đặt vào kho.</p>}<div className="buy-tools"><button onClick={()=>setRotation(r=>(r+90)%360 as 0|90|180|270)}><RotateCw size={16}/>Xoay {rotation}°</button></div><p className="tool-hint">{FURNITURE_TEST_MODE?"CHẾ ĐỘ TEST · Mua nội thất không trừ Gold.":"Mua thêm là giao dịch riêng. Di chuyển và cất đồ chỉ áp dụng khi lưu bản nháp."}</p></>}
  </fieldset></aside></div>
  <div className="construction-bottom-row"><div className="construction-toolbar-shell"><FluidMechanicalFrame frame="header" animated={!state.settings.reducedMotion}/><nav className="construction-toolbar" aria-label="Công cụ xây dựng">{tools.map(t=><button disabled={editBlocked} key={t.id} aria-label={t.name} title={t.name} aria-pressed={mode==="build"&&tool===t.id} className={mode==="build"&&tool===t.id?"selected":""} onClick={()=>{setMode("build");chooseTool(t.id);}}><t.icon size={20}/><span>{t.name}</span></button>)}<span className="construction-toolbar-divider" aria-hidden="true"/><button className="construction-toolbar-action" disabled={editBlocked||!activeOrSelectedFurniture} aria-label="Cất nội thất vào kho" title="Cất nội thất vào kho" onClick={stashFurniture}>📥<span>Cất kho</span></button><button className="construction-toolbar-action construction-toolbar-sell" disabled={editBlocked||!activeOrSelectedFurniture} aria-label="Bán nội thất" title={`Bán · hoàn ${sellRefund} vàng`} onClick={()=>void sellFurniture()}>💰<span>Bán</span></button></nav></div>
   <div className="draft-controls"><button aria-label="Hoàn tác bản nháp" disabled={editBlocked||!history.past.length} onClick={()=>{if(editBlocked||inFlight.current)return;setCurveInputs({id:"",values:{}});setHistory(undoDraft);}}><Undo2 size={17}/></button><button aria-label="Làm lại bản nháp" disabled={editBlocked||!history.future.length} onClick={()=>{if(editBlocked||inFlight.current)return;setCurveInputs({id:"",values:{}});setHistory(redoDraft);}}><Redo2 size={17}/></button><span>{dirty?"BẢN NHÁP CHƯA LƯU":"ĐÃ LƯU MỌI THAY ĐỔI"}{dirty&&<> · {draftStatus==="saving"||draftUnsynced?"ĐANG ĐỒNG BỘ BẢN NHÁP":draftStatus==="saved"?"BẢN NHÁP TRÊN MÁY CHỦ":"BẢN NHÁP CHƯA ĐỒNG BỘ"}</>}</span></div>
   <footer className="construction-cost"><FluidMechanicalFrame frame="achievements" accent="magenta" animated={!state.settings.reducedMotion}/><div><span className="eyebrow">CHI PHÍ DỰ KIẾN</span><strong>{quote?.netCost??"—"}<small> G</small></strong></div><div className="cost-breakdown"><span>Xây mới <b>{quote?.cost??0} G</b></span><span>Hoàn lại <b>{quote?.refund??0} G</b></span><span>Còn lại <b className={(quote?.remainingGold??0)<0?"danger":""}>{quote?.remainingGold??state.gold} G</b></span></div><div className="commit-actions"><button className="cancel" disabled={editBlocked} onClick={()=>void reload(true)}><X size={16}/>Hủy bản nháp</button><button className="commit" disabled={busy||transactionBlocked||draftCommitBlocked||!dirty||!!validation||curveInputError||conflict||(quote?.insufficientGold??0)>0} onClick={()=>setConfirm(true)}>{busy?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>}Lưu công trình</button></div></footer></div>
  </>}
  {mode==="live"&&<div className="construction-live-shell"><FluidMechanicalFrame frame="rewards" accent="magenta" animated={!state.settings.reducedMotion}/><aside className="construction-live-panel"><span className="eyebrow">CÔNG TRÌNH CỦA TÔI</span><h2>{rooms.filter(r=>r.enclosed).length} phòng · {plan.floors.length} m²</h2><p>Chạm mặt sàn để di chuyển. Chạm đèn để bật/tắt và chỉnh ánh sáng.</p>{liveLightId&&base.plan.furniture.some(item=>item.id===liveLightId)&&<div className="construction-light-controls"><strong>{FURNITURE.find(item=>item.id===base.plan.furniture.find(placed=>placed.id===liveLightId)?.furnitureId)?.name??"Đèn"}</strong><label>Màu ánh sáng <input type="color" value={liveLightColor} onChange={event=>setLiveLightColor(event.target.value)}/></label><label>Cường độ {liveLightDimmer}<input type="range" min="0" max="5" step="0.5" value={liveLightDimmer} onChange={event=>setLiveLightDimmer(Number(event.target.value))}/></label><button disabled={editBlocked} onClick={()=>void saveLiveLight(liveLightId,liveLightColor,liveLightDimmer)}>Lưu ánh sáng</button></div>}{rooms.slice(0,6).map(r=><div key={r.id}><span>{r.name}</span><small>{r.area} m²</small></div>)}<button disabled={editBlocked} onClick={()=>setMode("build")}><Hammer size={15}/>Tiếp tục xây dựng</button></aside></div>}
  <div className="construction-help"><span>{mode==="live" ? "PHÍM MŨI TÊN: DI CHUYỂN NHÂN VẬT · WASD: DI CHUYỂN CAMERA TỰ DO" : "WASD: DI CHUYỂN CAMERA · PHÍM MŨI TÊN: DI CHUYỂN NHÂN VẬT Ở SINH HOẠT · ESC HỦY / BỎ CHỌN · CTRL+Z HOÀN TÁC"}</span><span>{fps} FPS · {plan.walls.length} TƯỜNG · {plan.floors.length} Ô SÀN</span></div>
   {(staleDraft||draftStatus==="conflict"||draftStatus==="error")&&<div className="construction-notice invalid" role="status"><span>{staleDraft?"Bản nháp máy chủ thuộc phiên bản công trình cũ.":draftStatus==="conflict"?"Bản nháp đã đổi trên thiết bị khác; thay đổi ở đây chưa ghi đè lên máy chủ.":"Không thể đồng bộ bản nháp; công trình chưa thể lưu."}</span>{staleDraft?<><button disabled={busy} onClick={()=>void restoreStaleDraft()}>Khôi phục bản nháp cũ</button><button disabled={busy} onClick={()=>void discardStaleDraft()}>Bỏ bản nháp cũ</button></>:draftStatus==="conflict"?<button disabled={busy} onClick={()=>void adoptServerDraftAfterConflict()}>Dùng bản nháp trên máy chủ</button>:<button disabled={busy} onClick={()=>{if(draftUnsynced)setDraftStatus("saved");else void loadDraft();}}>Thử đồng bộ lại</button>}</div>}
   {(pending||storageError||notice||validation||affordability||conflict)&&<div className={`construction-notice ${pending||storageError||validation||affordability||conflict?"invalid":""}`} role="status">{storageError?<>{storageError} <button disabled={busy} onClick={refreshPending}>Thử đọc lại giao dịch</button></>:pending?<><span>{notice&&<>{notice} </>}Giao dịch {pending.action.type==="construction.commit"?"lưu công trình":pending.action.type==="furniture.buy"?`mua ${FURNITURE.find(item=>item.id===(pending.action.type==="furniture.buy"?pending.action.furnitureId:""))?.name??"nội thất"}`:pending.action.type==="furniture.sell"?"bán nội thất":"trước"} chưa được xác nhận. Bản nháp mới không thay thế giao dịch này. </span>{pending.action.type==="construction.commit"||pending.action.type==="furniture.buy"||pending.action.type==="furniture.sell"?<button disabled={busy} onClick={()=>command()}>Thử lại giao dịch đang chờ</button>:<button onClick={onExit}>Về màn hình chính để đồng bộ</button>}</>:notice|| (conflict?<>Công trình đã thay đổi ở thẻ khác. <button onClick={()=>void reload(false)}>Tải bản mới</button></>:validation||affordability)}{!pending&&!storageError&&<button aria-label="Đóng thông báo" onClick={()=>setNotice("")}><X size={14}/></button>}</div>}
  {busy&&<div className="construction-saving" role="status"><LoaderCircle className="spin"/>Đang đồng bộ…</div>}
   {confirm&&<div className="construction-confirm"><div><span className="eyebrow">LƯU THIẾT KẾ CỦA BẠN</span><h2>Lưu công trình?</h2><p>{quote?.added} cấu kiện mới · {quote?.removed} cấu kiện thay đổi/gỡ bỏ.</p><strong>{quote?.netCost} G</strong><p>Số dư sau giao dịch: {quote?.remainingGold} G. Máy chủ kiểm tra lại giá và phiên bản công trình trước khi lưu.</p><div><button onClick={()=>setConfirm(false)}>Quay lại</button><button disabled={busy||transactionBlocked||draftCommitBlocked} onClick={save}>{busy?"Đang lưu…":"Xác nhận lưu"}</button></div></div></div>}
 </div>;
}








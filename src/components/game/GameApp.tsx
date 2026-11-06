"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent } from "react";
import { newestGameState, readPendingCommand, syncPendingGameCommand, type PendingGameCommand } from "./command-client";
import { CommandLockError } from "./command-lock";
import { refreshGameState, runGameCommand, type GameSnapshot } from "./game-command-state";
import HousingOnboarding from "../housing/HousingOnboarding";
import FurnitureShop from "../furniture/FurnitureShop";
import dynamic from "next/dynamic";

import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowRight, Bell, BookOpen, Bot, Box, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CircleDollarSign, Clock3, Coffee, Compass, Cpu, Crosshair, Gem, Gift, Heart, Home, Layers3, LoaderCircle, PanelLeft, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Settings, Shield, ShoppingBag, Sparkles, Sword, Target, Trophy, Wallet, X, Zap } from "lucide-react";
import type { Action, GameState, Task, TaskInput } from "@/domain/types";
import { HOUSING_BUILDINGS, HOUSING_DISTRICTS } from "@/housing/catalog";
import { ACHIEVEMENTS, BOSSES, FURNITURE, ITEMS, MATERIALS, PET_ACCESSORIES, REWARDS, ROOMS } from "@/domain/catalog";
import { derivedStats, levelProgress } from "@/domain/engine";
import { resolveEquipmentLoadout } from "@/equipment/loadout";
import { useUi } from "./client-state";
import { SkillTargetSelect } from "./SkillTargetSelect";
import { useSkillTreeStore } from "./skill-tree-store";
import { getBuilding } from "@/construction/engine";
import { useApartmentPlan } from "@/components/construction/apartment-store";
import { FinancePanel } from "./FinancePanel";
import CareerPanel from "./CareerPanel";
import { ButlerPanel } from "./ButlerPanel";
import { AccountSettings, AuthGate, fetchAuthStatus, type AuthStatus } from "./AuthPanel";
import QuestManager from "./QuestManager";
import FocusSessionPanel from "./FocusSessionPanel";
import BossArena from "../combat/BossArena";
import CampaignMap from "../campaign/CampaignMap";
import CharacterStudio from "../character/CharacterStudio";
import CharacterAvatar from "../character/CharacterAvatar";
import CharacterPortraitCapture from "../character/CharacterPortraitCapture";
import { portraitKeyFor, useCharacterIdentity } from "../character/character-identity-store";
import { migrateLegacyPortrait } from "../character/portrait-client";
import { ReferenceInventory, ReferenceShop, ReferenceCrafting, ReferenceLoot, ReferenceSkills, ReferencePets } from "./ReferencePanels";
import { ConsumablesPanel, PersonalRewardsPanel } from "./ProgressionExtras";
import ConstructionEditor from "../construction/ConstructionEditor";
const ConstructionWorld=dynamic(()=>import("../construction/ConstructionWorld"),{ssr:false});
import "./game.css";
import "./cyber-chrome.css";
import { createApartmentFixture } from "../apartment-v21/fixture";
import { FIXED_APARTMENT_PLOT } from "@/construction/migration";
import LobbyDashboard from "./LobbyDashboard";
import { AnimatedLedBorder } from "./MechVectorFrame";
import "./mech-vector-frame.css";
import "./cyber-hud-modules.css";
import "./reference-fidelity.css";
import "./reference-upper-widgets.css";
import "./reference-lower-widgets.css";
import "./reference-rewards-tuning.css";
import "./reference-shell-tuning.css";
import "./reference-kit-shell-tuning.css";
import ReferenceHudOverlay from "./ReferenceHudOverlay";
import "./viewport-fit.css";

const Apartment=dynamic(()=>import("@/components/world/Apartment"),{ssr:false,loading:()=> <div className="world-loading"><LoaderCircle className="spin"/>Đang tải NEON HAVEN…</div>});
type IconType=typeof Home;
const screens:[string,string,IconType,string][]=[
 ["lobby","Sảnh chờ",Home,"WORLD"],["home","Cuộc sống",Home,"WORLD"],["quests","Nhiệm vụ",Check,"PRODUCTIVITY"],["calendar","Lịch trình",CalendarDays,"PRODUCTIVITY"],["campaigns","Chiến dịch",Compass,"PRODUCTIVITY"],
 ["arena","Đấu trường",Crosshair,"RPG"],["bosses","Thử thách trùm",Target,"RPG"],["loot","Chiến lợi phẩm",Gem,"RPG"],["character","Nhân vật",Activity,"RPG"],["equipment","Trang bị",Shield,"RPG"],["inventory","Túi đồ",Box,"RPG"],["skills","Cây kỹ năng",Layers3,"PROGRESS"],["career","Sự nghiệp",BriefcaseBusiness,"PROGRESS"],
 ["apartment","Căn hộ",Home,"WORLD"],["build","Xây dựng",Layers3,"WORLD"],["furniture","Nội thất",ShoppingBag,"WORLD"],["shop","Cửa hàng trang bị",Sword,"RPG"],["crafting","Chế tạo",Cpu,"RPG"],["farming","Tích lũy",Zap,"RPG"],["pets","Bạn đồng hành",Heart,"WORLD"],["achievements","Thành tựu",Trophy,"PROGRESS"],["finance","Tài chính",Wallet,"LIFE"],["rewards","Phần thưởng",Gift,"LIFE"],["butler","NOVA AI",Bot,"LIFE"],["journal","Nhật ký",BookOpen,"LIFE"],["settings","Cài đặt",Settings,"SYSTEM"],
];
const groupNames:Record<string,string>={WORLD:"THẾ GIỚI",PRODUCTIVITY:"CÔNG VIỆC",RPG:"NHẬP VAI",PROGRESS:"TIẾN BỘ",LIFE:"ĐỜI SỐNG",SYSTEM:"HỆ THỐNG"};
const skillNames:Record<string,string>={health:"Sức khỏe",knowledge:"Tri thức",career:"Sự nghiệp",finance:"Tài chính",relationships:"Kết nối",creativity:"Sáng tạo"};
const slotNames:Record<string,string>={weapon:"Vũ khí",head:"Mũ",chest:"Áo giáp",gloves:"Găng tay",boots:"Giày",accessory1:"Phụ kiện 1",accessory2:"Phụ kiện 2",relic:"Di vật"};

const bossTypeNames:Record<string,string>={daily:"Hằng ngày",weekly:"Hằng tuần",monthly:"Hằng tháng",campaign:"Chiến dịch",elite:"Tinh anh",legendary:"Huyền thoại"};
const graphicsNames:Record<string,string>={ultra:"Tối đa",high:"Cao",balanced:"Cân bằng",performance:"Hiệu năng"};
const difficultyNames:Record<string,string>={easy:"Nhẹ",medium:"Vừa",hard:"Khó",epic:"Sử thi"};
const icons:Record<string,IconType>={weapon:Sword,head:Cpu,chest:Shield,gloves:Zap,boots:Activity,accessory1:Gem,accessory2:Gem,relic:Sparkles};
const selfHeadedScreens=new Set(["arena","campaigns","loot","inventory","skills","shop","crafting","pets","finance","rewards","butler","character","furniture"]);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const levelOf=(xp:number)=>{const p=levelProgress(xp);return {...p,next:p.required};};
function Meter({value,max=100,color="cyan"}:{value:number;max?:number;color?:string}){return <div className={`meter ${color}`}><i style={{width:`${Math.max(0,Math.min(100,value/max*100))}%`}}/></div>;}
function PanelTitle({eyebrow,title,children}:{eyebrow:string;title:string;children?:ReactNode}){return <div className="panel-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{children}</div>;}
function Btn({children,onClick,disabled,variant="primary"}:{children:ReactNode;onClick?:()=>void;disabled?:boolean;variant?:string}){return <button className={`btn ${variant}`} disabled={disabled} onClick={onClick}>{children}</button>;}

export default function GameApp(){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:true,staleTime:15_000}}}));return <QueryClientProvider client={client}><Game/></QueryClientProvider>;}

function Game(){
 const queryClient=useQueryClient();const {screen,setScreen:rawSetScreen}=useUi();
 const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const getCurrent=()=>queryClient.getQueryData<GameSnapshot>(["game"]);
 const query=useQuery({queryKey:["game"],queryFn:({signal})=>refreshGameState({storage:localStorage,getCurrent,accept:snapshot=>queryClient.setQueryData(["game"],snapshot),isActive:()=>active.current&&!signal.aborted}),refetchOnWindowFocus:"always"});
 const authQuery=useQuery({queryKey:["auth"],queryFn:fetchAuthStatus,refetchOnWindowFocus:"always",retry:false});
 const [guestAccess,setGuestAccess]=useState(false);const [authSwitching,setAuthSwitching]=useState(false);
 const onAuthChanged=async()=>{setAuthSwitching(true);try{const status=await fetchAuthStatus();queryClient.removeQueries({queryKey:["lobby-finance"]});queryClient.removeQueries({queryKey:["game"]});queryClient.setQueryData(["auth"],status);await query.refetch();setGuestAccess(false);if(status.guestSaveAvailable&&status.authenticated)rawSetScreen("settings");}finally{setAuthSwitching(false);}};
 const [toast,setToast]=useState("");const [offline,setOffline]=useState(false);const [showTask,setShowTask]=useState(false);const [search,setSearch]=useState("");
 const commandBusy=useRef(false);const [pendingCommand,setPendingCommand]=useState<PendingGameCommand|null>(null);
 const [sidebarMode,setSidebarMode]=useState<"expanded"|"compact"|"hidden">("expanded");
 const [mobileLobbyNavOpen,setMobileLobbyNavOpen]=useState(false);
 useEffect(()=>{queueMicrotask(()=>{try{const saved=localStorage.getItem("lifelevel-sidebar-mode");if(saved==="expanded"||saved==="compact"||saved==="hidden")setSidebarMode(saved);}catch{/* Keep the session preference when browser storage is unavailable. */}});},[]);
 const changeSidebarMode=(mode:"expanded"|"compact"|"hidden")=>{setSidebarMode(mode);try{localStorage.setItem("lifelevel-sidebar-mode",mode);}catch{/* The current session still keeps the selected mode. */}};
const [cameraReset,setCameraReset]=useState(0);const [cameraMode,setCameraMode]=useState<"follow"|"free">("free");const [fps,setFps]=useState(0);const [placementKind,setPlacementKind]=useState("");const [placementNeonColor,setPlacementNeonColor]=useState("#00f0ff");const [featuredFurnitureId,setFeaturedFurnitureId]=useState<string|undefined>();const [rotation,setRotation]=useState(0);const [room,setRoom]=useState("living");
 const [visualFixture,setVisualFixture]=useState<"starter"|"developed"|null>(null);
 const setScreen=(next:string)=>{setMobileLobbyNavOpen(false);if(visualFixture&&next!=="home")return;if(next==="furniture")setFeaturedFurnitureId(undefined);rawSetScreen(next);};
 const openFurniture=(id:string)=>{if(visualFixture)return;setFeaturedFurnitureId(id);rawSetScreen("furniture");};
 const fixturePlan=useMemo(()=>visualFixture?createApartmentFixture(visualFixture==="starter"):null,[visualFixture]);
 const fixtureFocusApplied=useRef(false);
 useEffect(()=>{
  const value=new URLSearchParams(window.location.search).get("visualFixture");
  if(value!=="starter"&&value!=="developed")return;
  queueMicrotask(()=>{setVisualFixture(value);rawSetScreen("home");setCameraMode("free");});
 },[rawSetScreen]);
 useEffect(()=>{
  if((screen==="home"||screen==="apartment")&&!visualFixture&&
    !new URLSearchParams(window.location.search).has("visualFixture"))queueMicrotask(()=>{
   setCameraMode("free");
   setCameraReset(value=>value+1);
   fixtureFocusApplied.current=false;
  });
 },[screen,visualFixture]);
 useEffect(()=>{
  if((screen!=="home"&&screen!=="apartment")||cameraMode!=="free"||!fps||fixtureFocusApplied.current)return;
  fixtureFocusApplied.current=true;
  window.dispatchEvent(new CustomEvent("life-level:showcase-focus",{detail:{focus:"benchmark"}}));
 },[screen,visualFixture,cameraMode,fps]);
 const [draftPlace,setDraftPlace]=useState<{x:number;z:number}|null>(null);const [notifications,setNotifications]=useState(false);
 const [welcome,setWelcome]=useState(false);const [creating,setCreating]=useState(false);
 type GameIntent={ownerId:string;revision:number;action:Action;retryKey?:string};
 const syncCharacter=useCharacterIdentity((store)=>store.sync);
 const identity=useCharacterIdentity((store)=>store.identity);
 const mutation=useMutation({
  mutationFn:(intent:GameIntent)=>runGameCommand({...intent,storage:localStorage,session:sessionStorage,getCurrentOwnerId:()=>active.current?getCurrent()?.state.userId:undefined}),
  onSuccess:(data,intent)=>{
   if(!active.current||getCurrent()?.state.userId!==intent.ownerId)return;
   const previous=queryClient.getQueryData<GameSnapshot>(["game"])?.state;
   useSkillTreeStore.getState().hydrate(intent.ownerId);
   const skillTree=useSkillTreeStore.getState();
   const action=intent.action;
   const skillLevelUps:string[]=[];
   const completedOccurrenceId=action.type==="task.complete"?action.occurrenceId:action.type==="focus.confirm"?data.state.focusSessions?.find(session=>session.id===action.sessionId)?.occurrenceId:undefined;
   if(action.type==="task.complete"||action.type==="focus.confirm"){
    const completedRows=data.state.occurrences.filter(row=>row.status==="completed"&&row.rewardEventId&&(previous?(!previous.occurrences.some(old=>old.id===row.id&&old.status==="completed"&&old.rewardEventId===row.rewardEventId)||row.id===completedOccurrenceId):row.id===completedOccurrenceId));
    completedRows.forEach(occurrence=>{
     const task=data.state.tasks.find(row=>row.id===occurrence.taskId);if(!task?.targetSkillId)return;
     const target=useSkillTreeStore.getState().skills.find(skill=>skill.id===task.targetSkillId);
     const parent=target?.parentId?useSkillTreeStore.getState().skills.find(skill=>skill.id===target.parentId):undefined;
     const award=skillTree.awardSkillXp(intent.ownerId,task.targetSkillId,task.xpReward??100,occurrence.rewardEventId!);
     const updated=useSkillTreeStore.getState();
     if(award.childLevels>0){const level=updated.skills.find(skill=>skill.id===task.targetSkillId)?.level;if(target&&level)skillLevelUps.push(`${target.name} lên cấp ${level}`);}
     if(award.parentLevels>0){const level=parent&&updated.skills.find(skill=>skill.id===parent.id)?.level;if(parent&&level)skillLevelUps.push(`${parent.name} lên cấp ${level}`);}
    });
   }else if(action.type==="undo"&&previous){
    const reverted=previous.occurrences.filter(row=>row.status==="completed"&&row.rewardEventId&&!data.state.occurrences.some(next=>next.id===row.id&&next.status==="completed"));
    reverted.forEach(row=>skillTree.undoSkillXp(intent.ownerId,row.rewardEventId!));
   }
   queryClient.setQueryData<GameSnapshot>(["game"],saved=>saved?.state.userId===intent.ownerId?{...saved,state:newestGameState(saved.state,data.state)}:saved);
   syncCharacter(data.state);setToast(skillLevelUps.length?`${data.message} · ${skillLevelUps.join(" · ")}`:data.message);
  },
  onError:(error,intent)=>{if(!active.current||getCurrent()?.state.userId!==intent.ownerId)return;setToast(error.message);if(error instanceof CommandLockError&&error.code==="STALE_REVISION")void queryClient.invalidateQueries({queryKey:["game"]});},
  onSettled:()=>{commandBusy.current=false;if(active.current){const owner=getCurrent()?.state.userId;setPendingCommand(owner?readPendingCommand(localStorage,owner):null);}},
 });
 const state=query.data?.state;const activeIdentity=identity?.ownerId===state?.userId?identity:null;const building=useMemo(()=>state?getBuilding(state):null,[state]);
 const authMismatch=Boolean(authQuery.data&&!authQuery.data.localMode&&state&&(
   authQuery.data.authenticated?state.userId!==authQuery.data.account?.userId:state.userId.startsWith("account:")
 ));
 useEffect(()=>{if(state)syncCharacter(state);},[state,syncCharacter]);
 useEffect(()=>{if(state?.userId)useSkillTreeStore.getState().hydrate(state.userId);},[state?.userId]);
 const apartmentPlan=useApartmentPlan(state?.userId,building?.revision??-1,building?.plan??null,true);
 const busy=mutation.isPending;const act=(action:Action)=>{if(visualFixture){setToast("Chế độ đối chiếu chỉ đọc. Mở Home bình thường để lưu thay đổi.");return;}if(commandBusy.current||busy||!state)return;if(offline){setToast("Đang ngoại tuyến: kết nối lại để lưu thao tác.");return;}commandBusy.current=true;mutation.mutate({ownerId:state.userId,revision:state.revision,action});};
 useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);queueMicrotask(()=>{if(!localStorage.getItem("lifelevel-entered"))setWelcome(true);});if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
 const ownerId=state?.userId;
 useEffect(()=>{
  if(!ownerId||authMismatch)return;
  let current=true;
  const refresh=()=>{setPendingCommand(readPendingCommand(localStorage,ownerId));void syncPendingGameCommand(ownerId,localStorage)
    .then(pending=>{if(current)setPendingCommand(pending);})
    .catch(error=>{if(current)setToast(error instanceof Error?error.message:"Không đọc được tác vụ đang chờ trên máy chủ.");});};
  queueMicrotask(refresh);
  window.addEventListener("focus",refresh);
  const sync=(event:StorageEvent)=>{if(event.key===`lifelevel-pending-command:${ownerId}`)refresh();};
  window.addEventListener("storage",sync);
  return()=>{current=false;window.removeEventListener("focus",refresh);window.removeEventListener("storage",sync);};
 },[ownerId,authMismatch]);
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key==="lifelevel-state-changed")void queryClient.invalidateQueries({queryKey:["game"]});};window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync);},[queryClient]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),5000);return()=>clearTimeout(timer);},[toast]);
 if(authSwitching||authQuery.isPending)return <main className="boot"><div className="brand">LIFE<span>{"//"}</span>LEVEL</div><LoaderCircle className="spin"/><p>Đang xác minh phiên đăng nhập…</p></main>;
 if(authQuery.error)return <main className="boot"><p>{authQuery.error.message}</p><button className="btn ghost" onClick={()=>void authQuery.refetch()}>Thử lại</button></main>;
 if(authMismatch)return <main className="boot"><p>Đang tải dữ liệu của phiên hiện tại…</p><button className="btn ghost" onClick={()=>void query.refetch()}>Đồng bộ lại</button></main>;
 if(authQuery.data&&!authQuery.data.localMode&&!authQuery.data.authenticated&&!guestAccess){
  if(!state)return <main className="boot"><p>{query.error?.message||"Đang chuẩn bị bản lưu khách…"}</p><button className="btn ghost" onClick={()=>void query.refetch()}>Thử lại</button></main>;
  return <AuthGate onBeforeAuthenticate={async()=>{await migrateLegacyPortrait(state.userId,portraitKeyFor(state));}} onAuthenticated={onAuthChanged} onGuest={()=>setGuestAccess(true)}/>;
 }
 if(query.isPending&&!state)return <main className="boot"><div className="brand">LIFE<span>{"//"}</span>LEVEL</div><LoaderCircle className="spin"/><p>Đang kết nối thế giới của bạn…</p></main>;
 if(!state)return <main className="boot"><span className="eyebrow">NEON HAVEN</span><div className="brand">LIFE<span>{"//"}</span>LEVEL</div><h1>Cuộc sống của bạn. Tầm cao mới của bạn.</h1><p>{query.error?.message||"Kết nối lại để mở dữ liệu."}</p><button className="btn ghost" onClick={()=>query.refetch()}>Thử lại</button></main>;
 const level=levelOf(state.character.xp);const boss=state.bosses.find(b=>b.id===state.activeBossId);const bossDef=BOSSES.find(b=>b.id===boss?.definitionId);const equipment=resolveEquipmentLoadout(state);const weaponId=equipment.weapon;const lifeBoss=state.meaningfulBosses?.find(b=>b.id===state.activeMeaningfulBossId&&b.status!=="archived");
 const currentTasks=state.tasks.filter(t=>!t.archived);const open=state.occurrences.filter(o=>o.status==="open"&&o.date<=today());const completedToday=state.occurrences.filter(o=>o.status==="completed"&&o.date===today()).length;
 // Keep one navigation source and one grouped layout on every screen.
 const sidebarScreens = screens;
 const worldScreen=["home","apartment","build"].includes(screen);
 const activeScreen=screens.find(s=>s[0]===screen);const combatStats=derivedStats(state);
 const focusActive=Boolean(state.focusSessions?.some(session=>session.status==="running"||session.status==="ended"));
 const navigate=(s:string)=>{if(s==="recovery"){setScreen("character");setToast("Nghỉ ngơi ngoài đời rồi ghi nhận hồi phục trong hồ sơ nhân vật.");}else setScreen(s);};
 const complete=(task:Task)=>{const occurrence=state.occurrences.find(o=>o.taskId===task.id&&o.status==="open"&&o.date<=today());if(occurrence)act({type:"task.complete",occurrenceId:occurrence.id});else setToast("Nhiệm vụ này chưa đến lượt hoặc đã hoàn thành.");};
 const questRow=(task:Task)=>{const occurrence=state.occurrences.find(o=>o.taskId===task.id&&o.date===today())||state.occurrences.filter(o=>o.taskId===task.id).at(-1);const done=occurrence?.status==="completed";return <div className={`quest-row ${done?"done":""}`} key={task.id}><button className="quest-check" aria-label={`Hoàn thành ${task.title}`} onClick={()=>complete(task)} disabled={busy||done||offline}>{done?<Check size={15}/>:null}</button><div className="quest-text"><strong>{task.title}</strong><div><span className={`tag ${task.skill}`}>{skillNames[task.skill]}</span><span>{task.duration} phút</span>{task.committed&&<span className="danger">◆ Cam kết</span>}</div>{task.checklist.length>0&&<div className="checklist">{task.checklist.map(c=><label key={c.id}><input type="checkbox" checked={c.done} onChange={e=>act({type:"task.checklist",taskId:task.id,checklistId:c.id,done:e.target.checked})}/>{c.title}</label>)}</div>}</div><div className="quest-reward"><span>+{REWARDS[task.difficulty].xp} XP</span><small><CircleDollarSign size={11}/>{REWARDS[task.difficulty].gold}</small></div></div>;};

 if(["build","buy","architecture"].includes(screen))return <ConstructionEditor key={state.userId} state={state} initialFurnitureId={placementKind} startMode={screen==="architecture"?"live":screen==="buy"?"buy":"build"} onState={s=>{if(queryClient.getQueryData<{state:GameState}>(["game"])?.state.userId!==s.userId)return;queryClient.setQueryData<{state:GameState;mode?:string}>(["game"],current=>current?.state.userId===s.userId?{state:newestGameState(current.state,s),mode:current.mode}:current);}} onExit={()=>setScreen("home")} onInteract={navigate}/>;
 return <div className={`game-shell cyber-chrome ${worldScreen?"world-view":""} ${screen==="lobby"?"lobby-view bg-cover bg-center bg-fixed bg-no-repeat h-screen w-screen overflow-hidden flex":""} sidebar-${sidebarMode} ${sidebarMode==="compact"?"compact-nav":""} ${screen==="lobby"&&mobileLobbyNavOpen?"mobile-lobby-nav-open":""} ${state.settings.reducedMotion?"reduce-motion":""}`}>
  {screen==="lobby"&&<div className="lobby-city-overlay pointer-events-none absolute inset-0 bg-black/20" aria-hidden="true"/>}
  {screen==="lobby"&&<ReferenceHudOverlay reducedMotion={state.settings.reducedMotion}/>}
  {screen==="lobby"&&<button className="mobile-lobby-nav-toggle" type="button" aria-label={mobileLobbyNavOpen?"Đóng điều hướng":"Mở điều hướng"} aria-controls="main-sidebar" aria-expanded={mobileLobbyNavOpen} onClick={()=>setMobileLobbyNavOpen(open=>!open)}>{mobileLobbyNavOpen?<PanelLeftClose size={20} aria-hidden="true"/>:<PanelLeftOpen size={20} aria-hidden="true"/>}</button>}
  {screen==="lobby"&&mobileLobbyNavOpen&&<button className="mobile-lobby-nav-scrim" type="button" aria-label="Đóng điều hướng" onClick={()=>setMobileLobbyNavOpen(false)}/>}
  {activeIdentity&&!activeIdentity.avatarUrl&&<CharacterPortraitCapture key={`${state.userId}:${activeIdentity.portraitKey}`} state={state}/>}
  {screen==="lobby"&&sidebarMode==="hidden"&&<button className="lobby-sidebar-restore" type="button" aria-label="Mở rộng điều hướng" title="Mở rộng điều hướng" onClick={()=>changeSidebarMode("expanded")}><PanelLeftOpen size={18} aria-hidden="true"/></button>}
  <aside id="main-sidebar" className={`sidebar cyber-chrome-sidebar ${screen==="lobby"?"border border-cyan-500/30 bg-transparent":""}`} hidden={sidebarMode==="hidden"&&!(screen==="lobby"&&mobileLobbyNavOpen)} aria-label="Điều hướng LIFE//LEVEL">
    <AnimatedLedBorder className="cyber-sidebar-led" code="sidebar-rail" variant="chrome" size="medium" glowIntensity="soft" animationSpeed={10} animationEnabled={!state.settings.reducedMotion}/>
    <span className="cyber-sidebar-emitter" aria-hidden="true"/>
    <a className="brand" href="#" onClick={e=>{e.preventDefault();setScreen("lobby");}}>LIFE<span>{"//"}</span>LEVEL<small>KIẾN TẠO CUỘC SỐNG</small></a>
    <nav className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      {["WORLD","PRODUCTIVITY","RPG","PROGRESS","LIFE","SYSTEM"].map(group=><div className="nav-group" key={group}><span className="ml-2 mt-6 mb-3 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">{groupNames[group]}</span>{sidebarScreens.filter(s=>s[3]===group).map(([id,label,Icon])=><button key={id} className={`cyber-nav-item flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${screen===id?"active border border-blue-400/50 bg-gradient-to-r from-blue-900/60 to-purple-900/60 text-white shadow-[0_0_15px_rgba(34,211,238,0.25)]":"border border-transparent bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"}`} aria-current={screen===id?"page":undefined} title={label} aria-label={label} onClick={()=>setScreen(id)}><Icon size={17} className="shrink-0" aria-hidden="true"/><span>{label}</span>{id==="quests"&&<small>{open.length}</small>}{id===screen&&<i className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"/>}</button>)}</div>)}
    </nav>
    <div className="sidebar-footer"><p className="lobby-sidebar-motto">BETTER HABITS, HIGHER LEVELS, A BRIGHTER YOU</p><button className="lobby-sidebar-settings" onClick={()=>setScreen("settings")}>⚙ <span>Cài đặt</span></button><div className="lobby-sidebar-status"><div className="live-dot"/><span>{query.data?.mode==="mock"?"DỮ LIỆU TEST LOCALHOST":query.data?.mode==="local"?"PHÁT TRIỂN CỤC BỘ":"ĐÃ KẾT NỐI ĐÁM MÂY"}</span></div></div>
  </aside>
  <div className="main-shell"><header className="topbar cyber-chrome-topbar"><AnimatedLedBorder className="cyber-topbar-led" code="topbar-rail" variant="chrome" size="compact" glowIntensity="soft" animationSpeed={12} animationEnabled={!state.settings.reducedMotion}/><div className="breadcrumbs"><div className="sidebar-mode-controls" role="group" aria-label="Hiển thị điều hướng">
    <button className="icon-button" type="button" aria-controls="main-sidebar" aria-label="Mở rộng điều hướng" title="Mở rộng điều hướng" aria-pressed={sidebarMode==="expanded"} onClick={()=>changeSidebarMode("expanded")}><PanelLeftOpen size={17} aria-hidden="true"/></button>
    <button className="icon-button" type="button" aria-controls="main-sidebar" aria-label="Thu gọn điều hướng" title="Thu gọn điều hướng" aria-pressed={sidebarMode==="compact"} onClick={()=>changeSidebarMode("compact")}><PanelLeft size={17} aria-hidden="true"/></button>
    <button className="icon-button" type="button" aria-controls="main-sidebar" aria-label="Ẩn điều hướng" title="Ẩn điều hướng" aria-pressed={sidebarMode==="hidden"} onClick={()=>changeSidebarMode("hidden")}><PanelLeftClose size={17} aria-hidden="true"/></button>
  </div><span>NEON HAVEN</span><ChevronRight size={13}/><strong>{screens.find(s=>s[0]===screen)?.[1]||"Chế độ tập trung"}</strong></div><div className="top-actions"><button className="focus-pill" aria-label={focusActive?"Mở phiên tập trung đang lưu":"Mở bộ tập trung"} aria-current={screen==="focus"?"page":undefined} onClick={()=>setScreen("focus")}><Clock3 size={15} aria-hidden="true"/><span className="focus-pulse"/>{focusActive?"Đang tập trung":"Tập trung"}</button><span className="sync-status"><i className="live-dot"/>{offline?"NGOẠI TUYẾN":query.data?.mode==="mock"?"DỮ LIỆU TEST":"ĐÃ ĐỒNG BỘ"}</span><button className="wallet-chip" onClick={()=>setScreen("shop")}><CircleDollarSign size={17}/>{state.gold.toLocaleString()}<span>G</span></button><button className="icon-button notification-button" aria-label="Thông báo" onClick={()=>setNotifications(!notifications)}><Bell size={19}/><i/></button><button className="profile-chip" aria-label={`Nhân vật ${activeIdentity?.name??state.character.name}, cấp ${activeIdentity?.level??level.level}`} onClick={()=>setScreen("character")}><CharacterAvatar ownerId={state.userId} fallbackName={state.character.name}/><small>{activeIdentity?.level??level.level}</small></button></div></header>
  {offline&&<div className="offline-banner">Đang xem phiên hiện tại. Kết nối mạng để hoàn thành việc hoặc giao dịch.</div>}
   {pendingCommand&&!busy&&<div className="offline-banner" role="status"><span>Một thao tác đang chờ xác nhận kết quả.</span><button className="btn ghost" disabled={offline} onClick={()=>{if(commandBusy.current)return;commandBusy.current=true;mutation.mutate({ownerId:pendingCommand.ownerId,revision:state.revision,action:pendingCommand.action,retryKey:pendingCommand.key});}}>Đồng bộ lại</button></div>}
 {worldScreen?<main className="world-main"><div className="world-canvas">{building?<ConstructionWorld plan={fixturePlan??apartmentPlan??building.plan} plot={visualFixture?FIXED_APARTMENT_PLOT:building.plot} mode="live" tool="select" floorLevel={0} residenceFloor={visualFixture?8:state.residence?.floor} cutaway showReferencePenthouse={screen==="home"||screen==="apartment"||!!visualFixture} onGesture={()=>{}} onSelect={()=>{}} onInteract={navigate} onNotice={setToast} onFps={setFps} cameraReset={cameraReset} cameraMode={cameraMode} onCameraModeChange={mode=>{if(mode!=="build")setCameraMode(mode)}} character={visualFixture?undefined:state.character} cosmetics={visualFixture?undefined:state.equippedCosmetics} equipment={visualFixture?undefined:equipment} weaponId={visualFixture?undefined:weaponId} activePet={visualFixture?undefined:state.pets.some(p=>p.id===state.activePetId)?{id:state.activePetId!,accessoryColor:PET_ACCESSORIES.find(a=>a.id===state.petAccessories?.[state.activePetId!])?.color}:undefined} quality={visualFixture?"high":state.settings.graphics}/>:<Apartment onInteract={navigate} placements={state.placements.filter(p=>p.roomId===room).map(p=>({id:p.id,kind:p.furnitureId,x:p.x,z:p.z,rotation:p.rotation,neonColor:p.neonColor??state.furnitureNeonColors?.[p.furnitureId]}))} buildMode={screen==="build"} ghostKind={placementKind} ghostRotation={rotation} onPlace={(x,z)=>setDraftPlace({x,z})} skin={state.character.skin} outfit={state.character.outfit} hair={state.character.hair} hairstyle={state.character.hairstyle} appearance={state.character.appearance} cosmetics={state.equippedCosmetics} weaponId={weaponId} equipment={equipment} roomId={room} quality={state.settings.graphics} activePet={state.pets.length>0} cameraReset={cameraReset} onFps={setFps}/>}</div>
    <div className="world-heading"><span className="eyebrow"><i className="live-dot"/> {visualFixture?`QA READ-ONLY · ${visualFixture.toUpperCase()} FIXTURE`:state.residence?`${(HOUSING_DISTRICTS.find(d=>d.id===state.residence?.districtId)?.name||state.residence.districtId||"KHU 07").toUpperCase()} · TẦNG ${state.residence.floor??8}`:"KHU 07 · CHỐN BÌNH YÊN CỦA BẠN"}</span><h1>{screen==="build"?"Không gian mang dấu ấn riêng.":screen==="apartment"?"Nơi bạn trưởng thành.":"Chào mừng về nhà,"}<em>{screen==="home"?state.character.name:ROOMS.find(r=>r.id===room)?.name||"Chốn bình yên"}<span> ↗</span></em></h1><p>{visualFixture?"Bản đối chiếu hình ảnh chỉ đọc · dữ liệu thật được giữ nguyên.":screen==="build"?"Chọn nội thất, chạm lên sàn và xác nhận vị trí.":state.residence?`${HOUSING_BUILDINGS.find(b=>b.id===state.residence?.buildingId)?.name||state.residence.buildingId||"Neon Haven"} · Thành phố không ngừng chuyển động.`:"Thành phố không ngừng chuyển động. Bạn cũng vậy."}</p></div>
    <div className="world-controls"><div className="camera-mode-switch" role="group" aria-label="Chế độ camera"><button className={cameraMode==="follow"?"active":""} onClick={()=>setCameraMode("follow")}>Theo nhân vật</button><button className={cameraMode==="free"?"active":""} onClick={()=>setCameraMode("free")}>Tự do</button></div><div className="camera-mode-switch" role="group" aria-label="Quan sát nhân vật">{([["front","Trước mặt"],["rear","Sau lưng"],["left","Trái"],["right","Phải"],["face","Cận mặt"]] as const).map(([preset,label])=><button key={preset} onClick={()=>window.dispatchEvent(new CustomEvent("life-level:camera-preset",{detail:{preset}}))}>{label}</button>)}</div><button className="icon-button" aria-label="Đặt lại camera" title="Đặt lại camera (Home)" onClick={()=>setCameraReset(v=>v+1)}><RotateCcw size={17}/></button><button className={`btn ${screen==="build"?"primary":"glass"}`} onClick={()=>setScreen(screen==="build"?"home":"build")}><Layers3 size={15}/>{screen==="build"?"Xong":"Chế độ xây dựng"}</button><span>{fps?`${fps} FPS`:"THẾ GIỚI 3D"}</span></div>
    {screen==="build"?<section className="build-panel glass-panel"><span className="eyebrow">CHẾ ĐỘ XÂY DỰNG</span><h3>Thiết kế không gian</h3><label>Phòng<select value={room} onChange={e=>setRoom(e.target.value)}>{state.unlockedRooms.map(id=><option key={id} value={id}>{ROOMS.find(r=>r.id===id)?.name||id}</option>)}</select></label><label>Nội thất sở hữu<select value={placementKind} onChange={e=>{setPlacementKind(e.target.value);setPlacementNeonColor(state.furnitureNeonColors?.[e.target.value]??FURNITURE.find(f=>f.id===e.target.value)?.neonColor??"#00f0ff");setDraftPlace(null);}}><option value="">Chọn vật phẩm</option>{FURNITURE.filter(f=>(state.ownedFurniture[f.id]||0)>0).map(f=><option key={f.id} value={f.id}>{f.name} ×{state.ownedFurniture[f.id]}</option>)}</select></label>{placementKind&&<label>Màu LED<input type="color" aria-label="Màu LED nội thất" value={placementNeonColor} onChange={e=>setPlacementNeonColor(e.target.value)}/></label>}<Btn variant="ghost" onClick={()=>setRotation(r=>(r+90)%360)}><RotateCcw size={14}/>Xoay {rotation}°</Btn>{draftPlace&&<p>Vị trí: {draftPlace.x}, {draftPlace.z}</p>}<Btn disabled={!draftPlace||!placementKind||busy} onClick={()=>{if(draftPlace)act({type:"furniture.place",furnitureId:placementKind,roomId:room,...draftPlace,rotation,neonColor:placementNeonColor});setDraftPlace(null);}}>Lưu vị trí</Btn><Btn variant="ghost" onClick={()=>{setDraftPlace(null);setPlacementKind("");}}>Hủy</Btn><h4>Đã đặt</h4>{state.placements.filter(p=>p.roomId===room).map(p=><div className="small-row" key={p.id}>{FURNITURE.find(f=>f.id===p.furnitureId)?.name}<button onClick={()=>act({type:"furniture.remove",placementId:p.id})}>Cất</button></div>)}<button className="text-link" onClick={()=>setScreen("furniture")}>Mua thêm nội thất →</button></section>:<section className="priorities glass-panel"><div className="section-head"><span className="eyebrow">NHIỆM VỤ HÔM NAY</span><button aria-label="Thêm nhiệm vụ" onClick={()=>setShowTask(true)}><Plus size={18}/></button></div><h3>Từng bước nhỏ. Tiến bộ thật.</h3>{currentTasks.filter(t=>open.some(o=>o.taskId===t.id)).slice(0,3).map(questRow)}{open.length===0&&<p className="muted">Chưa có nhiệm vụ mở. Thêm việc đầu tiên để bắt đầu hành trình.</p>}<button className="text-link" onClick={()=>setScreen("quests")}>Mở nhật ký nhiệm vụ <ArrowRight size={14}/></button></section>}
    {boss&&bossDef&&screen!=="build"&&<button className="boss-hud glass-panel" onClick={()=>setScreen("arena")}><div className="boss-mini"><Crosshair size={28}/></div><div><span className="eyebrow">TRẬN ĐẤU HIỆN TẠI · GIAI ĐOẠN {boss.phase}</span><h3>{lifeBoss?.name??bossDef.name}</h3><Meter value={lifeBoss?100-lifeBoss.progress:boss.hp} max={lifeBoss?100:bossDef.maxHp} color="violet"/><small>{lifeBoss?`${lifeBoss.progress}% hoàn thành`:`${boss.hp} / ${bossDef.maxHp} HP`} <span>{boss.defeatedAt?"ĐÃ ĐÁNH BẠI":"VÀO ĐẤU TRƯỜNG ↗"}</span></small></div></button>}
    <div className="character-hud glass-panel"><button className="avatar-badge" aria-label={`Nhân vật ${activeIdentity?.name??state.character.name}`} onClick={()=>setScreen("character")}><CharacterAvatar ownerId={state.userId} fallbackName={state.character.name}/><small>CẤP {activeIdentity?.level??level.level}</small></button><div className="hud-identity"><strong>{activeIdentity?.name??state.character.name}</strong><small>{state.character.title}</small><Meter value={level.current} max={level.next} color="violet"/><span>{level.current} / {level.next} XP</span></div><div className="vitals">{[[Heart,"HP",activeIdentity?.hp??state.character.hp,"pink"],[Zap,"Năng lượng",activeIdentity?.energy??state.character.energy,"amber"],[Sparkles,"Tâm trạng",activeIdentity?.mood??state.character.mood,"cyan"]].map(([I,label,value,color])=>{const Icon=I as IconType;return <div key={String(label)}><span><Icon size={13}/>{String(label)}<b>{Number(value)}</b></span><Meter value={Number(value)} color={String(color)}/></div>;})}</div><div className="hud-progress"><strong>{completedToday}</strong><span>NHIỆM VỤ<br/>HÔM NAY</span></div></div>
  </main>:<main id="main-content" className={`content-main screen-${screen} ${selfHeadedScreens.has(screen)?"module-headed":""}`}>
   {screen==="lobby"?<LobbyDashboard state={state} level={level} open={open} completedToday={completedToday} tasks={currentTasks} boss={boss} bossDef={bossDef} onNavigate={navigate} onOpenFurniture={openFurniture} onRedeem={rewardId=>act({type:"reward.redeem",rewardId})} onComplete={complete} onCreateTask={()=>setShowTask(true)} onNotifications={()=>setNotifications(value=>!value)} actionsDisabled={busy||offline}/>:<>
   {selfHeadedScreens.has(screen)&&<h1 className="sr-only">{activeScreen?.[1]||"NEON HAVEN"}</h1>}
   {!selfHeadedScreens.has(screen)&&<PanelTitle eyebrow={`${groupNames[activeScreen?.[3]||""]||"TẬP TRUNG"} / NEON HAVEN`} title={activeScreen?.[1]||"Tập trung sâu"}>{["calendar","farming"].includes(screen)&&<Btn onClick={()=>setShowTask(true)}><Plus size={17}/>Tạo nhiệm vụ</Btn>}</PanelTitle>}
    <div className="screen-content-scroll">
   {screen==="quests"&&<QuestManager state={state} act={act} busy={busy||offline} onCreate={()=>setShowTask(true)}/>}
   {screen==="calendar"&&<Calendar state={state} act={act}/>}
   {screen==="campaigns"&&<CampaignMap state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="arena"&&<BossArena state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="bosses"&&<div className="catalog-grid">{BOSSES.map(b=>{const encounter=state.bosses.filter(e=>e.definitionId===b.id).at(-1);return <article className={`catalog-card rarity-${b.rarity}`} key={b.id}><span className="eyebrow">{bossTypeNames[b.type]||b.type} · CẤP {b.level}</span><div className="item-art"><Crosshair size={64}/></div><h3>{b.name}</h3><p>{b.description}</p><div className="small-row"><span>{b.maxHp} HP</span><span>+{b.rewardGold} G</span></div><Btn disabled={busy||level.level<b.level} onClick={()=>{if(encounter&&!encounter.defeatedAt)act({type:"boss.select",encounterId:encounter.id});else act({type:"boss.start",definitionId:b.id});setScreen("arena");}}>{encounter?.defeatedAt?"Thách đấu lại":"Chọn trận đấu"}</Btn></article>;})}</div>}
   {screen==="loot"&&<ReferenceLoot state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="equipment"&&<div className="character-layout"><section className="character-preview panel"><Apartment characterOnly weaponId={weaponId} equipment={equipment} onInteract={navigate} skin={state.character.skin} outfit={state.character.outfit} hair={state.character.hair} hairstyle={state.character.hairstyle} appearance={state.character.appearance} cosmetics={state.equippedCosmetics} quality={state.settings.graphics}/><div className="character-caption"><span className="eyebrow">CẤP {level.level} · {state.character.title}</span><h2>{state.character.name}</h2><Meter value={level.current} max={level.next}/></div></section><div className="equipment-inspector"><div className="combat-telemetry" aria-label="Chỉ số chiến đấu">{[["Sức mạnh",combatStats.attack],["Phòng thủ",combatStats.defense],["Chí mạng",`${Math.round(combatStats.critRate*100)}%`],["Cấp",level.level]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{<section className="panel"><div className="section-head"><h3>Bộ trang bị</h3><span className="eyebrow">8 VỊ TRÍ</span></div><div className="equipment-slots">{Object.entries(icons).map(([slot,I])=>{const instance=state.inventory.find(i=>i.id===state.equipment[slot as keyof typeof state.equipment]);const def=ITEMS.find(i=>i.id===instance?.definitionId);return <div className={`equipment-slot rarity-${def?.rarity||"common"}`} key={slot}><I size={25}/><div><small>{slotNames[slot]||slot}</small><strong>{def?.name||"Trống"}{instance?.enhancement?` +${instance.enhancement}`:""}</strong></div>{instance&&<button aria-label={`Tháo ${def?.name}`} onClick={()=>act({type:"item.unequip",slot:slot as keyof typeof state.equipment})}><X size={14}/></button>}</div>;})}</div><Btn onClick={()=>setScreen("inventory")}>Chọn từ túi đồ</Btn></section>}</div></div>}
   {screen==="inventory"&&<ReferenceInventory state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="skills"&&<ReferenceSkills state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="career"&&<CareerPanel character={state.character} act={act} busy={busy||offline}/>}
   {screen==="shop"&&<ReferenceShop state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="furniture"&&<><FurnitureShop state={state} act={act} busy={busy||offline} initialFurnitureId={featuredFurnitureId} onPlace={(id,color)=>{setPlacementKind(id);setPlacementNeonColor(color);setScreen("buy");}}/>{building?.foundation?.mode==="fixed-apartment"?<section className="panel"><h2>Cải tạo trong căn hộ của bạn</h2><p>Diện tích căn hộ đã được cấp sẵn. Dùng chế độ xây dựng để chia phòng, bố trí nội thất và thay vật liệu; không phải mua thêm từng ô đất.</p><Btn onClick={()=>setScreen("build")}>Mở chế độ xây dựng</Btn></section>:<><h2>Mở rộng nhà cũ</h2><div className="catalog-grid">{ROOMS.map(r=><article className="catalog-card" key={r.id}><Home size={35}/><h3>{r.name}</h3><p>Cấp {r.level} · {r.width} × {r.depth} m</p><Btn disabled={state.unlockedRooms.includes(r.id)||state.gold<r.price||busy||offline} onClick={()=>act({type:"room.unlock",roomId:r.id})}>{state.unlockedRooms.includes(r.id)?"Đã mở":`${r.price} G · Mở phòng`}</Btn></article>)}</div></>}</>}
   {screen==="character"&&<><CharacterStudio key={state.userId} state={state} act={act} busy={busy||offline}/><section className="panel"><h3>Phục hồi sau một ngày dài</h3><p>HP {state.character.hp} · Năng lượng {state.character.energy} · Tâm trạng {state.character.mood}</p><Btn disabled={busy||offline} onClick={()=>act({type:"character.rest"})}><Coffee size={15}/>Ghi nhận đã nghỉ ngơi</Btn></section></>}
   {["shop","inventory"].includes(screen)&&<ConsumablesPanel state={state} act={act} busy={busy}/>}
   {(screen==="shop"||screen==="rewards")&&<PersonalRewardsPanel state={state} act={act} busy={busy||offline}/>}
   {screen==="crafting"&&<ReferenceCrafting state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="farming"&&<><div className="feature-banner"><Zap size={44}/><div><span className="eyebrow">NỖ LỰC THẬT → TIẾN BỘ THẬT</span><h2>Bồi đắp tiềm năng của bạn.</h2><p>Tạo nhiệm vụ loại Tích lũy để kiếm nguyên liệu. Phần thưởng có ngân sách theo ngày.</p></div></div><section className="panel">{currentTasks.filter(t=>t.kind==="farming"||t.kind==="daily"||t.kind==="weekly").map(questRow)}</section><section className="panel"><h3>Kho nguyên liệu</h3><div className="materials">{MATERIALS.map(m=><div key={m.id}><Gem/><span>{m.name}</span><strong>{state.materials[m.id]||0}</strong></div>)}</div></section></>}
   {screen==="pets"&&<ReferencePets state={state} act={act} busy={busy||offline} navigate={setScreen}/>}
   {screen==="achievements"&&<><div className="feature-banner"><Trophy size={44}/><div><span className="eyebrow">HÀNH TRÌNH QUA TỪNG CỘT MỐC</span><h2>{state.achievements.length} / {ACHIEVEMENTS.length} thành tựu</h2><p>Những bước tiến không biến mất khi bạn thất bại.</p></div></div><div className="catalog-grid">{ACHIEVEMENTS.map(a=><article className={`catalog-card achievement ${state.achievements.includes(a.id)?"earned":""}`} key={a.id}><div className="item-art"><Trophy size={55}/></div><h3>{a.name}</h3><p>{a.description}</p><span className="tag">{state.achievements.includes(a.id)?"ĐÃ ĐẠT":"CHƯA MỞ"}</span></article>)}</div></>}
   {screen==="finance"&&<FinancePanel key={state.userId} ownerId={state.userId}/>}
   {screen==="butler"&&<ButlerPanel key={state.userId} onApplied={()=>query.refetch()}/>}
   {screen==="journal"&&<><div className="toolbar"><label className="search"><Search size={16}/><input placeholder="Lọc nhật ký" value={search} onChange={e=>setSearch(e.target.value)}/></label><Btn variant="ghost" disabled={busy||!state.undo} onClick={()=>act({type:"undo"})}><RotateCcw size={16}/>Hoàn tác gần nhất</Btn></div><section className="panel journal-list">{state.journal.filter(e=>(e.title+e.type).toLowerCase().includes(search.toLowerCase())).slice().reverse().map(e=><div className="journal-row" key={e.id}><span className="journal-dot"/><div><strong>{e.title}</strong><small>{e.type} · {new Date(e.at).toLocaleString("vi-VN")}</small><p>{Object.entries(e.data).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(", "):v}`).join(" · ")}</p></div></div>)}</section></>}
   {screen==="settings"&&<SettingsPanel state={state} act={act} onWelcome={()=>setWelcome(true)} auth={authQuery.data} onAuthChanged={onAuthChanged} onLogin={()=>setGuestAccess(false)}/>}
   {screen==="focus"&&<FocusSessionPanel state={state} act={act} busy={busy||offline} onCreateTask={()=>setShowTask(true)} onOpenQuests={()=>setScreen("quests")}/>}
    </div>
   </>}
   </main>}
  </div>
  <AnimatePresence>{toast&&<motion.div role="status" className="toast" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}><Sparkles size={18}/><span>{toast}</span><button aria-label="Đóng thông báo" onClick={()=>setToast("")}><X size={15}/></button></motion.div>}</AnimatePresence>
  {notifications&&<div className="notification-panel glass-panel"><div className="section-head"><h3>Trạm thông báo</h3><button aria-label="Đóng" onClick={()=>setNotifications(false)}><X size={18}/></button></div>{state.journal.slice(-5).reverse().map(e=><p key={e.id}><strong>{e.title}</strong><small>{new Date(e.at).toLocaleString("vi-VN")}</small></p>)}<button className="text-link" onClick={()=>{setNotifications(false);setScreen("journal");}}>Mở nhật ký →</button></div>}
  {showTask&&<TaskModal onClose={()=>setShowTask(false)} onSubmit={task=>{act({type:"task.create",task});setShowTask(false);}}/>}
  {(welcome||creating)&&<HousingOnboarding key={state.userId} state={state} act={act} busy={busy||offline} onClose={()=>{setWelcome(false);setCreating(false);setScreen("home");localStorage.setItem("lifelevel-entered","true");}}/>}
  
 </div>;
}

function TaskModal({onClose,onSubmit}:{onClose:()=>void;onSubmit:(t:TaskInput)=>void}){
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);onSubmit({title:String(f.get("title")),description:String(f.get("description")),kind:String(f.get("kind")) as TaskInput["kind"],difficulty:String(f.get("difficulty")) as TaskInput["difficulty"],skill:String(f.get("skill")) as TaskInput["skill"],targetSkillId:String(f.get("targetSkillId")||"")||null,xpReward:Number(f.get("xpReward")),duration:Number(f.get("duration")),dueDate:String(f.get("dueDate")),committed:f.get("committed")==="on",checklist:String(f.get("checklist")).split("\n").map(x=>x.trim()).filter(Boolean)});}
 return <div className="modal-scrim" onClick={onClose}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="task-create-title" onSubmit={submit} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}><X/></button><span className="eyebrow">NHIỆM VỤ MỚI</span><h2 id="task-create-title">Một bước tiến mới.</h2><label>Bạn muốn làm gì?<input autoFocus name="title" required maxLength={160} placeholder="Ví dụ: Hoàn thành bài học React"/></label><label>Mô tả<textarea name="description" maxLength={3000} placeholder="Kết quả cụ thể cần đạt…"/></label><div className="form-grid"><label>Loại<select name="kind">{[["once","Một lần"],["daily","Hằng ngày"],["weekly","Hằng tuần"],["habit","Thói quen tốt"],["negative-habit","Thói quen xấu"],["farming","Tích lũy"],["recovery","Phục hồi"]].map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label><label>Độ khó<select name="difficulty" defaultValue="medium">{Object.entries(difficultyNames).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label><label>Kỹ năng<select name="skill" defaultValue="knowledge">{Object.entries(skillNames).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label><label>Thời lượng (phút)<input type="number" name="duration" min={1} max={240} defaultValue={25}/></label><label>Ngày thực hiện<input type="date" name="dueDate" defaultValue={today()} required/></label><label>Kỹ năng luyện tập<SkillTargetSelect/></label><label>XP thưởng kỹ năng<input type="number" name="xpReward" min={1} max={1000000} step={1} defaultValue={100}/></label></div><label>Các bước thực hiện (mỗi dòng một bước)<textarea name="checklist" placeholder="Đọc tài liệu\nLàm bài tập"/></label><label className="checkbox-label"><input name="committed" type="checkbox"/>Cam kết hoàn thành — chịu phạt nếu bỏ lỡ theo luật đang bật.</label><button className="btn primary" type="submit">Tạo nhiệm vụ <Plus size={16}/></button></form></div>;
}

function Calendar({state,act}:{state:GameState;act:(a:Action)=>void}){const [view,setView]=useState("week");const [offset,setOffset]=useState(0);const count=view==="day"?1:view==="week"?7:30;const dates=Array.from({length:count},(_,i)=>{const d=new Date(`${today()}T12:00:00+07:00`);d.setDate(d.getDate()+offset+i);return d.toISOString().slice(0,10);});return <><div className="toolbar"><div className="tabs">{[["day","Ngày"],["week","Tuần"],["month","Tháng"]].map(([id,n])=><button className={view===id?"active":""} key={id} onClick={()=>setView(id)}>{n}</button>)}</div><div className="button-row"><Btn variant="ghost" onClick={()=>setOffset(o=>o-count)}>←</Btn><Btn variant="ghost" onClick={()=>setOffset(0)}>Hôm nay</Btn><Btn variant="ghost" onClick={()=>setOffset(o=>o+count)}>→</Btn></div></div><div className={`calendar-grid ${view}`}>{dates.map(date=><section className="calendar-day" key={date} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData("taskId");if(id)act({type:"task.reschedule",taskId:id,dueDate:date});}}><span>{new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN",{weekday:"short"})}</span><strong className={date===today()?"today":""}>{date.slice(8)}</strong>{state.occurrences.filter(o=>o.date===date).map(o=>{const t=state.tasks.find(t=>t.id===o.taskId);return t&&!t.archived?<div className={`calendar-task ${o.status}`} key={o.id} draggable={!t.committed} onDragStart={e=>e.dataTransfer.setData("taskId",t.id)}><small>{t.duration} phút · {t.committed?"Cam kết":"Linh hoạt"}</small><b>{t.title}</b><input aria-label={`Đổi ngày ${t.title}`} type="date" value={t.dueDate} onChange={e=>act({type:"task.reschedule",taskId:t.id,dueDate:e.target.value})}/></div>:null;})}</section>)}</div></>;}

function SettingsPanel({state,act,onWelcome,auth,onAuthChanged,onLogin}:{state:GameState;act:(a:Action)=>void;onWelcome:()=>void;auth:AuthStatus|undefined;onAuthChanged:()=>Promise<void>;onLogin:()=>void}){const [backupStatus,setBackupStatus]=useState("");return <div className="settings-grid"><section className="panel"><h3>Hiển thị & hiệu năng</h3><label>Chất lượng 3D<select value={state.settings.graphics} onChange={e=>act({type:"settings.update",settings:{graphics:e.target.value as GameState["settings"]["graphics"]}})}>{["ultra","high","balanced","performance"].map(q=><option key={q} value={q}>{graphicsNames[q]}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={state.settings.reducedMotion} onChange={e=>act({type:"settings.update",settings:{reducedMotion:e.target.checked}})}/>Giảm chuyển động</label><p className="footnote">FPS được đo trong khung hình 3D, phụ thuộc thiết bị và GPU. Chế độ Hiệu năng giảm bóng đổ và mật độ điểm ảnh.</p></section><section className="panel"><h3>Luật khắc nghiệt</h3><label className="checkbox-label"><input type="checkbox" checked={state.settings.hardcore} onChange={e=>act({type:"settings.update",settings:{hardcore:e.target.checked}})}/>Bật chế độ khắc nghiệt</label><label className="checkbox-label"><input type="checkbox" checked={state.settings.equipmentLossAccepted} onChange={e=>act({type:"settings.update",settings:{equipmentLossAccepted:e.target.checked}})}/>Chấp thuận mất một trang bị đang dùng khi HP về 0</label><p>Chỉ nhiệm vụ đã cam kết gây phạt khi bị bỏ lỡ. HP về 0: mất 20% vàng, giảm một cấp, hồi sinh 50 HP. Nhà, thú cưng, nghề nghiệp và tiền thật được bảo vệ.</p><label>Thêm ngày nghỉ<input type="date" onChange={e=>{if(e.target.value)act({type:"settings.update",settings:{restDays:[...state.settings.restDays,e.target.value]}});}}/></label><p>{state.settings.restDays.join(", ")||"Chưa đặt ngày nghỉ"}</p></section><section className="panel"><h3>Dữ liệu & riêng tư</h3><p>Tài chính không được gửi đến AI. Khóa API chỉ được lưu trên máy chủ.</p><Btn variant="ghost" onClick={async()=>{try{const res=await fetch("/api/backup");if(!res.ok)throw new Error("Không thể xuất dữ liệu");const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`lifelevel-${today()}.json`;a.click();URL.revokeObjectURL(url);setBackupStatus("Đã xuất dữ liệu game, tài chính và kế hoạch AI.");}catch(e){setBackupStatus((e as Error).message);}}}>Xuất game và tài chính JSON</Btn><p role="status">{backupStatus}</p><p className="footnote">Tệp JSON không gồm ảnh chân dung và bản nháp xây dựng. Cần bản sao PostgreSQL để khôi phục toàn bộ dữ liệu.</p></section><section className="panel"><h3>Ứng dụng</h3><p>Múi giờ: Asia/Ho_Chi_Minh</p><p>Để cài PWA, dùng “Thêm vào màn hình chính” trong trình duyệt hỗ trợ.</p><Btn variant="ghost" onClick={onWelcome}>Màn hình bắt đầu</Btn><p>Đăng nhập để đồng bộ dữ liệu trên nhiều thiết bị.</p></section>{auth&&<AccountSettings status={auth} onChanged={onAuthChanged} onLogin={onLogin}/>}</div>;}






















import type { BuildingPlan, GridPoint, WallSegment } from "@/construction/types";
import { rectangleRoom, cellKey, edgeKey } from "@/construction/grid";
import { createCurve, snapCurveRotation } from "@/construction/curves";
import { wallEdgesBetweenVertices, type WallEdge } from "@/construction/wall-edges";
import { isWallInsert, wallInsertPlacementValid } from "@/construction/wall-inserts";

export type EditorTool="select"|"wall"|"curve"|"room"|"floor"|"door"|"window"|"paint"|"erase"|"move"|"copy"|"ceiling"|"roof"|"stairs"|"led";
export type EdgeRef=Pick<WallSegment,"x"|"z"|"level"|"orientation">;
export const cellId=cellKey;
export const edgeId=(p:EdgeRef)=>edgeKey({...p,materialId:""});
export type EditorSelection={kind:"wall"|"curve"|"floor"|"furniture"|"led";id:string}|null;
export type DraftHistory={past:BuildingPlan[];present:BuildingPlan;future:BuildingPlan[]};
export function pushDraft(history:DraftHistory,plan:BuildingPlan):DraftHistory{if(JSON.stringify(history.present)===JSON.stringify(plan))return history;return {past:[...history.past.slice(-49),history.present],present:plan,future:[]};}
export function undoDraft(h:DraftHistory):DraftHistory{const prev=h.past.at(-1);return prev?{past:h.past.slice(0,-1),present:prev,future:[h.present,...h.future]}:h;}
export function redoDraft(h:DraftHistory):DraftHistory{const next=h.future[0];return next?{past:[...h.past,h.present],present:next,future:h.future.slice(1)}:h;}
export function addCurveDraft(source: BuildingPlan, catalogId: string, point: GridPoint, id: string, rotation = 0): BuildingPlan {
  const next = structuredClone(source);
  (next.curves ??= []).push(createCurve(catalogId, point, id, rotation));
  return next;
}
export function moveCurveDraft(source: BuildingPlan, id: string, point: GridPoint): BuildingPlan {
  const next = structuredClone(source);
  const curve = next.curves?.find((item) => item.id === id);
  if (curve) {
    curve.x = point.x;
    curve.z = point.z;
    curve.level = point.level;
  }
  return next;
}
export function rotateCurveDraft(source: BuildingPlan, id: string, rotation: number): BuildingPlan {
  const next = structuredClone(source);
  const curve = next.curves?.find((item) => item.id === id);
  if (curve) curve.rotation = snapCurveRotation(rotation);
  return next;
}
export function removeCurveDraft(source: BuildingPlan, id: string): BuildingPlan {
  const next = structuredClone(source);
  if (next.curves) next.curves = next.curves.filter((item) => item.id !== id);
  return next;
}
export function addLedStripDraft(source: BuildingPlan, start: GridPoint, end: GridPoint, color: string, id: string): BuildingPlan {
  const next = structuredClone(source);
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.z - start.z);
  const orthogonalEnd = horizontal ? { ...end, z: start.z } : { ...end, x: start.x };
  (next.ledStrips ??= []).push({ id, start: { ...start }, end: orthogonalEnd, color });
  return next;
}
export function removeLedStripDraft(source: BuildingPlan, id: string): BuildingPlan {
  const next = structuredClone(source);
  next.ledStrips = (next.ledStrips ?? []).filter(strip => strip.id !== id);
  return next;
}
export function updateLedStripColor(source: BuildingPlan, id: string, color: string): BuildingPlan {
  const next = structuredClone(source);
  const strip = next.ledStrips?.find(item => item.id === id);
  if (strip) strip.color = color;
  return next;
}
export function demolishWallEdges(source: BuildingPlan, edges: readonly WallEdge[]): BuildingPlan {
  const removed = new Set(edges.map(edgeId));
  if (!removed.size || !source.walls.some(wall => removed.has(edgeId(wall)))) return source;
  const next = structuredClone(source);
  next.walls = next.walls.filter(wall => !removed.has(edgeId(wall)));
  // A door can span several 1m edges. Removing any supporting edge also
  // removes the now-invalid insert, leaving its owned copy in inventory.
  next.furniture = next.furniture.filter(item => !isWallInsert(item) || wallInsertPlacementValid(next, item));
  return next;
}
export function areaCells(a:GridPoint,b:GridPoint):GridPoint[]{const out:GridPoint[]=[];if(Math.abs(b.x-a.x)>32||Math.abs(b.z-a.z)>32)throw new Error("Vùng kéo quá lớn.");for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)for(let z=Math.min(a.z,b.z);z<=Math.max(a.z,b.z);z++)out.push({x,z,level:a.level});return out;}
export function toolDraft(source:BuildingPlan,tool:EditorTool,a:GridPoint,b:GridPoint,material:string,edge?:EdgeRef,wallMaterial="wall-basic"):BuildingPlan{
 if(tool==="wall"&&wallEdgesBetweenVertices(a,b).length===0)return source;
 const p=structuredClone(source);const cells=areaCells(a,b);const mergeFloor=(cell:GridPoint)=>{const i=p.floors.findIndex(f=>cellId(f)===cellId(cell));if(i<0)p.floors.push({...cell,materialId:material.startsWith("floor-")?material:"floor-concrete"});else if(tool==="floor")p.floors[i].materialId=material;};
 const wall=(e:EdgeRef)=>{if(!p.walls.some(w=>edgeId(w)===edgeId(e)))p.walls.push({...e,materialId:wallMaterial});};
 if(tool==="room"){
   return rectangleRoom(source,a,b,material.startsWith("floor-")?material:"floor-concrete",wallMaterial);
 }else if(tool==="wall"){
   for(const segment of wallEdgesBetweenVertices(a,b)) wall(segment);
 }else if(tool==="floor")cells.forEach(mergeFloor);
 else if(tool==="door"||tool==="window"){
   if(!edge)throw new Error("Chọn cạnh tường để gắn cửa.");const w=p.walls.find(w=>edgeId(w)===edgeId(edge));if(!w)throw new Error("Cửa cần một đoạn tường đã dựng.");w.opening={kind:tool,catalogId:material};
 }else if(tool==="paint"){
   if(!edge)throw new Error("Chọn tường để đổi vật liệu.");const w=p.walls.find(w=>edgeId(w)===edgeId(edge));if(!w)throw new Error("Không có tường tại vị trí này.");w.materialId=material;
 }else if(tool==="erase"){
   if(edge)return demolishWallEdges(p,[edge]);
   else{const ids=new Set(cells.map(cellId));p.floors=p.floors.filter(f=>!ids.has(cellId(f)));p.ceilings=p.ceilings.filter(f=>!ids.has(cellId(f)));p.roofs=p.roofs.filter(f=>!ids.has(cellId(f)));}
 }else if(tool==="ceiling"||tool==="roof"){
   const arr=tool==="ceiling"?p.ceilings:p.roofs;for(const c of cells){const existing=arr.find(x=>cellId(x)===cellId(c));if(existing)existing.materialId=material;else arr.push({...c,materialId:material});}
 }else if(tool==="stairs")p.stairs.push({...a,orientation:Math.abs(b.x-a.x)>=Math.abs(b.z-a.z)?"x":"z",catalogId:material});
 return p;
}

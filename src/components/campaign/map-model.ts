import type { GameState } from "@/domain/types";
import { projectProgress } from "@/boss/progress";
export type MapMilestone = { id:string; title:string; taskIds:string[]; complete:boolean; completedTasks:number; weight:number; required:boolean };
export type MapCampaign = { id:string; title:string; description:string; kind:"campaign"|"project"; bossId:string; progress:number; complete:boolean; selectable:boolean; milestones:MapMilestone[] };
export function mapCampaigns(state:GameState):MapCampaign[]{
 const completed=new Set(state.occurrences.filter(o=>o.status==="completed").map(o=>o.taskId));
 const classic=state.campaigns.map(c=>{const done=c.requiredTaskIds.filter(id=>completed.has(id)).length;const encounter=state.bosses.find(b=>b.id===c.bossId);return {id:c.id,title:c.title,description:c.description,kind:"campaign" as const,bossId:c.bossId,progress:c.requiredTaskIds.length?Math.floor(done/c.requiredTaskIds.length*100):0,complete:!!c.completedAt,selectable:!!encounter&&!encounter.defeatedAt,milestones:c.milestones.map(m=>({id:m.id,title:m.title,taskIds:m.taskIds,complete:m.taskIds.length>0&&m.taskIds.every(id=>completed.has(id)),completedTasks:m.taskIds.filter(id=>completed.has(id)).length,weight:m.taskIds.length,required:m.taskIds.some(id=>c.requiredTaskIds.includes(id))}))};});
 const projects=(state.meaningfulBosses||[]).filter(b=>b.kind==="project"&&b.project&&b.status!=="archived").map(b=>({id:b.id,title:b.name,description:b.description,kind:"project" as const,bossId:b.id,progress:projectProgress(b),complete:b.status==="defeated",selectable:b.status==="active",milestones:b.project!.milestones.map(m=>({id:m.id,title:m.title,taskIds:[m.taskId],complete:!!m.completedAt,completedTasks:m.completedAt?1:0,weight:m.weight,required:m.required}))}));
 return [...projects,...classic];
}
export function nodePosition(index:number):[number,number,number]{return [((index%3)-1)*3.1,.18,Math.floor(index/3)*3-3];}

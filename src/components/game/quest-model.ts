import type { Task, TaskInput, TaskOccurrence } from "@/domain/types";
export type QuestFilters = { search:string; kind:string; priority:string; status:string };
export function matchesQuest(task:Task,occurrences:TaskOccurrence[],filters:QuestFilters,today:string):boolean{
  if(filters.status==="archived"?!task.archived:task.archived)return false;
  const search=filters.search.trim().toLocaleLowerCase("vi");
  if(search&&!`${task.title} ${task.description}`.toLocaleLowerCase("vi").includes(search))return false;
  if(filters.kind!=="all"&&task.kind!==filters.kind)return false;
  if(filters.priority!=="all"&&task.priority!==filters.priority)return false;
  const rows=occurrences.filter(row=>row.taskId===task.id);
  switch(filters.status){case "today":return rows.some(row=>row.date===today&&row.status==="open");case "open":return rows.some(row=>row.status==="open");case "overdue":return rows.some(row=>row.date<today&&(row.status==="open"||row.status==="missed"));case "completed":return rows.some(row=>row.status==="completed");case "committed":return task.committed;default:return true;}
}
/** Omit unchanged fields so editing a title cannot reset recurrence or checklist progress. */
export function taskEditPatch(task:Task,values:TaskInput):Partial<TaskInput>{
  const patch:Partial<TaskInput>={};
  for(const key of ["title","description","kind","difficulty","skill","duration","dueDate","timezone","committed","bossId","priority"] as const){const value=values[key];if(value!==undefined&&value!==task[key])Object.assign(patch,{[key]:value});}
  if(values.checklist!==undefined&&JSON.stringify(values.checklist)!==JSON.stringify(task.checklist.map(item=>item.title)))patch.checklist=values.checklist;
  return patch;
}

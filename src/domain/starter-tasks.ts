import type { GameState, Task, TaskOccurrence } from "./types";

export const STARTER_TASKS_VERSION = 1;

const STARTER_TASKS = [
  { id: "starter-task:english", title: "Học tiếng Anh 30 phút", description: "Dành 30 phút luyện tiếng Anh.", duration: 30, difficulty: "easy", skill: "knowledge" },
  { id: "starter-task:projects", title: "Làm bài các dự án", description: "Hoàn thành một phần việc cụ thể trong dự án.", duration: 45, difficulty: "medium", skill: "career" },
  { id: "starter-task:gym", title: "Tập gym", description: "Hoàn thành một buổi tập vận động.", duration: 45, difficulty: "medium", skill: "health" },
] as const;

export function isStarterTaskId(id: string): boolean {
  return STARTER_TASKS.some(task => task.id === id);
}

/** Grant starter work only to a save that has never contained a task. */
export function starterTasksForEmptySave(state: GameState, now: string, today: string): { tasks: Task[]; occurrences: TaskOccurrence[] } | null {
  if (state.starterTasksVersion || state.tasks.length || state.occurrences.length) return null;
  if (state.journal.some(event => event.type.startsWith("task.") || event.type === "campaign.create" || event.type.startsWith("focus."))) return null;

  const activeBoss = state.bosses.find(boss => boss.id === state.activeBossId && !boss.defeatedAt);
  const tasks: Task[] = STARTER_TASKS.map(definition => ({
    ...definition,
    kind: "once",
    priority: "high",
    dueDate: today,
    timezone: state.settings.timezone,
    committed: false,
    bossId: activeBoss?.id,
    checklist: [],
    archived: false,
    createdAt: now,
    exceptions: [],
  }));
  return { tasks, occurrences: tasks.map(task => ({ id: `${task.id}@${today}`, taskId: task.id, date: today, status: "open" })) };
}

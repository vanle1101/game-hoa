export interface HabitCheckpoint { date: string; outcome: "success" | "missed" | "rest"; confirmedAt: string; eventId: string; occurrenceId?: string; }
export interface ProjectMilestone { id: string; title: string; taskId: string; weight: number; required: boolean; completedAt?: string; eventId?: string; }
export interface MeaningfulBoss {
  id: string; kind: "habit" | "project"; name: string; description: string; createdAt: string; timezone: string;
  status: "active" | "defeated" | "archived"; progress: number; phase: 1 | 2 | 3; rewardEventId?: string; defeatedAt?: string; loot?: string[];
  habit?: { taskId?: string; polarity: "positive" | "negative"; startDate: string; targetDays: number; targetLocalTime?: string; checkpoints: HabitCheckpoint[]; currentStreak: number; longestStreak: number; consistency: number; successDays: number; };
  project?: { milestones: ProjectMilestone[]; };
}
export interface HabitBossInput { name: string; description?: string; polarity: "positive" | "negative"; targetDays: number; taskId?: string; timezone?: string; targetLocalTime?: string; }
export interface ProjectBossInput { name: string; description?: string; milestones: { title: string; taskId: string; weight: number; required: boolean }[]; }
export type MeaningfulBossAction =
  | { type: "boss.habit.create"; boss: HabitBossInput }
  | { type: "boss.habit.checkpoint"; bossId: string; date: string; outcome: HabitCheckpoint["outcome"]; confirmed: true }
  | { type: "boss.project.create"; boss: ProjectBossInput }
  | { type: "boss.meaningful.select"; bossId: string }
  | { type: "boss.meaningful.archive"; bossId: string };

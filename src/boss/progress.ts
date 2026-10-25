import type { MeaningfulBoss } from "./types";

export function bossLocalDate(now: string, timezone: string): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now)); return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`; }
export function shiftDay(date: string, amount: number): string { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); }
export function habitMetrics(boss: MeaningfulBoss, now: string) {
  const habit = boss.habit;
  if (!habit) return { currentStreak: 0, longestStreak: 0, consistency: 0, successDays: 0, progress: 0 };
  const today = bossLocalDate(now, boss.timezone), lastEnded = shiftDay(today, -1);
  const checkpoints = new Map(habit.checkpoints.map((c) => [c.date, c]));
  const end = checkpoints.has(today) ? today : lastEnded;
  let longestStreak = 0, current = 0, successDays = 0, measuredDays = 0;
  // Unconfirmed past days are never inferred as successes; planned rest pauses a streak.
  for (let date = habit.startDate, guard = 0; date <= end && guard++ < 3660; date = shiftDay(date, 1)) {
    const checkpoint = checkpoints.get(date);
    if (checkpoint?.outcome === "rest") continue;
    measuredDays++;
    if (checkpoint?.outcome === "success") { successDays++; current++; longestStreak = Math.max(longestStreak, current); } else current = 0;
  }
  return { currentStreak: current, longestStreak, consistency: measuredDays ? Math.round(successDays / measuredDays * 100) : 0, successDays, progress: Math.min(100, Math.floor(successDays / habit.targetDays * 100)) };
}
export function projectProgress(boss: MeaningfulBoss): number {
  const milestones = boss.project?.milestones ?? [];
  const total = milestones.reduce((sum, item) => sum + item.weight, 0);
  const completed = milestones.filter((item) => item.completedAt).reduce((sum, item) => sum + item.weight, 0);
  const requiredDone = milestones.filter((item) => item.required).every((item) => item.completedAt);
  return total ? Math.min(requiredDone ? 100 : 99, Math.floor(completed / total * 100)) : 0;
}
export function refreshBoss(boss: MeaningfulBoss, now: string): MeaningfulBoss {
  const next = structuredClone(boss);
  if (next.kind === "habit" && next.habit) { const { progress, ...metrics } = habitMetrics(next, now); Object.assign(next.habit, metrics); next.progress = progress; }
  else next.progress = projectProgress(next);
  next.phase = next.progress < 30 ? 1 : next.progress < 65 ? 2 : 3;
  return next;
}

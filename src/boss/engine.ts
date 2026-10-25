import type { ActionContext, GameState } from "../domain/types";
import type { MeaningfulBoss, MeaningfulBossAction } from "./types";
import { bossLocalDate, refreshBoss, shiftDay } from "./progress";

export class BossError extends Error { constructor(public code: string, message: string) { super(message); this.name = "DomainError"; } }
function requireThat(value: unknown, message: string): asserts value { if (!value) throw new BossError("INVALID_BOSS_PROGRESS", message); }
export function validateHabitConfirmationTime(boss: MeaningfulBoss, date: string, now: string): void {
  const habit = boss.habit;
  if (!habit?.targetLocalTime) return;
  requireThat(habit.polarity === "positive", "Giờ mục tiêu chỉ áp dụng cho thói quen tích cực.");
  const today = bossLocalDate(now, boss.timezone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: boss.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now));
  requireThat(date === today && time <= habit.targetLocalTime, `Hãy xác nhận trong ngày, trước hoặc đúng ${habit.targetLocalTime} theo múi giờ của thói quen.`);
}
export function applyMeaningfulBossAction(input: GameState, action: MeaningfulBossAction, context: ActionContext): GameState {
  const state = structuredClone(input); state.meaningfulBosses ??= [];
  if (action.type === "boss.habit.create") {
    const data = action.boss, timezone = data.timezone ?? state.settings.timezone;
    requireThat(!data.targetLocalTime || data.polarity === "positive", "Giờ mục tiêu chỉ áp dụng cho thói quen tích cực.");
    if (data.taskId) { const task = state.tasks.find((t) => t.id === data.taskId && !t.archived); requireThat(task && ["daily", "habit", "negative-habit"].includes(task.kind), "Chọn nhiệm vụ thói quen đang hoạt động."); requireThat((task.kind === "negative-habit") === (data.polarity === "negative"), "Loại nhiệm vụ phải khớp thói quen tích cực hoặc cần tránh."); requireThat(!state.meaningfulBosses.some((b) => b.status === "active" && b.habit?.taskId === data.taskId), "Nhiệm vụ đã gắn với một boss thói quen."); }
    const boss: MeaningfulBoss = { id: `${context.eventId}:habit-boss`, kind: "habit", name: data.name, description: data.description ?? "", createdAt: context.now, timezone, status: "active", progress: 0, phase: 1, habit: { taskId: data.taskId, polarity: data.polarity, startDate: bossLocalDate(context.now, timezone), targetDays: data.targetDays, targetLocalTime: data.targetLocalTime, checkpoints: [], currentStreak: 0, longestStreak: 0, consistency: 0, successDays: 0 } };
    state.meaningfulBosses.push(boss); state.activeMeaningfulBossId = boss.id;
  } else if (action.type === "boss.project.create") {
    const tasks = action.boss.milestones.map((m) => state.tasks.find((t) => t.id === m.taskId && !t.archived));
    requireThat(tasks.every((task) => task && ["once", "campaign"].includes(task.kind)), "Mỗi mốc cần một nhiệm vụ một lần đang hoạt động.");
    requireThat(tasks.every((task) => !state.occurrences.some((o) => o.taskId === task!.id && o.status === "completed")), "Chọn nhiệm vụ chưa hoàn thành; tiến độ không được cộng hồi tố.");
    requireThat(!state.meaningfulBosses.some((b) => b.project?.milestones.some((m) => action.boss.milestones.some((next) => next.taskId === m.taskId))), "Một nhiệm vụ chỉ được tính cho một boss dự án.");
    const boss: MeaningfulBoss = { id: `${context.eventId}:project-boss`, kind: "project", name: action.boss.name, description: action.boss.description ?? "", createdAt: context.now, timezone: state.settings.timezone, status: "active", progress: 0, phase: 1, project: { milestones: action.boss.milestones.map((m, index) => ({ ...m, id: `${context.eventId}:milestone:${index}` })) } };
    state.meaningfulBosses.push(boss); state.activeMeaningfulBossId = boss.id;
  } else {
    const boss = state.meaningfulBosses.find((b) => b.id === action.bossId); requireThat(boss, "Không tìm thấy boss.");
    if (action.type === "boss.meaningful.select") { requireThat(boss.status === "active", "Boss này đã kết thúc."); state.activeMeaningfulBossId = boss.id; }
    else if (action.type === "boss.meaningful.archive") { requireThat(boss.status === "active", "Boss này đã kết thúc."); boss.status = "archived"; if (state.activeMeaningfulBossId === boss.id) delete state.activeMeaningfulBossId; }
    else {
      requireThat(boss.kind === "habit" && boss.habit && boss.status === "active", "Boss thói quen không hoạt động.");
      const date = bossLocalDate(context.now, boss.timezone), habit = boss.habit;
      requireThat(action.confirmed === true, "Bạn cần tự xác nhận kết quả thực tế.");
      requireThat(action.date >= habit.startDate && action.date <= date, "Ngày xác nhận nằm ngoài thử thách.");
      requireThat(action.date >= shiftDay(date, -1), "Chỉ xác nhận hôm nay hoặc ngày vừa kết thúc.");
      requireThat(!habit.checkpoints.some((c) => c.date === action.date), "Ngày này đã được xác nhận; không thể nhận tiến độ hai lần.");
      requireThat(habit.polarity !== "negative" || action.date < date, "Thói quen cần tránh chỉ được xác nhận sau khi ngày đã kết thúc.");
      if (action.outcome === "success") validateHabitConfirmationTime(boss, action.date, context.now);
      if (action.outcome === "rest") requireThat(state.settings.restDays.includes(action.date), "Ngày nghỉ phải được lên lịch trước.");
      habit.checkpoints.push({ date: action.date, outcome: action.outcome, confirmedAt: context.now, eventId: context.eventId });
      Object.assign(boss, refreshBoss(boss, context.now));
    }
  }
  return state;
}

/** Called only after a validated task occurrence receives its real completion event. */
export function applyBossTaskCompletion(state: GameState, taskId: string, occurrenceId: string, occurrenceDate: string, context: ActionContext): void {
  for (const boss of state.meaningfulBosses ?? []) {
    if (boss.status !== "active") continue;
    if (boss.project) {
      const milestone = boss.project.milestones.find((m) => m.taskId === taskId);
      if (milestone && !milestone.completedAt) { milestone.completedAt = context.now; milestone.eventId = context.eventId; }
    } else if (boss.habit?.taskId === taskId) {
      validateHabitConfirmationTime(boss, occurrenceDate, context.now);
      const today = bossLocalDate(context.now, boss.timezone);
      if (occurrenceDate < boss.habit.startDate || occurrenceDate > today || occurrenceDate < shiftDay(today, -1) || boss.habit.checkpoints.some((c) => c.date === occurrenceDate)) continue;
      if (boss.habit.polarity === "negative" && occurrenceDate >= today) continue;
      boss.habit.checkpoints.push({ date: occurrenceDate, outcome: "success", confirmedAt: context.now, eventId: context.eventId, occurrenceId });
    }
    Object.assign(boss, refreshBoss(boss, context.now));
  }
}

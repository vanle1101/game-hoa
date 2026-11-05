import { BALANCE, BOSSES, CAREERS, CONSUMABLES, FURNITURE, FURNITURE_TEST_MODE, ITEMS, LOOT_WEIGHTS, PETS, PET_ACCESSORIES, RECIPES, REWARDS, ROOMS, SKILL_NODES } from "./catalog";
import type { Action, ActionContext, ActionResult, BossEncounter, GameState, ItemInstance, JournalEvent, TaskInput } from "./types";
import { actionSchema } from "./validation";
import { commitConstruction, constructionContext, getBuilding } from "../construction/engine";
import { applyBossTaskCompletion, applyMeaningfulBossAction } from "../boss/engine";
import { refreshBoss } from "../boss/progress";
import { HABIT_CHECKPOINT_REWARDS } from "../boss/balance";
import { COSMETICS, STARTER_COSMETICS, STARTER_OUTFITS } from "../character/catalog";
import { equipCosmetic, grantStarterCosmetics, mergeAppearance, STARTER_COSMETICS_VERSION } from "../character/ownership";
import { reconcileStarterHousing, settleHousing, STARTER_HOME_REPAIR_VERSION } from "../housing/engine";
import { migrateFoundation } from "../construction/migration";
import { withStarterRewards } from "./starter-rewards";
import { STARTER_TASKS_VERSION, isStarterTaskId, starterTasksForEmptySave } from "./starter-tasks";
import { withoutFurnitureTree } from "../construction/lot-objects";

export class DomainError extends Error { constructor(public code: string, message: string) { super(message); this.name = "DomainError"; } }
function ensure(condition: unknown, message: string, code = "INVALID_ACTION"): asserts condition { if (!condition) throw new DomainError(code, message); }
function text(value: string, max = 120): string { ensure(typeof value === "string" && value.trim().length > 0 && value.trim().length <= max, `Enter text between 1 and ${max} characters.`); return value.trim(); }
function integer(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) { ensure(Number.isSafeInteger(value) && value >= min && value <= max, "Invalid number."); return value; }
export function dateKey(now: string, timezone = "Asia/Ho_Chi_Minh"): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now)); const part = (type: string) => parts.find((p) => p.type === type)?.value; return `${part("year")}-${part("month")}-${part("day")}`; }
function validDate(value: string) { ensure(/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value, "Invalid calendar date."); return value; }
function addDays(value: string, days: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function levelProgress(xp: number) { const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1; const current = xp - (level - 1) ** 2 * 100; const required = (2 * level - 1) * 100; return { level, current, required, percent: current / required * 100 }; }
export function derivedStats(state: GameState) {
  let attack = 8 + levelProgress(state.character.xp).level * 2, defense = 3, critRate = 0.05;
  for (const id of Object.values(state.equipment)) { const item = state.inventory.find((i) => i.id === id); const def = ITEMS.find((i) => i.id === item?.definitionId); if (item && def) { attack += Math.round(def.attack * (1 + item.enhancement * 0.1)); defense += Math.round(def.defense * (1 + item.enhancement * 0.1)); critRate += def.critRate; } }
  for (const id of state.character.skillNodes) { const node = SKILL_NODES.find((n) => n.id === id); if (node) { attack += node.attack; defense += node.defense; } }
  for (const buff of state.activeBuffs ?? []) if (buff.remainingQuests > 0) attack += Math.min(20, Math.max(0, buff.attackBonus));
  return { attack: Math.min(200, attack), defense: Math.min(100, defense), critRate: Math.min(0.35, critRate), critDamage: 1.5, equipmentPower: attack + defense };
}
export function damagePreview(state: GameState, difficulty: keyof typeof REWARDS = "medium", encounterId = state.activeBossId) {
  const encounter = state.bosses.find((b) => b.id === encounterId);
  const definition = BOSSES.find((b) => b.id === encounter?.definitionId);
  const stats = derivedStats(state);
  if (!encounter || !definition || encounter.defeatedAt) return { normal: 0, critical: 0, critRate: stats.critRate, campaignGated: false };
  const cap = Math.min(encounter.hp, Math.floor(definition.maxHp * BALANCE.maxDamageFraction));
  const calculate = (multiplier: number) => Math.min(cap, Math.max(1, Math.round((REWARDS[difficulty].damage + stats.attack) * (1 - definition.resistance) * multiplier - definition.defense)));
  return { normal: calculate(1), critical: calculate(stats.critDamage), critRate: stats.critRate, campaignGated: Boolean(encounter.campaignId) };
}
export function equipmentLoot(definitionLevel: number, randomValue: number) {
  ensure(Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1, "Random source failed.", "RNG_ERROR");
  const pool = ITEMS.filter((item) => item.price > 0 && item.level <= definitionLevel + 2);
  ensure(pool.length > 0, "No eligible loot.");
  const tiers = Object.entries(LOOT_WEIGHTS).map(([rarity, weight]) => ({ weight, items: pool.filter((item) => item.rarity === rarity) })).filter((tier) => tier.items.length > 0);
  const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  let threshold = randomValue * total;
  for (const tier of tiers) {
    if (threshold < tier.weight) return tier.items[Math.min(tier.items.length - 1, Math.floor(threshold / tier.weight * tier.items.length))];
    threshold -= tier.weight;
  }
  const last = tiers[tiers.length - 1];
  return last.items[last.items.length - 1];
}
export function createInitialState(userId: string, now = new Date().toISOString()): GameState {
  text(userId, 200);
  return { version: 1, userId, revision: 0, createdAt: now, housingStarterEligible: true, starterCosmeticsVersion: STARTER_COSMETICS_VERSION, ownedCosmetics: [...STARTER_COSMETICS], equippedCosmetics: { top: "runner-jacket", bottom: "runner-pants", shoes: "runner-shoes" }, character: { appearance: mergeAppearance(undefined), name: "Runner", title: "New Signal", xp: 0, hp: 100, energy: 100, mood: 80, social: 70, career: "software", skillXp: { health: 0, knowledge: 0, career: 0, finance: 0, relationships: 0, creativity: 0 }, skillNodes: [], careerRank: 0, skin: "#c99573", outfit: "#32e6f4", hair: "#171b2e", hairstyle: "short" }, gold: 0, tasks: [], occurrences: [], campaigns: [], bosses: [{ id: "first-encounter", definitionId: "static-wraith", hp: 180, phase: 1 }], activeBossId: "first-encounter", inventory: [{ id: "starter-item", definitionId: "starter-blade", enhancement: 0, acquiredAt: now }], equipment: { weapon: "starter-item" }, materials: {}, ownedFurniture: {}, furnitureNeonColors: {}, placements: [], unlockedRooms: ["living"], pets: [], consumables: {}, activeBuffs: [], realLifeRewards: [], ownedPetAccessories: [], petAccessories: {}, achievements: [], journal: [], ledger: [], rewardBudgets: {}, settings: { hardcore: true, equipmentLossAccepted: false, timezone: "Asia/Ho_Chi_Minh", restDays: [], graphics: "balanced", reducedMotion: false } };
}
export function applyAction(input: GameState, unvalidatedAction: Action, context: ActionContext): ActionResult {
  ensure(input.userId === context.userId, "This save belongs to another player.", "FORBIDDEN");
  const parsed = actionSchema.safeParse(unvalidatedAction);
  ensure(parsed.success, parsed.success ? "" : parsed.error.issues[0]?.message ?? "Invalid action.");
  const action = parsed.data;
  ensure(!Number.isNaN(Date.parse(context.now)), "Invalid server time.");
  text(context.eventId, 200);
  if (input.journal.some((event) => event.id === context.eventId)) return { state: input, events: [], message: "Action already applied." };
  const state = structuredClone(input);
  delete state.undo;
  delete state.undoUnavailableReason;
  const today = dateKey(context.now, state.settings.timezone);
  const events: JournalEvent[] = [];
  let message = "Saved.";
  let undoable = false;
  const event = (type: string, title: string, data: JournalEvent["data"] = {}) => { const e = { id: events.length === 0 ? context.eventId : `${context.eventId}:${events.length}`, type, title, data, at: context.now }; events.push(e); state.journal.push(e); return e.id; };
  const gold = (amount: number, reason: string) => { ensure(Number.isSafeInteger(amount) && Number.isSafeInteger(state.gold + amount) && state.gold + amount >= 0, "Not enough game Gold.", "INSUFFICIENT_GOLD"); state.gold += amount; state.ledger.push({ id: `${context.eventId}:gold:${state.ledger.length}`, eventId: context.eventId, amount, balance: state.gold, reason, at: context.now }); };
  const materials = (cost: Record<string, number>) => { for (const [id, count] of Object.entries(cost)) ensure((state.materials[id] ?? 0) >= count, `Not enough ${id}.`, "INSUFFICIENT_MATERIALS"); for (const [id, count] of Object.entries(cost)) state.materials[id] -= count; };
  const grantItem = (definitionId: string): ItemInstance => { const item = { id: `${context.eventId}:item:${state.inventory.length}`, definitionId, enhancement: 0, acquiredAt: context.now }; state.inventory.push(item); return item; };
  const achievement = (id: string) => { if (!state.achievements.includes(id)) { state.achievements.push(id); event("achievement", "Achievement unlocked", { achievementId: id }); } };
  const roll = () => { const value = context.random(); ensure(Number.isFinite(value) && value >= 0 && value < 1, "Random source failed.", "RNG_ERROR"); return value; };
  const createTask = (data: TaskInput) => {
    const difficulty = data.difficulty ?? "medium", skill = data.skill ?? "career", kind = data.kind ?? "once";
    ensure(Object.hasOwn(REWARDS, difficulty), "Invalid task difficulty."); ensure(Object.hasOwn(state.character.skillXp, skill), "Invalid skill.");
    ensure(["once", "daily", "weekly", "habit", "negative-habit", "campaign", "farming", "recovery"].includes(kind), "Invalid task type.");
    const timezone = data.timezone ?? state.settings.timezone;
    const taskToday = dateKey(context.now, timezone);
    const dueDate = validDate(data.dueDate ?? taskToday); ensure(dueDate >= taskToday, "New quests cannot be scheduled in the past.");
    if (data.campaignId) ensure(state.campaigns.some((c) => c.id === data.campaignId && !c.completedAt) || data.campaignId === `${context.eventId}:campaign`, "Campaign not found.");
    const id = `${context.eventId}:task:${state.tasks.length}`;
    if (data.bossId) ensure(state.bosses.some((b) => b.id === data.bossId && !b.defeatedAt), "Choose an active boss.");
    const task = { id, title: text(data.title), description: data.description ?? "", kind, difficulty, skill, targetSkillId: data.targetSkillId ?? null, xpReward: integer(data.xpReward ?? 100, 1, 1000000), duration: integer(data.duration ?? 25, 1, BALANCE.maxDuration), priority: data.priority ?? "normal" as const, dueDate, timezone, committed: data.committed ?? false, campaignId: data.campaignId, bossId: data.bossId, checklist: (data.checklist ?? []).map((title, i) => ({ id: `${id}:check:${i}`, title: text(title), done: false })), archived: false, createdAt: context.now, exceptions: [] };
    state.tasks.push(task); state.occurrences.push({ id: `${id}@${dueDate}`, taskId: id, date: dueDate, status: "open" }); return task;
  };
  const damageBoss = (encounter: BossEncounter, base: number) => {
    const definition = BOSSES.find((b) => b.id === encounter.definitionId)!;
    const stats = derivedStats(state), critical = roll() < stats.critRate;
    const raw = Math.max(1, Math.round((base + stats.attack) * (1 - definition.resistance) * (critical ? stats.critDamage : 1) - definition.defense));
    const campaign = state.campaigns.find((c) => c.id === encounter.campaignId);
    const ready = !campaign || campaign.requiredTaskIds.every((id) => state.occurrences.some((o) => o.taskId === id && o.status === "completed"));
    const milestoneHp = campaign ? Math.ceil(definition.maxHp * (1 - campaign.requiredTaskIds.filter((id) => state.occurrences.some((o) => o.taskId === id && o.status === "completed")).length / campaign.requiredTaskIds.length)) : encounter.hp;
    // Real milestone completion advances campaign phases; equipment cannot bypass these gates.
    const damage = campaign ? Math.min(encounter.hp - (ready ? 0 : 1), Math.max(0, encounter.hp - milestoneHp)) : Math.min(encounter.hp, Math.floor(definition.maxHp * BALANCE.maxDamageFraction), raw);
    encounter.hp -= Math.max(0, damage); encounter.phase = encounter.hp / definition.maxHp > 0.7 ? 1 : encounter.hp / definition.maxHp > 0.35 ? 2 : 3;
    event("combat", `${critical ? "Critical! " : ""}${Math.max(0, damage)} damage to ${definition.name}`, { bossId: encounter.id, damage: Math.max(0, damage), critical });
    if (encounter.hp === 0 && !encounter.rewardEventId) {
      encounter.defeatedAt = context.now; encounter.rewardEventId = context.eventId;
      const budget = state.rewardBudgets[today] ?? { xp: 0, gold: 0, completed: 0 };
      const earnedXp = Math.min(definition.rewardXp, Math.max(0, BALANCE.dailyXpCap - budget.xp));
      const earnedGold = Math.min(definition.rewardGold, Math.max(0, BALANCE.dailyGoldCap - budget.gold));
      state.character.xp += earnedXp; gold(earnedGold, "Boss victory"); state.rewardBudgets[today] = { ...budget, xp: budget.xp + earnedXp, gold: budget.gold + earnedGold };
      // Reward budgets also cover campaign creation, so repeatedly creating tiny goals cannot mint loot.
      const lootEligible = state.journal.filter((e) => e.type === "boss.defeated" && dateKey(e.at, state.settings.timezone) === today).length < 3;
      if (lootEligible) { const firstClear = !state.bosses.some((b) => b.id !== encounter.id && b.definitionId === encounter.definitionId && b.defeatedAt); state.materials["boss-fragment"] = (state.materials["boss-fragment"] ?? 0) + (firstClear ? 3 : 2); const item = grantItem(equipmentLoot(definition.level, roll()).id); encounter.loot = [item.id]; }
      else encounter.loot = [];
      event("boss.defeated", `${definition.name} defeated`, { xp: earnedXp, gold: earnedGold, items: encounter.loot }); achievement("boss-breaker");
      if (campaign) { campaign.completedAt = context.now; achievement("campaign-clear"); }
    }
  };
  const rewardMeaningfulBosses = () => {
    for (const boss of state.meaningfulBosses ?? []) {
      if (boss.status !== "active" || boss.progress < 100 || boss.rewardEventId) continue;
      boss.status = "defeated"; boss.defeatedAt = context.now; boss.rewardEventId = context.eventId;
      const budget = state.rewardBudgets[today] ?? { xp: 0, gold: 0, completed: 0 };
      const xp = Math.min(boss.kind === "habit" ? 100 : 150, Math.max(0, BALANCE.dailyXpCap - budget.xp));
      const coins = Math.min(boss.kind === "habit" ? 60 : 90, Math.max(0, BALANCE.dailyGoldCap - budget.gold));
      state.character.xp += xp; gold(coins, "Meaningful boss victory");
      state.rewardBudgets[today] = { ...budget, xp: budget.xp + xp, gold: budget.gold + coins };
      const lootEligible = xp > 0 && state.journal.filter((entry) => ["boss.defeated", "boss.meaningful.defeated"].includes(entry.type) && dateKey(entry.at, state.settings.timezone) === today).length < 3;
      boss.loot = lootEligible ? [grantItem(equipmentLoot(levelProgress(state.character.xp).level, roll()).id).id] : [];
      event("boss.meaningful.defeated", `Đã vượt qua: ${boss.name}`, { bossId: boss.id, xp, gold: coins, progress: 100, items: boss.loot });
      achievement(boss.kind === "habit" ? "habit-breaker" : "project-finisher");
    }
  };
  switch (action.type) {
    case "focus.start": { const occurrence = state.occurrences.find((o) => o.id === action.occurrenceId && o.status === "open"); const task = state.tasks.find((t) => t.id === occurrence?.taskId && !t.archived); ensure(occurrence && task && task.kind !== "negative-habit", "Chọn một nhiệm vụ đang mở để tập trung."); ensure(occurrence.date <= dateKey(context.now, task.timezone), "Nhiệm vụ chưa đến ngày thực hiện."); ensure(!(state.focusSessions ?? []).some((session) => session.status === "running"), "Hãy kết thúc phiên tập trung đang chạy."); state.focusSessions = [...state.focusSessions ?? [], { id: `${context.eventId}:focus`, occurrenceId: occurrence.id, startedAt: context.now, status: "running" }]; event(action.type, `Bắt đầu tập trung: ${task.title}`); break; }
    case "focus.end": { const session = state.focusSessions?.find((s) => s.id === action.sessionId && s.status === "running"); ensure(session, "Phiên tập trung không chạy."); ensure(Date.parse(context.now) >= Date.parse(session.startedAt), "Thời gian phiên không hợp lệ."); session.endedAt = context.now; session.status = "ended"; event(action.type, "Đã dừng phiên; chưa tự hoàn thành nhiệm vụ"); break; }
    case "focus.confirm": { const session = state.focusSessions?.find((s) => s.id === action.sessionId && s.status === "ended"); ensure(session?.endedAt && action.confirmed, "Kết thúc phiên và tự xác nhận công việc trước."); const occurrence = state.occurrences.find((o) => o.id === session.occurrenceId && o.status === "open"); const task = state.tasks.find((t) => t.id === occurrence?.taskId && !t.archived); ensure(occurrence && task, "Nhiệm vụ đã hoàn thành hoặc không còn hoạt động."); ensure(Date.parse(session.endedAt) - Date.parse(session.startedAt) >= task.duration * 60000, `Phiên cần ít nhất ${task.duration} phút theo thời lượng nhiệm vụ.`); session.status = "confirmed"; session.confirmedAt = context.now; const completed = applyAction(state, { type: "task.complete", occurrenceId: occurrence.id }, context); const entry = { id: `${context.eventId}:focus-confirmed`, type: action.type, title: "Đã xác nhận công việc sau phiên tập trung", at: context.now, data: { sessionId: session.id, occurrenceId: occurrence.id } }; completed.state.journal.push(entry); completed.events.push(entry); delete completed.state.undo; completed.state.undoUnavailableReason = "Phiên tập trung đã xác nhận dùng chung phần thưởng nhiệm vụ; không thể nhận lại."; return completed; }
    case "boss.habit.create": case "boss.habit.checkpoint": case "boss.project.create": case "boss.meaningful.select": case "boss.meaningful.archive": {
      Object.assign(state, applyMeaningfulBossAction(state, action, context));
      if (action.type === "boss.habit.checkpoint" && action.outcome === "success") {
        const boss = state.meaningfulBosses!.find((entry) => entry.id === action.bossId)!;
        const linked = boss.habit?.taskId;
        if (linked) {
          const occurrence = state.occurrences.find((entry) => entry.taskId === linked && entry.date === action.date);
          ensure(occurrence?.status === "open", "Nhiệm vụ liên kết cần có lần thực hiện đang mở; không thể nhận thưởng hai lần.");
          const result = applyAction(state, { type: "task.complete", occurrenceId: occurrence.id }, context);
          const checkpoint = result.state.meaningfulBosses!.find((entry) => entry.id === boss.id)!.habit!.checkpoints.find((entry) => entry.date === action.date)!;
          checkpoint.occurrenceId = occurrence.id;
          const entry = { id: `${context.eventId}:checkpoint`, type: action.type, title: "Xác nhận thói quen qua nhiệm vụ liên kết", at: context.now, data: { bossId: boss.id, occurrenceId: occurrence.id } };
          result.state.journal.push(entry); result.events.push(entry); return result;
        }
        const budget = state.rewardBudgets[today] ?? { xp: 0, gold: 0, completed: 0 };
        const eligible = budget.completed < BALANCE.dailyRewardedTaskCap;
        const xp = eligible ? Math.min(HABIT_CHECKPOINT_REWARDS.xp, Math.max(0, BALANCE.dailyXpCap - budget.xp)) : 0;
        const coins = eligible ? Math.min(HABIT_CHECKPOINT_REWARDS.gold, Math.max(0, BALANCE.dailyGoldCap - budget.gold)) : 0;
        state.character.xp += xp; gold(coins, "Habit daily checkpoint");
        state.rewardBudgets[today] = { xp: budget.xp + xp, gold: budget.gold + coins, completed: budget.completed + 1 };
        event("boss.habit.reward", "Phần thưởng xác nhận thói quen", { bossId: boss.id, date: action.date, xp, gold: coins });
      }
      event(action.type, action.type === "boss.habit.checkpoint" ? "Đã ghi nhận xác nhận thói quen" : "Đã cập nhật thử thách đời thật");
      rewardMeaningfulBosses(); message = "Tiến độ phản ánh công việc đã được bạn xác nhận."; break;
    }
    case "character.appearance": { state.character.appearance = mergeAppearance(state.character.appearance, action.appearance); event(action.type, "Đã lưu diện mạo nhân vật"); break; }
    case "cosmetic.buy": { const cosmetic = COSMETICS.find((item) => item.id === action.cosmeticId); ensure(cosmetic, "Không tìm thấy trang phục."); ensure(levelProgress(state.character.xp).level >= (cosmetic.level ?? 1), `Cần cấp ${cosmetic.level ?? 1} để mua trang phục.`); ensure(Number.isSafeInteger(cosmetic.price) && cosmetic.price >= 0, "Giá trang phục không hợp lệ."); const owned = state.ownedCosmetics ?? []; ensure(!owned.includes(cosmetic.id), "Bạn đã sở hữu trang phục này."); gold(-cosmetic.price, `Cosmetic: ${cosmetic.name}`); state.ownedCosmetics = [...owned, cosmetic.id]; event(action.type, `Đã mua ${cosmetic.name}`); break; }
    case "cosmetic.equip": { const cosmetic = COSMETICS.find((item) => item.id === action.cosmeticId); ensure(cosmetic && (state.ownedCosmetics ?? []).includes(cosmetic.id), "Bạn chưa sở hữu trang phục này."); ensure(levelProgress(state.character.xp).level >= (cosmetic.level ?? 1), `Cần cấp ${cosmetic.level ?? 1} để mặc trang phục.`); state.equippedCosmetics = equipCosmetic(state.equippedCosmetics, cosmetic); event(action.type, `Đã mặc ${cosmetic.name}`); break; }
    case "cosmetic.outfit": { const outfit = STARTER_OUTFITS.find((item) => item.id === action.outfitId); ensure(outfit, "Không tìm thấy bộ trang phục."); const owned = state.ownedCosmetics ?? []; state.equippedCosmetics ??= {}; for (const id of outfit.items) { const item = COSMETICS.find((definition) => definition.id === id); ensure(item && owned.includes(id), "Bạn chưa sở hữu đủ bộ trang phục."); ensure(levelProgress(state.character.xp).level >= (item.level ?? 1), `Cần cấp ${item.level ?? 1} để mặc trang phục.`); state.equippedCosmetics = equipCosmetic(state.equippedCosmetics, item); } event(action.type, `Đã mặc bộ ${outfit.name}`); break; }
    case "housing.settle": { const result = settleHousing(state, action, context.now); Object.assign(state, result.state); event(action.type, "Đã xác nhận nơi ở", { buildingId: action.buildingId, floor: action.floor, layoutId: action.layoutId, starterGranted: result.starterGranted }); message = result.starterGranted ? "Căn hộ khởi đầu đã sẵn sàng. Không thay đổi Gold." : "Đã lưu nơi ở; công trình và tài sản hiện có được giữ nguyên."; break; }
    case "cosmetic.unequip": { ensure(state.equippedCosmetics?.[action.slot], "Ô trang phục đang trống."); delete state.equippedCosmetics![action.slot]; event(action.type, "Đã tháo phụ kiện trang phục"); break; }
    case "construction.commit": { const result = commitConstruction(getBuilding(state), action.plan, action.expectedRevision, constructionContext(state)); gold(-result.quote.netCost, "Construction commit"); state.building = result.building; event(action.type, "House construction saved", { buildingRevision: result.building.revision, cost: result.quote.cost, refund: result.quote.refund, added: result.quote.added, removed: result.quote.removed }); message = `House saved · ${result.quote.cost} Gold spent · ${result.quote.refund} Gold refunded`; break; }
    case "task.create": { const task = createTask(action.task); event(action.type, `Quest created: ${task.title}`, { taskId: task.id }); message = "Quest added to your journey."; break; }
    case "task.edit": {
      const task = state.tasks.find((t) => t.id === action.taskId); ensure(task && !task.archived, "Quest not found.");
      const changes = action.task;
      const taskToday = dateKey(context.now, task.timezone);
      const open = state.occurrences.filter((o) => o.taskId === task.id && o.status === "open");
      ensure(!open.some((o) => o.date < taskToday), "Reconcile overdue occurrences before editing this quest.");
      ensure(open.length > 0 || ["daily", "weekly", "habit", "negative-habit", "farming", "recovery"].includes(task.kind), "Closed one-time quests cannot be edited.");
      if (task.committed) {
        const protectedFields = ["dueDate", "timezone", "kind", "difficulty", "duration", "committed"] as const;
        ensure(!protectedFields.some((key) => changes[key] !== undefined && changes[key] !== task[key]), "Cancel the commitment before changing its deadline, recurrence, or penalty rules.");
      }
      ensure(changes.campaignId === undefined || changes.campaignId === task.campaignId, "Campaign membership cannot be changed through task editing.");
      if (task.campaignId) ensure(changes.kind === undefined || changes.kind === "campaign", "Campaign tasks must retain their milestone association.");
      if ((state.meaningfulBosses ?? []).some((boss) => boss.status === "active" && boss.project?.milestones.some((m) => m.taskId === task.id))) ensure(changes.kind === undefined || changes.kind === task.kind, "Nhiệm vụ dự án cần giữ loại nhiệm vụ một lần.");
      if (changes.bossId) { const boss = state.bosses.find((b) => b.id === changes.bossId && !b.defeatedAt); ensure(boss && (!task.campaignId || boss.campaignId === task.campaignId), "Choose an active boss belonging to this campaign."); }
      const timezone = changes.timezone ?? task.timezone;
      const nextToday = dateKey(context.now, timezone);
      const dueDate = changes.dueDate ?? task.dueDate;
      if (changes.dueDate !== undefined || changes.timezone !== undefined || changes.kind !== undefined) {
        ensure(dueDate >= nextToday, "Choose today or a future date for the updated schedule.");
        for (const occurrence of open) if (occurrence.date !== dueDate) { occurrence.status = "canceled"; if (!task.exceptions.includes(occurrence.date)) task.exceptions.push(occurrence.date); }
        const existing = state.occurrences.find((o) => o.id === `${task.id}@${dueDate}`);
        ensure(!existing || existing.status === "open", "That occurrence has already been closed and cannot be reopened.");
        if (!existing) state.occurrences.push({ id: `${task.id}@${dueDate}`, taskId: task.id, date: dueDate, status: "open" });
      }
      const { checklist, ...fields } = changes;
      Object.assign(task, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)));
      if (checklist !== undefined) task.checklist = checklist.map((title, i) => ({ id: `${task.id}:check:${context.eventId}:${i}`, title, done: false }));
      if (changes.title && task.campaignId) { const campaign = state.campaigns.find((c) => c.id === task.campaignId); for (const milestone of campaign?.milestones ?? []) if (milestone.taskIds.length === 1 && milestone.taskIds[0] === task.id) milestone.title = task.title; }
      event(action.type, `Quest updated: ${task.title}`, { taskId: task.id }); message = "Quest updated. Completed occurrence rewards stay unchanged."; break;
    }
    case "task.complete": {
      const occurrence = state.occurrences.find((o) => o.id === action.occurrenceId); ensure(occurrence && occurrence.status === "open", "This occurrence is no longer available.", "ALREADY_COMPLETED");
      const task = state.tasks.find((t) => t.id === occurrence.taskId)!; ensure(!task.archived && occurrence.date <= dateKey(context.now, task.timezone), "This quest is not available today.");
      const taskToday = dateKey(context.now, task.timezone);
      if (task.kind === "negative-habit") ensure(occurrence.date < taskToday, "Thói quen cần tránh chỉ được xác nhận sau khi ngày đã kết thúc.");
      ensure(!task.committed || occurrence.date >= taskToday || task.kind === "negative-habit" && occurrence.date === addDays(taskToday, -1), "This commitment is overdue. Reconcile the calendar before continuing.");
      ensure(task.checklist.every((item) => item.done), "Complete the checklist first.");
      const budget = state.rewardBudgets[today] ?? { xp: 0, gold: 0, completed: 0 };
      const reward = REWARDS[task.difficulty]; const durationFactor = Math.min(1.5, Math.max(0.5, task.duration / 30));
      const eligible = budget.completed < BALANCE.dailyRewardedTaskCap && budget.xp < BALANCE.dailyXpCap;
      const xp = eligible ? Math.min(Math.round(reward.xp * durationFactor), BALANCE.dailyXpCap - budget.xp) : 0;
      const coins = eligible ? Math.min(reward.gold, BALANCE.dailyGoldCap - budget.gold) : 0;
      occurrence.status = "completed"; occurrence.completedAt = context.now; occurrence.rewardEventId = context.eventId;
      state.character.xp += xp; state.character.skillXp[task.skill] += Math.floor(xp / 2); state.character.energy = Math.max(0, state.character.energy - 3); state.character.mood = Math.min(100, state.character.mood + 3);
      gold(coins, "Quest completion"); state.rewardBudgets[today] = { xp: budget.xp + xp, gold: budget.gold + coins, completed: budget.completed + 1 };
      event(action.type, `${task.kind === "negative-habit" ? "Avoided" : "Completed"}: ${task.title}`, { taskId: task.id, occurrenceId: occurrence.id, xp, gold: coins });
      if (eligible) { state.materials.alloy = (state.materials.alloy ?? 0) + (task.kind === "farming" ? 3 : 1); if (task.kind === "farming") { state.materials["energy-core"] = (state.materials["energy-core"] ?? 0) + 1; state.materials["upgrade-component"] = (state.materials["upgrade-component"] ?? 0) + 1; } if (task.difficulty === "hard" || task.difficulty === "epic") state.materials["quantum-crystal"] = (state.materials["quantum-crystal"] ?? 0) + 1; }
      if (task.kind === "recovery") state.character.hp = Math.min(100, state.character.hp + 15);
      else if (isStarterTaskId(task.id)) state.character.hp = Math.min(100, state.character.hp + 5);
      const boss = state.bosses.find((b) => b.id === (task.bossId ?? state.activeBossId));
      if (boss && !boss.defeatedAt && (eligible || boss.campaignId === task.campaignId && Boolean(task.campaignId)) && (!boss.campaignId || boss.campaignId === task.campaignId)) damageBoss(boss, reward.damage);
      applyBossTaskCompletion(state, task.id, occurrence.id, occurrence.date, context);
      rewardMeaningfulBosses();
      achievement("first-step"); if (state.occurrences.filter((o) => o.status === "completed").length >= 20) achievement("consistent");
      if (eligible && state.activeBuffs) state.activeBuffs = state.activeBuffs.map((buff) => ({ ...buff, remainingQuests: buff.remainingQuests - 1 })).filter((buff) => buff.remainingQuests > 0);
      const mandatoryMilestone = state.campaigns.some((campaign) => campaign.requiredTaskIds.includes(task.id)) || (state.meaningfulBosses ?? []).some((b) => b.project?.milestones.some((m) => m.taskId === task.id) || b.habit?.taskId === task.id);
      undoable = !mandatoryMilestone; message = `Quest complete · +${xp} XP · +${coins} Gold`;
      if (mandatoryMilestone) state.undoUnavailableReason = "Required campaign milestones cannot be undone because reversing them would break campaign progression. Check your work before marking a milestone complete.";
      break;
    }
    case "task.checklist": { const task = state.tasks.find((t) => t.id === action.taskId); const item = task?.checklist.find((c) => c.id === action.checklistId); ensure(item, "Checklist item not found."); item.done = action.done; event(action.type, "Checklist updated"); break; }
    case "task.reschedule": return applyAction(input, { type: "task.edit", taskId: action.taskId, task: { dueDate: action.dueDate } }, context);
    case "task.cancel": { const occurrence = state.occurrences.find((o) => o.id === action.occurrenceId); ensure(occurrence && occurrence.status === "open" && occurrence.date >= today, "Only a future or today's open commitment can be canceled."); occurrence.status = "canceled"; const task = state.tasks.find((t) => t.id === occurrence.taskId)!; task.committed = false; task.exceptions.push(occurrence.date); event(action.type, "Commitment canceled"); break; }
    case "task.archive": { const task = state.tasks.find((t) => t.id === action.taskId); ensure(task, "Quest not found."); ensure(!task.committed || !state.occurrences.some((o) => o.taskId === task.id && o.status === "open" && o.date < today), "Reconcile missed commitments first."); task.archived = true; for (const o of state.occurrences) if (o.taskId === task.id && o.status === "open") o.status = "canceled"; event(action.type, "Quest archived"); break; }
    case "reconcile": {
      const housing = reconcileStarterHousing(state, context.now);
      const housingChanged = housing !== state;
      if (housingChanged) {
        Object.assign(state, housing);
        event(state.residence ? "housing.starter-repair" : "housing.starter-eligibility", state.residence ? "Đã khôi phục căn hộ khởi đầu" : "Đã xác nhận quyền nhận căn hộ khởi đầu", { version: STARTER_HOME_REPAIR_VERSION });
      }
      const foundation = migrateFoundation(state);
      const foundationChanged = foundation !== state;
      if (foundationChanged) { Object.assign(state, foundation); event("housing.foundation", "Đã giữ nguyên căn hộ hiện có", { version: 9 }); }
      const startersChanged = grantStarterCosmetics(state);
      if (startersChanged) event("cosmetic.starter-grant", "Đã cập nhật bộ sưu tập khởi đầu", { version: STARTER_COSMETICS_VERSION });
      const starterRewards = withStarterRewards(state.realLifeRewards);
      const starterRewardsChanged = starterRewards !== state.realLifeRewards;
      if (starterRewardsChanged) {
        state.realLifeRewards = starterRewards;
        event("reward.starter-grant", "Đã thêm gợi ý phần thưởng cá nhân", { count: 6 });
      }
      const starterTasks = context.seedStarterTasks === false ? null : starterTasksForEmptySave(state, context.now, today);
      const starterTasksChanged = Boolean(starterTasks);
      if (starterTasks) {
        state.tasks.push(...starterTasks.tasks);
        state.occurrences.push(...starterTasks.occurrences);
        state.starterTasksVersion = STARTER_TASKS_VERSION;
        event("task.starter-grant", "Đã thêm ba nhiệm vụ khởi đầu", { count: starterTasks.tasks.length, version: STARTER_TASKS_VERSION });
      }
      const oldBosses = JSON.stringify(state.meaningfulBosses ?? []);
      if (state.meaningfulBosses) state.meaningfulBosses = state.meaningfulBosses.map((boss) => boss.status === "active" ? refreshBoss(boss, context.now) : boss);
      let missed = 0;
      for (const task of state.tasks.filter((t) => !t.archived)) {
        const taskToday = dateKey(context.now, task.timezone);
        const repeating = ["daily", "weekly", "habit", "negative-habit", "farming", "recovery"].includes(task.kind);
        if (repeating) { const step = task.kind === "weekly" ? 7 : 1; let date = task.dueDate; const existing = new Set(state.occurrences.filter((o) => o.taskId === task.id).map((o) => o.date)); let count = 0; while (date <= taskToday && count++ < 3660) { if (!existing.has(date) && !task.exceptions.includes(date)) { state.occurrences.push({ id: `${task.id}@${date}`, taskId: task.id, date, status: "open" }); if (date === taskToday) for (const check of task.checklist) check.done = false; } date = addDays(date, step); } }
        for (const occurrence of state.occurrences.filter((o) => o.taskId === task.id && o.status === "open" && o.date < (task.kind === "negative-habit" ? addDays(taskToday, -1) : taskToday))) {
          occurrence.status = "missed"; missed++;
          if (state.settings.hardcore && task.committed && !state.settings.restDays.includes(occurrence.date)) {
            occurrence.penaltyEventId = context.eventId; const amount = REWARDS[task.difficulty].penalty; state.character.hp = Math.max(0, state.character.hp - amount); event("penalty", `Missed commitment: ${task.title}`, { hp: -amount, occurrenceId: occurrence.id });
            if (state.character.hp === 0) { gold(-Math.floor(state.gold * 0.2), "Exhaustion penalty"); const level = levelProgress(state.character.xp).level; state.character.xp = Math.min(state.character.xp, Math.max(0, (level - 2) ** 2 * 100)); state.character.hp = 50; if (state.settings.equipmentLossAccepted) { const slot = Object.keys(state.equipment)[0] as keyof typeof state.equipment | undefined; if (slot) { const itemId = state.equipment[slot]; state.inventory = state.inventory.filter((i) => i.id !== itemId); delete state.equipment[slot]; } } event("exhaustion", "Recovered at 50 HP after exhaustion", { levelLost: level > 1 }); }
          }
        }
      }
      if (!housingChanged && !foundationChanged && !startersChanged && !starterRewardsChanged && !starterTasksChanged && missed === 0 && state.occurrences.length === input.occurrences.length && oldBosses === JSON.stringify(state.meaningfulBosses ?? [])) return { state: input, events: [], message: "Calendar is up to date." };
      event(action.type, `Calendar reconciled · ${missed} missed occurrences`); undoable = missed > 0 && !housingChanged; message = "Calendar is up to date."; break;
    }
    case "undo": {
      ensure(!input.undoUnavailableReason, input.undoUnavailableReason ?? "Undo unavailable.");
      const undo = input.undo; ensure(undo && undo.revision === input.revision && Date.parse(context.now) - Date.parse(undo.at) >= 0 && Date.parse(context.now) - Date.parse(undo.at) <= BALANCE.undoWindowMs, "Undo is only available for 5 minutes, before another action.");
      ensure(!input.occurrences.some((occurrence) => occurrence.rewardEventId === undo.eventId && input.campaigns.some((campaign) => campaign.requiredTaskIds.includes(occurrence.taskId))), "Required campaign milestones cannot be undone because reversing them would break campaign progression.");
      ensure(!input.occurrences.some((occurrence) => occurrence.rewardEventId === undo.eventId && (input.meaningfulBosses ?? []).some((boss) => boss.project?.milestones.some((m) => m.taskId === occurrence.taskId))), "Mốc dự án đã xác nhận không thể hoàn tác.");
      // Reusing the same occurrence must not reroll: restore effects but keep reward-claimed occurrences canceled.
      const restored = structuredClone(undo.before) as GameState;
      const completed = input.occurrences.filter((o) => o.rewardEventId === undo.eventId);
      for (const occurrence of completed) { const target = restored.occurrences.find((o) => o.id === occurrence.id); if (target) { target.status = "canceled"; target.rewardEventId = undo.eventId; } }
      restored.journal = [...input.journal, { id: context.eventId, type: "undo", title: "Compensating reversal applied", at: context.now, data: { reversedEventId: undo.eventId } }];
      restored.ledger = [...input.ledger]; const delta = restored.gold - input.gold; if (delta) restored.ledger.push({ id: `${context.eventId}:gold`, eventId: context.eventId, amount: delta, balance: restored.gold, reason: "Compensating reversal", at: context.now });
      // Penalty reversals preserve reconciliation markers so later reconciliation cannot charge the same miss again.
      for (const o of input.occurrences.filter((o) => o.penaltyEventId === undo.eventId)) { const target = restored.occurrences.find((x) => x.id === o.id); if (target) { target.status = "missed"; target.penaltyEventId = undo.eventId; } else restored.occurrences.push(o); }
      restored.revision = input.revision + 1; return { state: restored, events: [restored.journal.at(-1)!], message: "Reversed. This occurrence remains closed to prevent reward rerolls." };
    }
    case "boss.select": { const boss = state.bosses.find((b) => b.id === action.encounterId); ensure(boss && !boss.defeatedAt, "Select an active encounter."); state.activeBossId = boss.id; delete state.activeMeaningfulBossId; event(action.type, "Active boss changed"); break; }
    case "boss.start": { const def = BOSSES.find((b) => b.id === action.definitionId); ensure(def && def.type !== "campaign", "Create a campaign for campaign bosses."); ensure(levelProgress(state.character.xp).level >= def.level, `Reach level ${def.level} first.`); ensure(!state.bosses.some((b) => b.definitionId === def.id && !b.defeatedAt), "This boss already has an active encounter."); const latest = state.bosses.filter((b) => b.definitionId === def.id).at(-1); if (latest?.defeatedAt) { const cooldown = def.type === "daily" ? 1 : 7; ensure(today >= addDays(dateKey(latest.defeatedAt, state.settings.timezone), cooldown), "This boss is still on cooldown."); } const boss = { id: `${context.eventId}:boss`, definitionId: def.id, hp: def.maxHp, phase: 1 as const }; state.bosses.push(boss); state.activeBossId = boss.id; delete state.activeMeaningfulBossId; event(action.type, `Encounter started: ${def.name}`); break; }
    case "item.buy": { const def = ITEMS.find((i) => i.id === action.definitionId); ensure(def && def.price > 0, "Item is not for sale."); integer(def.price); ensure(levelProgress(state.character.xp).level >= def.level, `Requires level ${def.level}.`); gold(-def.price, `Purchase ${def.name}`); const item = grantItem(def.id); event(action.type, `Purchased ${def.name}`, { itemId: item.id }); break; }
    case "item.equip": { const item = state.inventory.find((i) => i.id === action.itemId); ensure(item, "You do not own this item."); const def = ITEMS.find((i) => i.id === item.definitionId)!; ensure(levelProgress(state.character.xp).level >= def.level, `Requires level ${def.level}.`); const slot = action.slot ?? def.slot; ensure(slot === def.slot || ["accessory1", "accessory2"].includes(slot) && ["accessory1", "accessory2"].includes(def.slot), "Item does not fit that slot."); for (const equipped of Object.keys(state.equipment) as (keyof typeof state.equipment)[]) if (state.equipment[equipped] === item.id) delete state.equipment[equipped]; state.equipment[slot] = item.id; event(action.type, `Equipped ${def.name}`); break; }
    case "item.unequip": { ensure(state.equipment[action.slot], "That slot is empty."); delete state.equipment[action.slot]; event(action.type, "Equipment removed"); break; }
    case "item.craft": { const recipe = RECIPES.find((r) => r.id === action.recipeId); ensure(recipe, "Recipe not found."); materials(recipe.materials); gold(-recipe.gold, recipe.name); const item = grantItem(recipe.itemId); event(action.type, recipe.name, { itemId: item.id }); achievement("maker"); break; }
    case "item.upgrade": { const item = state.inventory.find((i) => i.id === action.itemId); ensure(item && item.enhancement < BALANCE.maxEnhancement, "Item cannot be enhanced further."); const level = item.enhancement + 1; materials({ alloy: level * 2, "upgrade-component": level }); gold(-25 * level, "Equipment enhancement"); item.enhancement++; event(action.type, `Enhanced equipment to +${item.enhancement}`, { itemId: item.id }); break; }
    case "furniture.buy": { const def = FURNITURE.find((f) => f.id === action.furnitureId); ensure(def, "Furniture not found."); integer(def.price); ensure(levelProgress(state.character.xp).level >= (def.level ?? 1), `Requires level ${def.level ?? 1}.`); if (!FURNITURE_TEST_MODE) gold(-def.price, `Purchase ${def.name}`); state.ownedFurniture[def.id] = (state.ownedFurniture[def.id] ?? 0) + 1; state.furnitureNeonColors = { ...state.furnitureNeonColors, [def.id]: action.neonColor ?? state.furnitureNeonColors?.[def.id] ?? def.neonColor }; event(action.type, `${FURNITURE_TEST_MODE ? "Test purchase" : "Purchased"} ${def.name}`); break; }
    case "furniture.sell": {
      const def = FURNITURE.find((f) => f.id === action.furnitureId);
      ensure(def, "Furniture not found.");
      const owned = state.ownedFurniture[def.id] ?? 0;
      ensure(owned > 0, "You do not own this furniture.");
      if (action.placementId) {
        const building = getBuilding(state);
        const placement = building.plan.furniture.find(item => item.id === action.placementId && item.furnitureId === def.id);
        ensure(placement, "Furniture placement not found.");
        // Child objects remain owned and return to the household inventory.
        // Only the sold root loses ownership and grants a refund.
        state.building = { ...building, revision: building.revision + 1, plan: withoutFurnitureTree(building.plan, action.placementId) };
      }
      const remainingPlaced = getBuilding(state).plan.furniture.filter(item => item.furnitureId === def.id).length + state.placements.filter(item => item.furnitureId === def.id).length;
      ensure(owned - 1 >= remainingPlaced, "Store an unplaced copy before selling this furniture.");
      state.ownedFurniture[def.id] = owned - 1;
      const refund = Math.floor(def.price * 0.8);
      gold(refund, `Sold ${def.name}`);
      event(action.type, `Sold ${def.name}`, { furnitureId: def.id, refund });
      message = `Đã bán ${def.name} · hoàn lại ${refund} Gold`;
      break;
    }
    case "furniture.place": {
      ensure(!state.building, "Use Buy Mode to place furniture in your saved building.");
      const def = FURNITURE.find((f) => f.id === action.furnitureId), room = ROOMS.find((r) => r.id === action.roomId); ensure(def && room && state.unlockedRooms.includes(room.id), "Furniture or room unavailable.");
      ensure(Number.isFinite(action.x) && Number.isFinite(action.z) && [0, 90, 180, 270].includes(action.rotation), "Invalid placement.");
      const previous = action.placementId ? state.placements.find((p) => p.id === action.placementId && p.furnitureId === def.id) : undefined; if (action.placementId) ensure(previous, "Placement not found.");
      ensure(previous || state.placements.filter((p) => p.furnitureId === def.id).length < (state.ownedFurniture[def.id] ?? 0), "No unplaced furniture available.");
      const rotated = action.rotation % 180 !== 0, width = rotated ? def.depth : def.width, depth = rotated ? def.width : def.depth;
      ensure(Math.abs(action.x) + width / 2 <= room.width / 2 && Math.abs(action.z) + depth / 2 <= room.depth / 2, "Keep the furniture inside the room.");
      if (room.id === "living") {
        const fixtures = [{ x: 4.8, z: -2.9, width: 2.7, depth: 3.2 }, { x: -4.9, z: -3.2, width: 2.3, depth: 1 }, { x: -4.8, z: 0.5, width: 1.16, depth: 2.9 }, { x: 6.2, z: 0.5, width: 1.1, depth: 1.5 }, { x: 1.3, z: -3.9, width: 1.2, depth: 0.7 }, { x: -6.2, z: 3.4, width: 0.7, depth: 0.7 }, { x: 4.8, z: 3.6, width: 2, depth: 1 }];
        for (const fixed of fixtures) ensure(Math.abs(action.x - fixed.x) >= (width + fixed.width) / 2 || Math.abs(action.z - fixed.z) >= (depth + fixed.depth) / 2, "Furniture overlaps an apartment fixture.");
      }
      for (const p of state.placements.filter((p) => p.roomId === room.id && p.id !== previous?.id)) { const other = FURNITURE.find((f) => f.id === p.furnitureId)!; const ow = p.rotation % 180 ? other.depth : other.width, od = p.rotation % 180 ? other.width : other.depth; ensure(Math.abs(action.x - p.x) >= (width + ow) / 2 || Math.abs(action.z - p.z) >= (depth + od) / 2, "Furniture overlaps another object."); }
      const neonColor = action.neonColor ?? state.furnitureNeonColors?.[def.id] ?? def.neonColor;
      state.furnitureNeonColors = { ...state.furnitureNeonColors, [def.id]: neonColor };
      const placement = { id: previous?.id ?? `${context.eventId}:placement`, furnitureId: def.id, roomId: room.id, x: action.x, z: action.z, rotation: action.rotation, neonColor }; state.placements = [...state.placements.filter((p) => p.id !== placement.id), placement]; event(action.type, `Placed ${def.name}`); achievement("home-maker"); break;
    }
    case "furniture.remove": { ensure(!state.building, "Use Buy Mode to store furniture from your saved building."); ensure(state.placements.some((p) => p.id === action.placementId), "Placement not found."); state.placements = state.placements.filter((p) => p.id !== action.placementId); event(action.type, "Furniture returned to storage"); break; }
    case "room.unlock": { const room = ROOMS.find((r) => r.id === action.roomId); ensure(room && !state.unlockedRooms.includes(room.id), "Room unavailable or already unlocked."); ensure(levelProgress(state.character.xp).level >= room.level, `Requires level ${room.level}.`); gold(-room.price, `Unlock ${room.name}`); state.unlockedRooms.push(room.id); event(action.type, `Unlocked ${room.name}`); break; }
    case "pet.adopt": { const pet = PETS.find((p) => p.id === action.petId); ensure(pet && !state.pets.some((p) => p.id === pet.id), "Companion unavailable or already adopted."); gold(-pet.price, "Companion adoption"); state.pets.push({ id: pet.id, name: text(action.name ?? pet.name, 40), bond: 0 }); state.activePetId ??= pet.id; event(action.type, `Welcomed ${action.name ?? pet.name}`); break; }
    case "pet.care": { const pet = state.pets.find((p) => p.id === action.petId); ensure(pet && pet.lastCareDate !== today, "Companion already cared for today."); pet.bond = Math.min(100, pet.bond + 5); pet.lastCareDate = today; state.character.social = Math.min(100, state.character.social + 3); event(action.type, `Spent time with ${pet.name}`); break; }
    case "pet.select": { const pet = state.pets.find((p) => p.id === action.petId); ensure(pet, "Adopt this companion first."); state.activePetId = pet.id; event(action.type, `${pet.name} is now your active companion`, { petId: pet.id }); break; }
    case "pet.accessory.buy": { const accessory = PET_ACCESSORIES.find((a) => a.id === action.accessoryId); ensure(accessory, "Companion accessory not found."); ensure(!(state.ownedPetAccessories ?? []).includes(accessory.id), "You already own this accessory."); gold(-accessory.price, `Purchase ${accessory.name}`); state.ownedPetAccessories = [...state.ownedPetAccessories ?? [], accessory.id]; event(action.type, `Purchased ${accessory.name}`); break; }
    case "pet.accessory.equip": { ensure(state.pets.some((p) => p.id === action.petId), "Adopt this companion first."); ensure((state.ownedPetAccessories ?? []).includes(action.accessoryId), "You do not own this accessory."); ensure(PET_ACCESSORIES.some((a) => a.id === action.accessoryId), "Accessory not found."); const equipped = { ...state.petAccessories }; for (const [petId, accessoryId] of Object.entries(equipped)) if (accessoryId === action.accessoryId) delete equipped[petId]; equipped[action.petId] = action.accessoryId; state.petAccessories = equipped; event(action.type, "Companion accessory equipped", { petId: action.petId, accessoryId: action.accessoryId }); break; }
    case "pet.accessory.remove": { ensure(state.pets.some((p) => p.id === action.petId) && state.petAccessories?.[action.petId], "No equipped accessory found."); delete state.petAccessories![action.petId]; event(action.type, "Companion accessory returned to collection"); break; }
    case "consumable.buy": { const item = CONSUMABLES.find((c) => c.id === action.consumableId); ensure(item, "Consumable not found."); const count = state.consumables?.[item.id] ?? 0; ensure(count < 999, "You already hold the maximum quantity."); gold(-item.price, `Purchase ${item.name}`); state.consumables = { ...state.consumables, [item.id]: count + 1 }; event(action.type, `Purchased ${item.name}`); break; }
    case "consumable.consume": {
      const item = CONSUMABLES.find((c) => c.id === action.consumableId); const count = state.consumables?.[action.consumableId] ?? 0; ensure(item && count > 0, "You do not own this consumable.");
      if (item.effect === "focus") { ensure(!(state.activeBuffs ?? []).some((buff) => buff.id === item.id && buff.remainingQuests > 0), "This focus effect is already active."); state.activeBuffs = [...state.activeBuffs ?? [], { id: item.id, attackBonus: item.amount, remainingQuests: item.charges ?? 1 }]; }
      else { const current = state.character[item.effect]; ensure(current < 100, `Your ${item.effect === "hp" ? "HP" : "Energy"} is already full.`); state.character[item.effect] = Math.min(100, current + item.amount); }
      state.consumables = { ...state.consumables, [item.id]: count - 1 }; event(action.type, `Used ${item.name}`, { effect: item.effect, amount: item.amount }); message = `${item.name} applied.`; break;
    }
    case "reward.create": { const reward = { id: `${context.eventId}:reward`, name: action.name, description: action.description ?? "", cost: action.cost, redemptions: 0, archived: false }; state.realLifeRewards = [...state.realLifeRewards ?? [], reward]; event(action.type, `Created personal reward: ${reward.name}`, { rewardId: reward.id, cost: reward.cost }); message = "Personal reward created. Redeeming only spends Game Gold."; break; }
    case "reward.redeem": { const reward = state.realLifeRewards?.find((r) => r.id === action.rewardId && !r.archived); ensure(reward, "Personal reward not found or archived."); gold(-reward.cost, `Personal reward: ${reward.name}`); reward.redemptions++; reward.lastRedeemedAt = context.now; event(action.type, `Redeemed: ${reward.name}`, { rewardId: reward.id, cost: reward.cost }); message = `You earned ${reward.name}. Enjoy it when you choose — no real purchase was made.`; break; }
    case "reward.archive": { const reward = state.realLifeRewards?.find((r) => r.id === action.rewardId && !r.archived); ensure(reward, "Personal reward not found or archived."); reward.archived = true; event(action.type, `Archived personal reward: ${reward.name}`); break; }
    case "skill.unlock": { const node = SKILL_NODES.find((n) => n.id === action.nodeId); ensure(node && !state.character.skillNodes.includes(node.id), "Skill unavailable or already unlocked."); ensure(state.character.skillXp[node.skill] >= node.requiredXp && (!node.prerequisite || state.character.skillNodes.includes(node.prerequisite)), "Skill requirements not met."); state.character.skillNodes.push(node.id); event(action.type, `Unlocked ${node.name}`); break; }
    case "career.select": { ensure(CAREERS.some((c) => c.id === action.careerId), "Unknown career."); state.character.career = action.careerId; event(action.type, "Career path selected"); break; }
    case "career.promote": { const career = CAREERS.find((c) => c.id === state.character.career)!; const requirement = (state.character.careerRank + 1) * 200; ensure(state.character.skillXp[career.skill] >= requirement, `Requires ${requirement} ${career.skill} XP.`); state.character.careerRank++; state.character.title = `${career.name} · Rank ${state.character.careerRank}`; gold(50 * state.character.careerRank, "Career promotion"); event(action.type, "Career milestone reached"); break; }
    case "campaign.create": { ensure(action.tasks.length > 0 && action.tasks.length <= 30, "A campaign needs 1–30 real tasks."); const id = `${context.eventId}:campaign`, bossId = `${context.eventId}:boss`; const def = BOSSES.find((b) => b.type === "campaign")!; const tasks = action.tasks.map((t) => createTask({ ...t, campaignId: id, kind: "campaign" })); for (const t of tasks) t.bossId = bossId; state.campaigns.push({ id, title: text(action.title), description: action.description?.slice(0, 2000) ?? "", bossId, requiredTaskIds: tasks.map((t) => t.id), milestones: tasks.map((t, i) => ({ id: `${id}:milestone:${i}`, title: t.title, taskIds: [t.id] })) }); state.bosses.push({ id: bossId, definitionId: def.id, campaignId: id, hp: def.maxHp, phase: 1 }); state.activeBossId = bossId; delete state.activeMeaningfulBossId; event(action.type, "Campaign launched"); break; }
    case "character.rename": { state.character.name = text(action.name, 40); event(action.type, "Character name updated"); break; }
    case "character.update": { if (action.appearance) state.character.appearance = mergeAppearance(state.character.appearance, action.appearance); if (action.name !== undefined) state.character.name = text(action.name, 40); for (const key of ["skin", "outfit", "hair"] as const) if (action[key] !== undefined) { ensure(/^#[0-9a-f]{6}$/i.test(action[key]!), "Choose a valid appearance color."); state.character[key] = action[key]!; } if (action.hairstyle !== undefined) { ensure(["short", "swept", "mohawk"].includes(action.hairstyle), "Invalid hairstyle."); state.character.hairstyle = action.hairstyle; } event(action.type, "Character appearance updated"); break; }
    case "character.rest": { ensure(!state.journal.some((e) => e.type === action.type && dateKey(e.at, state.settings.timezone) === today), "You have already rested today."); state.character.energy = Math.min(100, state.character.energy + 25); state.character.mood = Math.min(100, state.character.mood + 10); state.character.hp = Math.min(100, state.character.hp + 10); event(action.type, "A moment to recharge"); break; }
    case "settings.update": { const next = action.settings; if (next.timezone) { try { dateKey(context.now, next.timezone); } catch { throw new DomainError("INVALID_TIMEZONE", "Choose a valid timezone."); } ensure(next.timezone === state.settings.timezone || !state.tasks.some((t) => t.committed && !t.archived), "Resolve commitments before changing timezone."); } if (next.restDays) { ensure(next.restDays.length <= 366, "Too many rest days."); for (const day of next.restDays) ensure(validDate(day) >= today || state.settings.restDays.includes(day), "Rest days cannot erase past commitments."); } state.settings = { ...state.settings, ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) }; event(action.type, "Preferences updated"); break; }
    default: throw new DomainError("INVALID_ACTION", "Unknown action.");
  }
  state.revision++;
  ensure(Number.isSafeInteger(state.gold) && state.gold >= 0, "Economy invariant failed.", "INVARIANT");
  if (undoable) { const before = structuredClone(input); delete before.undo; state.undo = { eventId: context.eventId, at: context.now, revision: state.revision, before }; }
  return { state, events, message };
}

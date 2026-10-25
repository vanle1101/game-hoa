import { applyAction, createInitialState } from "./engine";
import type { Action, GameState } from "./types";

/** Explicit demo seed only. Production always calls createInitialState directly. */
export function createDemoState(userId = "demo", now = new Date().toISOString()): GameState {
  let state = createInitialState(userId, now);
  let counter = 0;
  const act = (action: Action) => { state = applyAction(state, action, { userId, now, random: () => 0.5, eventId: `demo-seed-${counter++}` }).state; };
  act({ type: "character.update", name: "Alex Chen", outfit: "#32e6f4" });
  act({ type: "task.create", task: { title: "Deep work · ship something meaningful", description: "One quiet hour. One important outcome.", difficulty: "hard", skill: "career", duration: 60, kind: "daily" } });
  act({ type: "task.create", task: { title: "Move your body for 30 minutes", description: "A walk, a workout, or a little room to breathe.", difficulty: "medium", skill: "health", duration: 30, kind: "daily" } });
  act({ type: "task.create", task: { title: "Read 20 pages", description: "Build a little more perspective.", difficulty: "easy", skill: "knowledge", duration: 25, kind: "daily" } });
  act({ type: "task.create", task: { title: "Organize your workspace", description: "Clear space for your next idea. Earn crafting materials.", difficulty: "medium", skill: "creativity", duration: 25, kind: "farming" } });
  act({ type: "task.create", task: { title: "Take a mindful break", description: "A recovery quest for a busy day.", difficulty: "easy", skill: "health", duration: 10, kind: "recovery" } });
  return state;
}

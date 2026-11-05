import type { Action, GameState } from "@/domain/types";
import type { BuildingPlan } from "@/construction/types";
import type { DraftHistory } from "./draft";
import { actionSchema } from "@/domain/validation";
import { FURNITURE } from "@/domain/catalog";
import { getBuilding } from "@/construction";
import { buildingStateSchema } from "@/construction/schema";
import { GameCommandError, postGameCommand, retainCommand, syncPendingGameCommand, type CommandStorage, type PendingGameCommand } from "@/components/game/command-client";
import { readAuthoritativeGameState, runLockedGameCommand, type LockedGameCommandOptions } from "@/components/game/command-lock";

export type ConstructionAction = Extract<Action, { type: "construction.commit" | "furniture.buy" | "furniture.sell" }>;
export interface ConstructionOwnerContext { state: GameState; epoch: number; }

export function readConstructionCommand(storage: CommandStorage, ownerId: string): PendingGameCommand | null {
  const raw = storage.getItem(`lifelevel-pending-command:${ownerId}`);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as PendingGameCommand;
    if (!value || value.ownerId !== ownerId || typeof value.key !== "string" || !value.key || typeof value.createdAt !== "string" || !actionSchema.safeParse(value.action).success) throw new Error();
    return value;
  } catch {
    throw new Error("Giao dịch đang chờ bị lỗi dữ liệu. Không thể tạo giao dịch mới; hãy khôi phục phiên hoặc liên hệ hỗ trợ.");
  }
}

export function migrateConstructionCommand(session: CommandStorage, durable: CommandStorage, ownerId: string): void {
  const legacy = readConstructionCommand(session, ownerId);
  if (!legacy) return;
  const current = readConstructionCommand(durable, ownerId);
  if (current && JSON.stringify(current) !== JSON.stringify(legacy)) throw new Error("Có hai giao dịch chưa xác nhận. Hãy đồng bộ giao dịch ở màn hình chính trước; mã giao dịch xây dựng vẫn được giữ.");
  const key = `lifelevel-pending-command:${ownerId}`;
  if (!current) durable.setItem(key, JSON.stringify(legacy));
  if (JSON.stringify(readConstructionCommand(durable, ownerId)) !== JSON.stringify(legacy)) throw new Error("Chưa thể chuyển mã giao dịch sang bộ nhớ dùng chung. Không gửi giao dịch mới.");
  session.removeItem(key);
}

export function retainConstructionCommand(storage: CommandStorage, ownerId: string, action: ConstructionAction, makeKey: () => string, now: string): PendingGameCommand {
  const pending = readConstructionCommand(storage, ownerId);
  if (pending) {
    if (JSON.stringify(pending.action) !== JSON.stringify(action)) throw new Error("Giao dịch trước chưa được xác nhận. Hãy thử lại giao dịch đang chờ trước khi mua hoặc lưu bản nháp mới.");
    return pending;
  }
  const command = retainCommand(storage, ownerId, structuredClone(action), makeKey, now);
  if (JSON.stringify(readConstructionCommand(storage, ownerId)) !== JSON.stringify(command)) throw new Error("Không thể lưu giao dịch an toàn trong phiên này. Chưa gửi giao dịch lên máy chủ.");
  return command;
}

export function validateConstructionState(value: unknown, ownerId: string): GameState {
  const state = value as GameState | undefined;
  if (!state || state.userId !== ownerId) throw new GameCommandError("Phiên người chơi đã thay đổi. Không áp dụng dữ liệu của người chơi khác.", true);
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || !state.character || !Array.isArray(state.inventory) || !state.ownedFurniture || !Array.isArray(state.campaigns) || !Array.isArray(state.pets) || !state.settings) throw new GameCommandError("Dữ liệu phản hồi chưa đầy đủ. Hãy thử lại giao dịch đang chờ.", true);
  try {
    if (!buildingStateSchema.safeParse(getBuilding(state)).success) throw new Error();
  } catch {
    throw new GameCommandError("Phiên bản công trình không hợp lệ. Hãy thử lại để xác nhận kết quả.", true);
  }
  return state;
}

export function canApplyConstructionResponse(ownerId: string, epoch: number, current: ConstructionOwnerContext, incoming: GameState): boolean {
  return current.epoch === epoch && current.state.userId === ownerId && incoming.userId === ownerId && incoming.revision >= current.state.revision && getBuilding(incoming).revision >= getBuilding(current.state).revision;
}

export async function runConstructionCommand(options: Omit<LockedGameCommandOptions, "send">, transport: typeof fetch = fetch): Promise<GameState> {
  if (options.action.type !== "construction.commit" && options.action.type !== "furniture.buy" && options.action.type !== "furniture.sell") throw new Error("Hãy trở về màn hình chính để đồng bộ giao dịch đang chờ.");
  const result = await runLockedGameCommand({ ...options, syncPending: options.syncPending ?? (transport === fetch
    ? () => syncPendingGameCommand(options.ownerId, options.storage) : undefined),
    readAuthoritativeState: options.readAuthoritativeState ?? (() => readAuthoritativeGameState(transport)), send: async command => {
    const response = await postGameCommand(command, transport,
      options.syncPending || transport === fetch ? options.revision : undefined);
    const state = validateConstructionState(response.state, command.ownerId);
    if (command.action.type === "construction.commit" && getBuilding(state).revision <= command.action.expectedRevision) throw new GameCommandError("Chưa xác nhận được phiên bản công trình đã lưu. Hãy thử lại giao dịch đang chờ.", true);
    return { ...response, state };
  } });
  return result.state;
}

export function reconcileConstructionDraft(history: DraftHistory, basePlan: BuildingPlan, submittedPlan: BuildingPlan, confirmedPlan: BuildingPlan): DraftHistory {
  const draft = JSON.stringify(history.present);
  return draft === JSON.stringify(basePlan) || draft === JSON.stringify(submittedPlan)
    ? { past: [], present: structuredClone(confirmedPlan), future: [] }
    : history;
}

export function initialOwnedFurniture(state: GameState, furnitureId?: string): string {
  return furnitureId && FURNITURE.some(item => item.id === furnitureId) && Number.isSafeInteger(state.ownedFurniture[furnitureId]) && state.ownedFurniture[furnitureId] > 0 ? furnitureId : "";
}

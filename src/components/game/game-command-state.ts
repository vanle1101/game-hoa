import type { GameState } from "@/domain/types";
import { getBuilding } from "@/construction";
import { migrateConstructionCommand, validateConstructionState } from "@/components/construction/command-state";
import { GameCommandError, newestGameState, postGameCommand, type CommandStorage } from "./command-client";
import { CommandLockError, publishCommandRevision, readAuthoritativeGameState, runLockedGameCommand, withOwnerCommandLock, type CommandLockManager, type LockedGameCommandOptions } from "./command-lock";

export interface GameCommandOptions extends Omit<LockedGameCommandOptions, "send" | "preflight"> {
  session?: CommandStorage;
  transport?: typeof fetch;
}

export function runGameCommand(options: GameCommandOptions): ReturnType<typeof postGameCommand> {
  return runLockedGameCommand({ ...options, readAuthoritativeState: options.readAuthoritativeState ?? (() => readAuthoritativeGameState(options.transport)), preflight: () => {
    if (options.session) migrateConstructionCommand(options.session, options.storage, options.ownerId);
  }, send: async command => {
    const result = await postGameCommand(command, options.transport);
    if (command.action.type === "construction.commit" || command.action.type === "furniture.buy") {
      validateConstructionState(result.state, command.ownerId);
      if (command.action.type === "construction.commit" && getBuilding(result.state).revision <= command.action.expectedRevision) throw new GameCommandError("Chưa xác nhận được phiên bản công trình đã lưu. Hãy thử lại giao dịch đang chờ.", true);
    }
    return result;
  } });
}

export interface GameSnapshot { state: GameState; mode?: string; }
export interface RefreshGameOptions {
  storage: CommandStorage;
  getCurrent: () => GameSnapshot | undefined;
  accept: (snapshot: GameSnapshot) => void;
  isActive: () => boolean;
  locks?: CommandLockManager | null;
  transport?: typeof fetch;
  makeKey?: () => string;
}

export async function refreshGameState(options: RefreshGameOptions): Promise<GameSnapshot> {
  const transport = options.transport ?? fetch;
  const previousOwner = options.getCurrent()?.state.userId;
  const response = await transport("/api/game", { cache: "no-store" });
  const initial = await response.json() as GameSnapshot & { error?: string };
  if (!response.ok) throw new Error(initial.error || "Không thể kết nối máy chủ.");
  if (!initial.state?.userId || !Number.isSafeInteger(initial.state.revision) || initial.state.revision < 0) throw new Error("Trạng thái người chơi không hợp lệ.");
  // The first query has no cached owner yet. Only reject a response when a
  // previous snapshot exists and its owner changed while the request was in
  // flight; otherwise the initial Home load can remain stuck at the WebGL
  // boot screen forever.
  if (!options.isActive() || (previousOwner && options.getCurrent()?.state.userId !== previousOwner)) throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Không áp dụng phản hồi cũ.");
  const ownerId = initial.state.userId;
  const snapshot = { ...initial, state: newestGameState(options.getCurrent()?.state, initial.state) };
  options.accept(snapshot);
  const getCurrentOwnerId = () => options.isActive() ? options.getCurrent()?.state.userId : undefined;
  return withOwnerCommandLock({ ownerId, getCurrentOwnerId, locks: options.locks }, async () => {
    const result = await postGameCommand({ ownerId, key: (options.makeKey ?? (() => crypto.randomUUID()))(), action: { type: "reconcile" }, createdAt: new Date().toISOString() }, transport);
    if (getCurrentOwnerId() !== ownerId) throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Không áp dụng phản hồi cũ.");
    const current = options.getCurrent();
    const effective = { ...snapshot, state: newestGameState(current?.state, result.state) };
    if (effective.state.revision > snapshot.state.revision) publishCommandRevision(options.storage, ownerId, effective.state.revision);
    options.accept(effective);
    return effective;
  });
}

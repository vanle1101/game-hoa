import type { Action } from "@/domain/types";
import { clearPendingCommand, GameCommandError, postGameCommand, readPendingCommand, retainCommand, type CommandStorage, type PendingGameCommand } from "./command-client";

export interface CommandLockManager {
  request<T>(name: string, options: { mode: "exclusive" }, callback: (lock: { name: string } | null) => Promise<T>): Promise<T>;
}

export type CommandLockErrorCode = "LOCK_UNAVAILABLE" | "OWNER_CHANGED" | "STALE_REVISION" | "INVALID_REVISION" | "PENDING_CHANGED";

export class CommandLockError extends Error {
  readonly uncertain = true;
  constructor(public readonly code: CommandLockErrorCode, message: string) {
    super(message);
    this.name = "CommandLockError";
  }
}

export interface CommandIntent {
  ownerId: string;
  revision: number;
  storage: CommandStorage;
  getCurrentOwnerId: () => string | null | undefined;
}

export interface LockedGameCommandOptions extends CommandIntent {
  action: Action;
  retryKey?: string;
  locks?: CommandLockManager | null;
  makeKey?: () => string;
  now?: () => string;
  send?: (command: PendingGameCommand) => ReturnType<typeof postGameCommand>;
  preflight?: () => void | Promise<void>;
  readAuthoritativeState?: (ownerId: string) => Promise<unknown>;
}

const signalKey = "lifelevel-state-changed";
const revisionKey = (ownerId: string) => `lifelevel-command-revision:${ownerId}`;
const validRevision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function ownerRevision(storage: CommandStorage, ownerId: string): number | null {
  let revision: number | null = null;
  for (const key of [signalKey, revisionKey(ownerId)]) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    let value: { ownerId?: unknown; revision?: unknown } | null;
    try { value = JSON.parse(raw); }
    catch { throw new CommandLockError("INVALID_REVISION", "Không đọc được phiên bản đồng bộ. Hãy tải lại trạng thái trước khi tiếp tục."); }
    if (!value || typeof value.ownerId !== "string" || !validRevision(value.revision) || key !== signalKey && value.ownerId !== ownerId) {
      throw new CommandLockError("INVALID_REVISION", "Phiên bản đồng bộ không hợp lệ. Hãy tải lại trạng thái trước khi tiếp tục.");
    }
    if (value.ownerId === ownerId) revision = Math.max(revision ?? 0, value.revision);
  }
  return revision;
}

export function validateCommandIntent(intent: CommandIntent, retainedCommand?: PendingGameCommand | null): void {
  if (!intent.ownerId || intent.getCurrentOwnerId() !== intent.ownerId) {
    throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục.");
  }
  if (!validRevision(intent.revision)) {
    throw new CommandLockError("INVALID_REVISION", "Phiên bản thao tác không hợp lệ. Hãy tải lại trạng thái trước khi tiếp tục.");
  }
  const revision = ownerRevision(intent.storage, intent.ownerId);
  if (revision !== null && revision > intent.revision && retainedCommand?.ownerId !== intent.ownerId) {
    throw new CommandLockError("STALE_REVISION", "Trạng thái đã thay đổi ở màn hình khác. Hãy đồng bộ trước khi thao tác lại.");
  }
}

export async function withOwnerCommandLock<T>(options: Pick<CommandIntent, "ownerId" | "getCurrentOwnerId"> & { locks?: CommandLockManager | null }, run: () => Promise<T>): Promise<T> {
  const locks: CommandLockManager | null | undefined = options.locks === undefined ? (typeof navigator === "undefined" ? undefined : navigator.locks) : options.locks;
  if (!locks || typeof locks.request !== "function") throw new CommandLockError("LOCK_UNAVAILABLE", "Trình duyệt không hỗ trợ khóa giao dịch an toàn giữa các thẻ. Không thể gửi thao tác.");
  return locks.request(`lifelevel-command:${options.ownerId}`, { mode: "exclusive" }, async lock => {
    if (!lock) throw new CommandLockError("LOCK_UNAVAILABLE", "Không lấy được khóa giao dịch. Chưa gửi thao tác.");
    if (!options.ownerId || options.getCurrentOwnerId() !== options.ownerId) throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục.");
    return run();
  });
}

export function publishCommandRevision(storage: CommandStorage, ownerId: string, revision: number): void {
  if (!validRevision(revision)) throw new CommandLockError("INVALID_REVISION", "Phiên bản đồng bộ không hợp lệ.");
  const previous = ownerRevision(storage, ownerId);
  const effective = Math.max(revision, previous ?? 0);
  const signal = JSON.stringify({ ownerId, revision: effective, at: Date.now() });
  const ownerSignal = storage.getItem(revisionKey(ownerId));
  if (ownerSignal === null || (JSON.parse(ownerSignal) as { revision: number }).revision < effective) storage.setItem(revisionKey(ownerId), signal);
  if (previous === null || effective > previous) storage.setItem(signalKey, signal);
  let retained: { ownerId?: unknown; revision?: unknown } | null;
  try { retained = JSON.parse(storage.getItem(revisionKey(ownerId)) ?? "null"); }
  catch { throw new CommandLockError("INVALID_REVISION", "Không thể lưu phiên bản đồng bộ an toàn. Giữ giao dịch để thử lại."); }
  if (!retained || retained.ownerId !== ownerId || !validRevision(retained.revision) || retained.revision < effective) throw new CommandLockError("INVALID_REVISION", "Không thể lưu phiên bản đồng bộ an toàn. Giữ giao dịch để thử lại.");
}

export async function readAuthoritativeGameState(transport: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  let body: unknown;
  try {
    response = await transport("/api/game", { cache: "no-store" });
    body = await response.json();
  } catch { throw new GameCommandError("Chưa xác minh được trạng thái máy chủ. Giữ thao tác chờ và thử đồng bộ lại.", true); }
  if (!response.ok || !body || typeof body !== "object" || !("state" in body)) throw new GameCommandError("Chưa xác minh được trạng thái máy chủ. Không gửi thao tác mới.", true);
  return body.state;
}

export async function runLockedGameCommand(options: LockedGameCommandOptions): ReturnType<typeof postGameCommand> {
  const intent: CommandIntent = { ownerId: options.ownerId, revision: options.revision, storage: options.storage, getCurrentOwnerId: options.getCurrentOwnerId };
  const action = structuredClone(options.action);
  const retryKey = options.retryKey;
  return withOwnerCommandLock(options, async () => {
    if (intent.getCurrentOwnerId() !== intent.ownerId) throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Giữ giao dịch để đồng bộ lại.");
    if (retryKey === undefined) {
      const authoritative = await (options.readAuthoritativeState ?? (() => readAuthoritativeGameState()))(intent.ownerId);
      if (intent.getCurrentOwnerId() !== intent.ownerId || !authoritative || typeof authoritative !== "object" || !("userId" in authoritative) || authoritative.userId !== intent.ownerId) throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Không gửi thao tác mới.");
      if (!("revision" in authoritative) || !validRevision(authoritative.revision) || !validRevision(intent.revision)) throw new CommandLockError("INVALID_REVISION", "Phiên bản máy chủ không hợp lệ. Không gửi thao tác mới.");
      if (authoritative.revision !== intent.revision) throw new CommandLockError("STALE_REVISION", "Trạng thái đã thay đổi ở màn hình khác. Hãy đồng bộ trước khi thao tác lại.");
    }
    await options.preflight?.();
    if (intent.getCurrentOwnerId() !== intent.ownerId) throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Giữ giao dịch để đồng bộ lại.");
    const pending = readPendingCommand(intent.storage, intent.ownerId);
    if (retryKey !== undefined && pending?.key !== retryKey) {
      throw new CommandLockError("PENDING_CHANGED", "Thao tác chờ đã được xử lý hoặc thay đổi. Hãy đồng bộ trạng thái, không tạo lại giao dịch.");
    }
    validateCommandIntent(intent, pending);
    const command = retainCommand(intent.storage, intent.ownerId, action, options.makeKey ?? (() => crypto.randomUUID()), (options.now ?? (() => new Date().toISOString()))());
    if (JSON.stringify(readPendingCommand(intent.storage, intent.ownerId)) !== JSON.stringify(command)) throw new CommandLockError("PENDING_CHANGED", "Không thể lưu mã giao dịch an toàn. Chưa gửi thao tác.");
    let result: Awaited<ReturnType<typeof postGameCommand>>;
    try { result = await (options.send ?? postGameCommand)(command); }
    catch (error) {
      if (error instanceof GameCommandError && !error.uncertain && intent.getCurrentOwnerId() === intent.ownerId) {
        clearPendingCommand(intent.storage, intent.ownerId, command.key);
      }
      throw error;
    }
    if (intent.getCurrentOwnerId() !== intent.ownerId || result.state.userId !== intent.ownerId) {
      throw new CommandLockError("OWNER_CHANGED", "Phiên người chơi đã thay đổi. Giữ thao tác để đồng bộ lại.");
    }
    if (!validRevision(result.state.revision)) throw new CommandLockError("INVALID_REVISION", "Kết quả đồng bộ không hợp lệ. Giữ thao tác để đồng bộ lại.");
    publishCommandRevision(intent.storage, intent.ownerId, Math.max(result.state.revision, intent.revision));
    clearPendingCommand(intent.storage, intent.ownerId, command.key);
    return result;
  });
}

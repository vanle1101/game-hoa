import type { Action, GameState } from "@/domain/types";
import { actionSchema } from "@/domain/validation";

export interface PendingGameCommand { key: string; action: Action; ownerId: string; createdAt: string; }
export interface CommandStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
const storageKey = (ownerId: string) => `lifelevel-pending-command:${ownerId}`;
function readRetainedCommand(storage: CommandStorage, ownerId: string): PendingGameCommand | null {
  const raw = storage.getItem(storageKey(ownerId));
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as PendingGameCommand;
    if (!value || value.ownerId !== ownerId || typeof value.key !== "string" || !value.key || typeof value.createdAt !== "string" || !actionSchema.safeParse(value.action).success) throw new Error();
    return value;
  } catch { throw new Error("Giao dịch đang chờ bị lỗi dữ liệu. Không thể tạo thao tác mới; hãy khôi phục phiên trước khi tiếp tục."); }
}
export function readPendingCommand(storage: CommandStorage, ownerId: string): PendingGameCommand | null {
  try { return readRetainedCommand(storage, ownerId); } catch { return null; }
}
export function retainCommand(storage: CommandStorage, ownerId: string, action: Action, makeKey: () => string, now: string): PendingGameCommand {
  const pending = readRetainedCommand(storage, ownerId);
  if (pending) {
    if (JSON.stringify(pending.action) !== JSON.stringify(action)) throw new Error("Thao tác trước chưa có kết quả chắc chắn. Hãy đồng bộ lại trước khi tiếp tục.");
    return pending;
  }
  const command = { key: makeKey(), action, ownerId, createdAt: now };
  storage.setItem(storageKey(ownerId), JSON.stringify(command));
  return command;
}
export function clearPendingCommand(storage: CommandStorage, ownerId: string, key: string): void {
  if (readPendingCommand(storage, ownerId)?.key === key) storage.removeItem(storageKey(ownerId));
}
export function newestGameState(current: GameState | undefined, incoming: GameState): GameState {
  return current?.userId === incoming.userId && current.revision > incoming.revision ? current : incoming;
}
export class GameCommandError extends Error {
  constructor(message: string, public readonly uncertain: boolean) { super(message); this.name = "GameCommandError"; }
}
export async function postGameCommand(command: PendingGameCommand, transport: typeof fetch = fetch, expectedRevision?: number): Promise<{ state: GameState; message: string }> {
  let response: Response;
  try { response = await transport("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: command.key, action: command.action, expectedOwnerId: command.ownerId, expectedRevision }) }); }
  catch { throw new GameCommandError("Mất kết nối khi lưu. Chọn Đồng bộ lại để nhận kết quả, không tạo giao dịch mới.", true); }
  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw new GameCommandError("Chưa đọc được kết quả máy chủ. Hãy đồng bộ lại thao tác.", true); }
  if (!raw || typeof raw !== "object") throw new GameCommandError("Kết quả máy chủ không hợp lệ. Hãy đồng bộ lại thao tác.", true);
  const body = raw as { state?: GameState; message?: unknown; error?: unknown; code?: unknown };
  if (response.status === 202) throw new GameCommandError("Máy chủ đã tiếp nhận thao tác và đang xử lý. Hãy đồng bộ lại để nhận kết quả.", true);
  if (!response.ok) throw new GameCommandError(typeof body.error === "string" ? body.error : "Không thể hoàn tất thao tác.", response.status >= 500 || response.status === 408 || response.status === 429 || response.status === 409 && body.code === "OWNER_CHANGED");
  if (!body.state || body.state.userId !== command.ownerId) throw new GameCommandError("Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục.", true);
  if (!Number.isSafeInteger(body.state.revision) || body.state.revision < 0 || !body.state.character || !Array.isArray(body.state.inventory)) throw new GameCommandError("Dữ liệu phản hồi chưa đầy đủ. Hãy đồng bộ lại thao tác.", true);
  return { state: body.state, message: typeof body.message === "string" ? body.message : "Đã đồng bộ thao tác." };
}

/** The server receipt is authoritative; browser storage is only a best-effort cache. */
export async function syncPendingGameCommand(ownerId: string, storage?: CommandStorage, transport: typeof fetch = fetch): Promise<PendingGameCommand | null> {
  let response: Response;
  let raw: unknown;
  try {
    response = await transport(`/api/game/intent?expectedOwnerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
    raw = await response.json();
  } catch { throw new GameCommandError("Chưa đọc được biên nhận trên máy chủ. Không gửi thao tác mới.", true); }
  if (!response.ok || !raw || typeof raw !== "object") throw new GameCommandError("Chưa xác minh được biên nhận trên máy chủ. Không gửi thao tác mới.", true);
  const body = raw as { ownerId?: unknown; mode?: unknown; intent?: { domain?: unknown; key?: unknown; command?: unknown; createdAt?: unknown } | null };
  if (body.ownerId !== ownerId) throw new GameCommandError("Phiên người chơi đã thay đổi. Không gửi thao tác mới.", true);
  // Local owner preview has no PostgreSQL intent table; keep its legacy journal.
  if (body.mode === "local") return storage ? readPendingCommand(storage, ownerId) : null;
  let pending: PendingGameCommand | null = null;
  if (body.intent) {
    if (body.intent.domain !== "game" || typeof body.intent.key !== "string" || !body.intent.key || !actionSchema.safeParse(body.intent.command).success) {
      throw new GameCommandError("Biên nhận trên máy chủ không hợp lệ. Không gửi thao tác mới.", true);
    }
    pending = { ownerId, key: body.intent.key, action: body.intent.command as Action,
      createdAt: typeof body.intent.createdAt === "string" ? body.intent.createdAt : new Date().toISOString() };
  }
  if (storage) {
    try {
      const key = storageKey(ownerId);
      if (pending) storage.setItem(key, JSON.stringify(pending)); else storage.removeItem(key);
    } catch { /* Server receipt remains authoritative when browser cache is unavailable. */ }
  }
  return pending;
}

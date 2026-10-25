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
export async function postGameCommand(command: PendingGameCommand, transport: typeof fetch = fetch): Promise<{ state: GameState; message: string }> {
  let response: Response;
  try { response = await transport("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: command.key, action: command.action, expectedOwnerId: command.ownerId }) }); }
  catch { throw new GameCommandError("Mất kết nối khi lưu. Chọn Đồng bộ lại để nhận kết quả, không tạo giao dịch mới.", true); }
  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw new GameCommandError("Chưa đọc được kết quả máy chủ. Hãy đồng bộ lại thao tác.", true); }
  if (!raw || typeof raw !== "object") throw new GameCommandError("Kết quả máy chủ không hợp lệ. Hãy đồng bộ lại thao tác.", true);
  const body = raw as { state?: GameState; message?: unknown; error?: unknown; code?: unknown };
  if (!response.ok) throw new GameCommandError(typeof body.error === "string" ? body.error : "Không thể hoàn tất thao tác.", response.status >= 500 || response.status === 408 || response.status === 429 || response.status === 409 && body.code === "OWNER_CHANGED");
  if (!body.state || body.state.userId !== command.ownerId) throw new GameCommandError("Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục.", true);
  if (!Number.isSafeInteger(body.state.revision) || body.state.revision < 0 || !body.state.character || !Array.isArray(body.state.inventory)) throw new GameCommandError("Dữ liệu phản hồi chưa đầy đủ. Hãy đồng bộ lại thao tác.", true);
  return { state: body.state, message: typeof body.message === "string" ? body.message : "Đã đồng bộ thao tác." };
}

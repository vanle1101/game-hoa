import { financeCommandSchema, type FinanceCommand, type FinanceState } from "@/finance";

export interface PendingFinanceCommand {
  key: string;
  command: FinanceCommand;
  status: string;
}

export async function readPendingFinanceCommand(ownerId: string, transport: typeof fetch = fetch): Promise<PendingFinanceCommand | null> {
  let response: Response;
  let raw: unknown;
  try {
    response = await transport(`/api/finance/intent?expectedOwnerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
    raw = await response.json();
  } catch { throw new Error("Chưa xác minh được thao tác tài chính trên máy chủ."); }
  if (!response.ok || !raw || typeof raw !== "object") throw new Error("Chưa xác minh được thao tác tài chính trên máy chủ.");
  const body = raw as { ownerId?: unknown; intent?: { domain?: unknown; key?: unknown; status?: unknown; command?: unknown } | null };
  if (body.ownerId !== ownerId) throw new Error("Phiên tài khoản đã thay đổi. Tải lại tài chính.");
  if (!body.intent) return null;
  if (body.intent.domain !== "finance" || typeof body.intent.key !== "string" || !body.intent.key ||
    typeof body.intent.status !== "string") throw new Error("Biên nhận tài chính trên máy chủ không hợp lệ.");
  const command = financeCommandSchema.safeParse(body.intent.command);
  if (!command.success) throw new Error("Nội dung thao tác tài chính trên máy chủ không hợp lệ.");
  return { key: body.intent.key, status: body.intent.status, command: command.data };
}

export async function readFinanceForOwner(ownerId: string, transport: typeof fetch = fetch): Promise<FinanceState> {
  const response = await transport(`/api/finance?expectedOwnerId=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Không thể tải tài chính.");
  if (response.headers.get("X-Owner-Id") !== ownerId) throw new Error("Phiên tài khoản đã thay đổi. Tải lại tài chính.");
  return data as FinanceState;
}

export async function postFinanceCommand(ownerId: string, command: FinanceCommand, key: string,
  transport: typeof fetch = fetch): Promise<{ status: "applied"; state: FinanceState } | { status: "pending" }> {
  const response = await transport("/api/finance", { method: "POST", headers: {
    "Content-Type": "application/json", "Idempotency-Key": key, "X-Expected-Owner-Id": ownerId,
  }, body: JSON.stringify(command) });
  const data = await response.json();
  if (response.status === 202) {
    if (data?.key !== key || data?.status !== "pending") throw new Error("Biên nhận tài chính trên máy chủ không hợp lệ.");
    return { status: "pending" };
  }
  if (!response.ok) throw new Error(data?.error || "Không thể lưu tài chính.");
  return { status: "applied", state: data as FinanceState };
}

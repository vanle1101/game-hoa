import { aiRequestSchema, createProposal, proposalAction, proposalSchema, providerStatus } from "@/server/ai";
import { checkOrigin, errorResponse, HttpError, requireUser } from "@/server/identity";
import { compareAndSetProposal, gameCommand, readPrivate, saveProposal } from "@/server/store";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
export const maxDuration = 40;
// Per-instance admission control; deploy a shared limiter before opening access beyond the allowlist.
const requests = new Map<string, { start: number; count: number; active: boolean }>();
function enterProvider(userId: string) {
  const now = Date.now();
  const previous = requests.get(userId);
  if (previous?.active) throw new HttpError(429, "Một kế hoạch đang được tạo. Hãy đợi phản hồi.");
  const current = previous && now - previous.start < 60_000 ? previous : { start: now, count: 0, active: false };
  if (current.count >= 6) throw new HttpError(429, "Bạn đã gửi nhiều yêu cầu. Hãy thử lại sau một phút.");
  current.count++; current.active = true; requests.set(userId, current);
  return () => { current.active = false; };
}
export async function GET() {
  try {
    const userId = await requireUser();
    const proposals = await readPrivate(userId, "proposals") as Record<string, unknown>;
    return Response.json({ proposals: Object.values(proposals).map(value => proposalSchema.parse(value)), provider: providerStatus() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const userId = await requireUser();
    const input = await readJSON(request,10_000);
    const parsed = aiRequestSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(400, "Yêu cầu AI không hợp lệ.");
    const command = parsed.data;
    if (command.mode === "propose") {
      const leave = enterProvider(userId);
      try {
        const proposal = await createProposal(command.prompt);
        await saveProposal(userId, proposal.id, proposal);
        return Response.json({ proposal, provider: providerStatus() }, { status: 201 });
      } finally { leave(); }
    }
    const proposals = await readPrivate(userId, "proposals") as Record<string, unknown>;
    const stored = proposalSchema.safeParse(proposals[command.id]);
    if (!stored.success) throw new HttpError(404, "Không tìm thấy đề xuất của bạn.");
    let proposal = stored.data;
    if (command.mode === "reject") {
      if (proposal.status === "approved" || proposal.status === "applying") throw new HttpError(409, "Đề xuất đã được duyệt; không thể từ chối lại.");
      if (proposal.status === "rejected") return Response.json({ proposal });
      const rejected = { ...proposal, status: "rejected" as const };
      if (!await compareAndSetProposal(userId, proposal.id, "pending", rejected)) throw new HttpError(409, "Đề xuất đã thay đổi ở phiên khác. Hãy tải lại.");
      return Response.json({ proposal: rejected });
    }
    if (proposal.status === "pending") {
      const applying = { ...proposal, status: "applying" as const };
      if (!await compareAndSetProposal(userId, proposal.id, "pending", applying)) throw new HttpError(409, "Đề xuất đã thay đổi ở phiên khác. Hãy tải lại.");
      proposal = applying;
    }
    // A failed/interrupted apply can be resumed; the stable command key prevents duplicates.
    const action = proposalAction(proposal);
    const result = await gameCommand(userId, `ai-proposal:${proposal.id}`, action);
    const approved = { ...proposal, status: "approved" as const };
    if (proposal.status !== "approved") await compareAndSetProposal(userId, proposal.id, "applying", approved);
    return Response.json({ proposal: approved, ...result });
  } catch (error) { return errorResponse(error); }
}

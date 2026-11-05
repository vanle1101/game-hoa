import { aiRequestSchema, createProposal, proposalAction, proposalSchema, providerStatus } from "@/server/ai";
import { checkOrigin, errorResponse, HttpError, isLocalDevelopment, requireAccount, requireUser } from "@/server/identity";
import { compareAndSetProposal, gameCommand, readGame, readPrivate, saveProposal } from "@/server/store";
import { enqueueAiJob, listUserJobs } from "@/server/jobs";
import { readJSON } from "@/server/request";

export const runtime = "nodejs";
export async function GET() {
  try {
    const userId = await requireUser();
    const proposals = await readPrivate(userId, "proposals") as Record<string, unknown>;
    const jobs = isLocalDevelopment() ? [] : await listUserJobs(userId);
    return Response.json({ proposals: Object.values(proposals).map(value => proposalSchema.parse(value)), jobs, provider: providerStatus() }, { headers: { "Cache-Control": "private, no-store" } });
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
      if (!providerStatus().configured) throw new HttpError(503, "AI phía máy chủ chưa được cấu hình.");
      // The local-only demo retains its short synchronous workflow. Production
      // acknowledges work only after a durable PostgreSQL transaction commits.
      if (isLocalDevelopment()) {
        const proposal = await createProposal(command.prompt);
        await saveProposal(userId, proposal.id, proposal);
        return Response.json({ proposal, provider: providerStatus() }, { status: 201 });
      }
      await requireAccount();
      const key = request.headers.get("Idempotency-Key");
      if (!key) throw new HttpError(400, "Thiếu mã yêu cầu.");
      await readGame(userId);
      const job = await enqueueAiJob(userId, command.prompt, key);
      return Response.json({ job, provider: providerStatus() }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
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

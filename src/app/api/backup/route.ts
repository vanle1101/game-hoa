import { createBackup, BackupError } from "@/backup";
import { requireUser, errorResponse } from "@/server/identity";
import { readGame, readPrivate } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const userId = await requireUser();
    // These are separate reads; verify game revision did not change during the export.
    // Finance remains a separate transactional aggregate and is internally validated.
    const game = await readGame(userId);
    const [finance, proposals] = await Promise.all([readPrivate(userId, "finance"), readPrivate(userId, "proposals")]);
    const latest = await readGame(userId);
    if (latest.revision !== game.revision) return Response.json({ error: "Dữ liệu vừa thay đổi. Hãy thử xuất lại bản sao lưu." }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    const backup = createBackup(userId, game, finance, proposals);
    return Response.json(backup, { headers: { "Cache-Control": "private, no-store, max-age=0", "Content-Disposition": `attachment; filename="life-level-${backup.exportedAt.slice(0, 10)}.json"`, "X-Content-Type-Options": "nosniff" } });
  } catch (error) { if (error instanceof BackupError) return Response.json({ error: error.message }, { status: 422, headers: { "Cache-Control": "private, no-store" } }); return errorResponse(error); }
}

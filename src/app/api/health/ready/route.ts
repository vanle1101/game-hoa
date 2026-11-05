import { sql } from "drizzle-orm";
import { database } from "@/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await database().execute(sql`select 1`);
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ status: "live" }, { headers: { "Cache-Control": "no-store" } });
}

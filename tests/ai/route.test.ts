import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ proposals: {} as Record<string, unknown>, applied: new Map<string, unknown>(), count: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/identity", () => {
  class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
  return { HttpError, requireUser: async () => "owner", checkOrigin: (request: Request) => {
    if (request.headers.get("origin") !== "https://app.example.com") throw new HttpError(403, "Origin");
  }, errorResponse: (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: error instanceof HttpError ? error.status : 500 }) };
});
vi.mock("@/server/store", () => ({
  readPrivate: async () => structuredClone(state.proposals),
  saveProposal: async (_user: string, id: string, value: unknown) => { state.proposals[id] = value; },
  compareAndSetProposal: async (_user: string, id: string, expected: string, value: unknown) => {
    if ((state.proposals[id] as { status: string })?.status !== expected) return false;
    state.proposals[id] = value; return true;
  },
  gameCommand: async (_user: string, id: string, action: unknown) => {
    if (!state.applied.has(id)) { state.applied.set(id, action); state.count++; }
    return { state: { revision: state.count }, events: [], message: "OK" };
  },
}));
import { POST } from "@/app/api/ai/route";
const id = "d142dba6-9cd7-4e4d-bb79-34a553d48243";
const proposal = { id, createdAt: "2026-10-15T10:00:00.000Z", status: "pending", provider: "demo", plan: { title: "Learning", summary: "Practice", tasks: [{ title: "Read", description: "One chapter", difficulty: "easy", skill: "knowledge", duration: 25, dueDate: "2026-10-16" }] } };
const request = (mode: string) => new Request("https://app.example.com/api/ai", { method: "POST", headers: { origin: "https://app.example.com", "content-type": "application/json" }, body: JSON.stringify({ mode, id }) });
beforeEach(() => { state.proposals = { [id]: structuredClone(proposal) }; state.applied.clear(); state.count = 0; });
describe("AI approval route", () => {
  it("duplicate approvals reuse the stable game command key", async () => {
    expect((await POST(request("approve"))).status).toBe(200);
    expect((await POST(request("approve"))).status).toBe(200);
    expect(state.count).toBe(1);
    expect((state.proposals[id] as { status: string }).status).toBe("approved");
  });
  it("reject prevents later application", async () => {
    expect((await POST(request("reject"))).status).toBe(200);
    expect((await POST(request("approve"))).status).toBe(409);
    expect(state.count).toBe(0);
  });
  it("simultaneous approval and rejection have one winning transition", async () => {
    const outcomes = await Promise.all([POST(request("approve")), POST(request("reject"))]);
    expect(outcomes.map(response => response.status).sort()).toEqual([200, 409]);
    expect((state.proposals[id] as { status: string }).status).toBe("approved");
    expect(state.count).toBe(1);
  });
  it("resumes an interrupted applying proposal idempotently", async () => {
    state.proposals[id] = { ...proposal, status: "applying" };
    expect((await POST(request("approve"))).status).toBe(200);
    expect(state.count).toBe(1);
  });
  it("rejects invalid origin before reading proposal state", async () => {
    const unsafe = request("approve"); unsafe.headers.set("origin", "https://other.example.com");
    expect((await POST(unsafe)).status).toBe(403);
    expect(state.count).toBe(0);
  });
  it("cannot access an absent owner's proposal", async () => {
    state.proposals = {};
    expect((await POST(request("approve"))).status).toBe(404);
    expect(state.count).toBe(0);
  });
});

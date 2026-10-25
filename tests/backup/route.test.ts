import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../src/domain";
const context = vi.hoisted(() => ({ authenticated: true, reads: [] as string[], revisions: [0, 0] }));
vi.mock("@/server/identity", () => ({ requireUser: async () => { if (!context.authenticated) throw new Error("Unauthenticated"); return "owner"; }, errorResponse: () => Response.json({ error: "Unauthenticated" }, { status: 401 }) }));
vi.mock("@/server/store", () => ({
  readGame: async (userId: string) => { context.reads.push(userId); return { ...createInitialState(userId, "2026-10-15T12:00:00.000Z"), revision: context.revisions.shift() ?? 0 }; },
  readPrivate: async (userId: string, domain: string) => { context.reads.push(`${userId}:${domain}`); return domain === "finance" ? null : {}; },
}));
import { GET } from "../../src/app/api/backup/route";
beforeEach(() => { context.authenticated = true; context.reads = []; context.revisions = [0, 0]; });
describe("authenticated backup export", () => {
  it("exports only authenticated owner's state with no-store download headers", async () => {
    const response = await GET(); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("content-disposition")).toContain("attachment;");
    const data = await response.json(); expect(data.sourceUserId).toBe("owner"); expect(data.game.userId).toBe("owner");
    expect(context.reads).toEqual(["owner", "owner:finance", "owner:proposals", "owner"]);
  });
  it("does not read private storage without authentication", async () => {
    context.authenticated = false; expect((await GET()).status).toBe(401); expect(context.reads).toEqual([]);
  });
  it("rejects exports if gameplay changes during the read", async () => {
    context.revisions = [2, 3]; const response = await GET(); expect(response.status).toBe(409); expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

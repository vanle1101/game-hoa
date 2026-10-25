import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const context = vi.hoisted(() => ({ token: "a".repeat(64), gameCommand: vi.fn(), cookieSet: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: context.token }), set: context.cookieSet }) }));
vi.mock("@/server/store", () => ({ gameCommand: context.gameCommand, readGame: vi.fn() }));
import { POST } from "../../src/app/api/game/route";
import { postGameCommand } from "../../src/components/game/command-client";

const key = "11111111-1111-4111-8111-111111111111";
const owner = (token: string) => createHash("sha256").update(`guest:${token}`).digest("hex");
const action = { type: "character.rename", name: "Bound intent" };
const request = (body: unknown) => new Request("https://game.example/api/game", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://game.example", Host: "game.example" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv("LOCAL_DEV_MODE", "false");
  context.token = "a".repeat(64); context.gameCommand.mockReset(); context.cookieSet.mockReset();
  context.gameCommand.mockImplementation(async (userId: string) => ({ state: { userId, revision: 1, character: {}, inventory: [] }, message: "saved" }));
});

afterEach(() => vi.unstubAllEnvs());

describe("game mutation owner precondition", () => {
  it("rejects stale-owner intent before the store is invoked", async () => {
    const response = await POST(request({ key, action, expectedOwnerId: owner("b".repeat(64)) }));
    expect(response.status).toBe(409); const body = await response.json(); expect(body.error).toContain("Phiên người chơi"); expect(body.code).toBe("OWNER_CHANGED"); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(context.gameCommand).not.toHaveBeenCalled(); expect(context.cookieSet).not.toHaveBeenCalled();
  });
  it("executes matching intent using the canonical cookie owner", async () => {
    const canonical = owner(context.token);
    const response = await POST(request({ key, action, expectedOwnerId: canonical }));
    expect(response.status).toBe(200); expect(context.gameCommand).toHaveBeenCalledExactlyOnceWith(canonical, key, action);
    expect((await response.json()).state.userId).toBe(canonical);
  });
  it("retains legacy envelope compatibility but never uses a payload owner as authority", async () => {
    expect((await POST(request({ key, action }))).status).toBe(200);
    expect(context.gameCommand).toHaveBeenCalledExactlyOnceWith(owner(context.token), key, action);
    context.gameCommand.mockClear();
    expect((await POST(request({ key, action, userId: "payload-owner" }))).status).toBe(400);
    expect(context.gameCommand).not.toHaveBeenCalled();
  });
  it.each([null, 42, "", "x".repeat(201)])("rejects malformed expected owner %# without mutation", async expectedOwnerId => {
    expect((await POST(request({ key, action, expectedOwnerId }))).status).toBe(400);
    expect(context.gameCommand).not.toHaveBeenCalled();
  });
  it("blocks a real client retained command after cookie identity changes", async () => {
    const priorOwner = owner(context.token); context.token = "b".repeat(64);
    const command = { key, action: { type: "character.rename" as const, name: "Bound intent" }, ownerId: priorOwner, createdAt: "2026-10-16T12:00:00Z" };
    const transport = (async (_url: unknown, init?: RequestInit) => POST(request(JSON.parse(String(init?.body))))) as typeof fetch;
    await expect(postGameCommand(command, transport)).rejects.toMatchObject({ uncertain: true });
    expect(context.gameCommand).not.toHaveBeenCalled();
  });
});

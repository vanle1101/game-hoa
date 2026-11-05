import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(), registerAccount: vi.fn(), loginAccount: vi.fn(), findAccountSession: vi.fn(),
  revokeAccountSession: vi.fn(), claimGuestSave: vi.fn(), hasClaimableGuestSave: vi.fn(), isClaimedGuest: vi.fn(),
  consumeAuthAttempt: vi.fn(), clearLoginAttempts: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/server/auth", async importOriginal => {
  const actual = await importOriginal<typeof import("@/server/auth")>();
  return { ...actual, registerAccount: mocks.registerAccount, loginAccount: mocks.loginAccount,
    findAccountSession: mocks.findAccountSession, revokeAccountSession: mocks.revokeAccountSession,
    claimGuestSave: mocks.claimGuestSave, hasClaimableGuestSave: mocks.hasClaimableGuestSave, isClaimedGuest: mocks.isClaimedGuest,
    consumeAuthAttempt: mocks.consumeAuthAttempt, clearLoginAttempts: mocks.clearLoginAttempts };
});

import { requireUser } from "@/server/identity";
import * as status from "@/app/api/auth/route";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as claim from "@/app/api/auth/claim/route";

const origin = "https://game.example.com";
const guestToken = "ab".repeat(32);
const accountToken = "A".repeat(43);
const guestUserId = createHash("sha256").update(`guest:${guestToken}`).digest("hex");
const post = (path: string, body: unknown = {}, requestOrigin = origin) => new Request(`${origin}${path}`, {
  method: "POST", headers: { origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

let cookieValues: Map<string, string>;
let jar: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("LOCAL_DEV_MODE", "false");
  vi.stubEnv("VERCEL", "");
  mocks.isClaimedGuest.mockResolvedValue(false);
  cookieValues = new Map([["lifelevel-session", guestToken], ["lifelevel-auth", accountToken]]);
  jar = { get: vi.fn((name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined),
    set: vi.fn((name: string, value: string) => cookieValues.set(name, value)),
    delete: vi.fn((name: string) => cookieValues.delete(name)) };
  mocks.cookies.mockResolvedValue(jar);
  mocks.findAccountSession.mockResolvedValue({ userId: "account:alice", email: "alice@example.com" });
  mocks.hasClaimableGuestSave.mockResolvedValue(true);
  mocks.registerAccount.mockResolvedValue({ userId: "account:alice", email: "alice@example.com", token: accountToken });
  mocks.loginAccount.mockResolvedValue({ userId: "account:alice", email: "alice@example.com", token: accountToken });
  mocks.claimGuestSave.mockResolvedValue({ claimed: true, alreadyClaimed: false, userId: "account:alice" });
});

describe("account API and owner resolution", () => {
  it("shows account and claim availability without exposing either token", async () => {
    const response = await status.GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ authenticated: true, account: { userId: "account:alice", email: "alice@example.com" }, guestSaveAvailable: true, localMode: false });
    expect(JSON.stringify(body)).not.toContain(accountToken);
    expect(mocks.hasClaimableGuestSave).toHaveBeenCalledWith(guestUserId);
  });

  it("resolves the same account owner from a valid account session, otherwise stays on its guest save", async () => {
    expect(await requireUser()).toBe("account:alice");
    mocks.findAccountSession.mockResolvedValueOnce(null);
    expect(await requireUser()).toBe(guestUserId);
  });

  it("registers and logs in with an HttpOnly secure session cookie", async () => {
    const credentials = { email: "alice@example.com", password: "a sufficiently long password" };
    expect((await register.POST(post("/api/auth/register", credentials))).status).toBe(201);
    expect((await login.POST(post("/api/auth/login", credentials))).status).toBe(200);
    expect(jar.set).toHaveBeenCalledWith("lifelevel-auth", accountToken, expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }));
    expect(jar.set).not.toHaveBeenCalledWith("lifelevel-session", expect.anything(), expect.anything());
  });

  it("requires same-origin requests for register, login, claim and logout", async () => {
    for (const [path, route] of [["register", register], ["login", login], ["claim", claim], ["logout", logout]] as const) {
      expect((await route.POST(post(`/api/auth/${path}`, {}, "https://attacker.example"))).status).toBe(403);
    }
    expect(mocks.registerAccount).not.toHaveBeenCalled();
    expect(mocks.loginAccount).not.toHaveBeenCalled();
    expect(mocks.claimGuestSave).not.toHaveBeenCalled();
    expect(mocks.revokeAccountSession).not.toHaveBeenCalled();
  });

  it("claims only the guest save owned by this browser and rotates its guest cookie", async () => {
    const response = await claim.POST(post("/api/auth/claim"));
    expect(response.status).toBe(200);
    expect(mocks.claimGuestSave).toHaveBeenCalledWith("account:alice", guestUserId);
    expect(jar.set).toHaveBeenCalledWith("lifelevel-session", expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({ httpOnly: true, secure: true }));
  });

  it("rejects claim when there is no account session or guest cookie", async () => {
    mocks.findAccountSession.mockResolvedValueOnce(null);
    expect((await claim.POST(post("/api/auth/claim"))).status).toBe(401);
    cookieValues.delete("lifelevel-session");
    expect((await claim.POST(post("/api/auth/claim"))).status).toBe(404);
    expect(mocks.claimGuestSave).not.toHaveBeenCalled();
  });

  it("revokes only this account session on logout", async () => {
    expect((await logout.POST(post("/api/auth/logout"))).status).toBe(200);
    expect(mocks.revokeAccountSession).toHaveBeenCalledWith(accountToken);
    expect(jar.delete).toHaveBeenCalledWith("lifelevel-auth");
    expect(cookieValues.get("lifelevel-session")).toBe(guestToken);
  });
});

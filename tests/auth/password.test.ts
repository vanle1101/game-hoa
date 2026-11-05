import { describe, expect, it, vi } from "vitest";
import { isDeepStrictEqual } from "node:util";
vi.mock("server-only", () => ({}));
import { cloneGameForOwner, guestUserIdFromToken, hashPassword, normalizeEmail, validAuthToken, verifyPassword } from "@/server/auth";
import { createInitialState } from "@/domain";

describe("account credential and ownership primitives", () => {
  it("uses a salted password hash and rejects the wrong password", async () => {
    const first = await hashPassword("a sufficiently long password");
    const second = await hashPassword("a sufficiently long password");
    expect(first).not.toBe(second);
    expect(first).not.toContain("a sufficiently long password");
    expect(await verifyPassword("a sufficiently long password", first)).toBe(true);
    expect(await verifyPassword("different password", first)).toBe(false);
    expect(await verifyPassword("a sufficiently long password", undefined)).toBe(false);
  });

  it("normalizes email but keeps account tokens distinct from old guest tokens", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
    expect(validAuthToken("ab".repeat(32))).toBe(false);
    expect(validAuthToken("A".repeat(43))).toBe(true);
    expect(guestUserIdFromToken("ab".repeat(32))).toMatch(/^[a-f0-9]{64}$/);
    expect(() => guestUserIdFromToken("not-a-guest-token")).toThrow();
  });

  it("copies an undoable guest save to its account owner without mutating the original", () => {
    const guest = createInitialState("guest", "2026-10-26T00:00:00.000Z");
    guest.undo = { eventId: "original", at: guest.createdAt, revision: 1, before: structuredClone(guest) };
    const account = cloneGameForOwner(guest, "account:alice");
    expect(account.userId).toBe("account:alice");
    expect(account.undo?.before.userId).toBe("account:alice");
    expect(guest.userId).toBe("guest");
    expect(guest.undo?.before.userId).toBe("guest");
  });

  it("recognizes an untouched account save after JSONB-style serialization", () => {
    const initial = createInitialState("account:alice", "2026-10-26T00:00:00.000Z");
    expect(isDeepStrictEqual(JSON.parse(JSON.stringify(initial)), createInitialState(initial.userId, initial.createdAt))).toBe(true);
  });
});

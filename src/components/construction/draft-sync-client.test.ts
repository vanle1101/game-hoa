import { describe, expect, it, vi } from "vitest";
import type { BuildingPlan } from "@/construction/types";
import { DraftSyncError, draftFingerprint, readServerDraft, saveServerDraft, clearServerDraft } from "./draft-sync-client";

const plan: BuildingPlan = { floors: [], walls: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} };

describe("owner draft transport", () => {
  it("treats JSONB key reordering as the same draft", () => {
    const first = { ...plan, roomNames: { living: "A", kitchen: "B" } };
    const second = { roomNames: { kitchen: "B", living: "A" }, roofs: [], ceilings: [], stairs: [], furniture: [], walls: [], floors: [] } as BuildingPlan;
    expect(draftFingerprint(first)).toBe(draftFingerprint(second));
  });
  it("sends an expected revision and refuses a concurrent overwrite", async () => {
    const transport = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({ expectedOwnerId: "owner", baseRevision: 7, expectedDraftRevision: 3, plan });
      return Response.json({ error: "stale" }, { status: 409 });
    }) as unknown as typeof fetch;
    await expect(saveServerDraft("owner", plan, 7, 3, transport)).rejects.toMatchObject({ kind: "conflict" });
  });

  it("rejects invalid server data before it becomes an editor draft", async () => {
    const transport = vi.fn(async () => Response.json({ ownerId: "owner", plan: { floors: "invalid" }, baseRevision: 1, draftRevision: 2 })) as unknown as typeof fetch;
    await expect(readServerDraft("owner", transport)).rejects.toBeInstanceOf(DraftSyncError);
  });

  it("does not clear a draft changed on another device", async () => {
    const transport = vi.fn(async () => Response.json({ error: "stale" }, { status: 409 })) as unknown as typeof fetch;
    await expect(clearServerDraft("owner", 5, transport)).rejects.toMatchObject({ kind: "conflict" });
    expect(JSON.parse(String(vi.mocked(transport).mock.calls[0][1]?.body))).toEqual({ expectedOwnerId: "owner", expectedDraftRevision: 5 });
  });
});

import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({ database: mocks.database }));
import { claimGuestSave } from "@/server/auth";
import { createInitialState } from "@/domain";
import * as schema from "@/server/schema";
import { constructionDrafts, userPortraits } from "@/server/artifacts-schema";
import { backgroundJobs } from "@/server/jobs-schema";

const guestUserId = "ab".repeat(32);
const accountUserId = "account:test";
type Capture = { table: unknown; value: unknown };

function fakeTransaction(responses: unknown[][]) {
  let selected = 0;
  const inserted: Capture[] = [];
  const updated: Capture[] = [];
  const query = (value: unknown) => {
    const q = {
      where: () => q, for: () => q, limit: () => q,
      onConflictDoNothing: () => q,
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(value).then(resolve, reject),
    };
    return q;
  };
  const tx = {
    select: () => {
      const rows = responses[selected++] ?? [];
      return { from: () => query(rows) };
    },
    insert: (table: unknown) => ({ values: (value: unknown) => { inserted.push({ table, value }); return query(undefined); } }),
    update: (table: unknown) => ({ set: (value: unknown) => ({ where: () => { updated.push({ table, value }); return query(undefined); } }) }),
  };
  mocks.database.mockReturnValue({ transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) });
  return { inserted, updated, selected: () => selected };
}

describe("non-destructive guest claim transaction", () => {
  it("copies save, finance, proposal receipts, portrait and draft to the account without deleting guest rows", async () => {
    const guest = createInitialState(guestUserId, "2026-10-26T00:00:00.000Z");
    guest.character.name = "Guest Hero";
    guest.revision = 3;
    const account = createInitialState(accountUserId, "2026-10-26T01:00:00.000Z");
    const draftPlan = { floors: [] };
    const capture = fakeTransaction([
      [{ userId: accountUserId }], [{ userId: guestUserId, state: guest, revision: 3 }], [],
      [{ userId: accountUserId, state: account, revision: 0 }], [], [], [], [], [],
      [{ id: "old-proposal", userId: guestUserId, type: "ai.propose", status: "succeeded", idempotencyKey: "request-1",
        fingerprint: "fingerprint", payload: { prompt: "plan" }, result: { proposalId: "old-proposal" }, error: null,
        attempts: 1, maxAttempts: 3, runAt: new Date(), createdAt: new Date(), updatedAt: new Date() }],
      [],
      [{ userId: guestUserId, domain: "game", key: "old-action", fingerprint: "action-fingerprint",
        payload: { action: { type: "character.rest" } }, status: "applied", result: { state: guest, events: [], message: "Saved" },
        error: null, errorStatus: null, attempts: 1, runAt: new Date(), createdAt: new Date(), updatedAt: new Date() }],
      [{ userId: guestUserId, state: { accounts: [{ id: "a" }] } }],
      [{ id: "old-proposal", userId: guestUserId, proposal: { id: "old-proposal", status: "approved" }, status: "approved", createdAt: new Date() }],
      [{ userId: guestUserId, key: "ai-proposal:old-proposal", fingerprint: "fingerprint", result: { events: [] }, createdAt: new Date() }],
      [{ userId: guestUserId, portraitKey: "look-1", dataUrl: "data:image/png;base64,AA==", updatedAt: new Date() }],
      [{ userId: guestUserId, plan: draftPlan, baseRevision: 3, draftRevision: 2, updatedAt: new Date() }],
    ]);
    expect(await claimGuestSave(accountUserId, guestUserId)).toMatchObject({ claimed: true, alreadyClaimed: false });
    const accountState = capture.updated.find(item => item.table === schema.playerStates)?.value as { state: typeof guest };
    expect(accountState.state.userId).toBe(accountUserId);
    expect(accountState.state.character.name).toBe("Guest Hero");
    expect(guest.userId).toBe(guestUserId);
    const copiedProposal = (capture.inserted.find(item => item.table === schema.aiProposals)?.value as { id: string; proposal: { id: string } }[])[0];
    expect(copiedProposal.id).not.toBe("old-proposal");
    expect(copiedProposal.proposal.id).toBe(copiedProposal.id);
    const copiedCommand = (capture.inserted.find(item => item.table === schema.commandRecords)?.value as { key: string }[])[0];
    expect(copiedCommand.key).toBe(`ai-proposal:${copiedProposal.id}`);
    const copiedJob = (capture.inserted.find(item => item.table === backgroundJobs)?.value as { id: string; userId: string; result: { proposalId: string } }[])[0];
    expect(copiedJob.id).toBe(copiedProposal.id);
    expect(copiedJob.userId).toBe(accountUserId);
    expect(copiedJob.result.proposalId).toBe(copiedProposal.id);
    const copiedIntent = (capture.inserted.find(item => item.table === schema.commandIntents)?.value as { result: { state: typeof guest } }[])[0];
    expect(copiedIntent.result.state.userId).toBe(accountUserId);
    expect(guest.userId).toBe(guestUserId);
    expect(capture.inserted.find(item => item.table === schema.financeStates)).toBeDefined();
    expect(capture.inserted.find(item => item.table === userPortraits)).toBeDefined();
    expect(capture.inserted.find(item => item.table === constructionDrafts)).toBeDefined();
    expect(capture.inserted.find(item => item.table === schema.guestClaims)).toBeDefined();
    expect(capture.selected()).toBe(17);
  });

  it("refuses to overwrite an account draft and makes no writes", async () => {
    const guest = createInitialState(guestUserId, "2026-10-26T00:00:00.000Z");
    const account = createInitialState(accountUserId, "2026-10-26T01:00:00.000Z");
    const capture = fakeTransaction([
      [{ userId: accountUserId }], [{ userId: guestUserId, state: guest, revision: 0 }], [],
      [{ userId: accountUserId, state: account, revision: 0 }], [], [], [], [{ userId: accountUserId }], [], [],
    ]);
    await expect(claimGuestSave(accountUserId, guestUserId)).rejects.toMatchObject({ status: 409 });
    expect(capture.inserted).toHaveLength(0);
    expect(capture.updated).toHaveLength(0);
  });

  it("refuses to split a running guest job from the save it belongs to", async () => {
    const guest = createInitialState(guestUserId, "2026-10-26T00:00:00.000Z");
    const capture = fakeTransaction([
      [{ userId: accountUserId }], [{ userId: guestUserId, state: guest, revision: 0 }], [],
      [], [], [], [], [], [],
      [{ id: "running-job", status: "running" }],
    ]);
    await expect(claimGuestSave(accountUserId, guestUserId)).rejects.toMatchObject({ status: 409 });
    expect(capture.inserted).toHaveLength(0);
    expect(capture.updated).toHaveLength(0);
  });

  it("copies failed job history without making it retryable", async () => {
    const guest = createInitialState(guestUserId, "2026-10-26T00:00:00.000Z");
    const capture = fakeTransaction([
      [{ userId: accountUserId }], [{ userId: guestUserId, state: guest, revision: 0 }], [],
      [], [], [], [], [], [],
      [{ id: "failed-job", userId: guestUserId, type: "ai.propose", status: "failed", idempotencyKey: "request-2",
        fingerprint: "fingerprint", payload: { prompt: "plan" }, result: null, error: "provider unavailable",
        attempts: 3, maxAttempts: 3, runAt: new Date(), createdAt: new Date(), updatedAt: new Date() }],
      [], [], [], [], [], [], [],
    ]);
    await claimGuestSave(accountUserId, guestUserId);
    const copiedJob = (capture.inserted.find(item => item.table === backgroundJobs)?.value as { id: string; status: string; attempts: number; maxAttempts: number; result: null }[])[0];
    expect(copiedJob).toMatchObject({ status: "failed", attempts: 3, maxAttempts: 3, result: null });
    expect(copiedJob.id).not.toBe("failed-job");
  });

  it("refuses to move a save while a durable command intent is still queued", async () => {
    const guest = createInitialState(guestUserId, "2026-10-26T00:00:00.000Z");
    const capture = fakeTransaction([
      [{ userId: accountUserId }], [{ userId: guestUserId, state: guest, revision: 0 }], [],
      [], [], [], [], [], [], [], [],
      [{ userId: guestUserId, domain: "game", key: "pending", status: "queued" }],
    ]);
    await expect(claimGuestSave(accountUserId, guestUserId)).rejects.toMatchObject({ status: 409 });
    expect(capture.inserted).toHaveLength(0);
    expect(capture.updated).toHaveLength(0);
  });
});

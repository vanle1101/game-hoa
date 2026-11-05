import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "@/server/ai";
import { aiProposals, guestClaims, playerStates } from "@/server/schema";
import { backgroundJobs } from "@/server/jobs-schema";

const mocks = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({ database: mocks.database }));
import { claimJob, completeAiJob, enqueueAiJob, failJob } from "@/server/jobs";

type Job = typeof backgroundJobs.$inferSelect;
type ProposalRow = { id: string; userId: string; proposal: Proposal; status: string };
let state: { job: Job; proposals: ProposalRow[] };
let selectionTime: Date;
let failInsert = false;
const proposal: Proposal = {
  id: "d142dba6-9cd7-4e4d-bb79-34a553d48243",
  createdAt: "2026-10-26T00:00:00.000Z", status: "pending", provider: "demo",
  plan: { title: "Plan", summary: "Summary", tasks: [{ title: "Task", description: "", difficulty: "easy", skill: "knowledge", duration: 15, dueDate: "2026-10-26" }] },
};

function transactionView(snapshot: typeof state) {
  return {
    select: () => ({ from: (table: unknown) => {
      let onlyReady = false;
      const rows = () => {
        if (table !== backgroundJobs) return [];
        const job = snapshot.job;
        const due = job.status === "queued" ? job.runAt <= selectionTime
          : job.status === "running" && !!job.leaseUntil && job.leaseUntil <= selectionTime;
        return !onlyReady || due ? [structuredClone(job)] : [];
      };
      const query = {
        orderBy: () => { onlyReady = true; return query; }, limit: () => query,
        for: async () => rows(),
      };
      return { where: () => query };
    } }),
    update: (table: unknown) => ({ set: (values: Partial<Job>) => ({ where: () => {
      if (table !== backgroundJobs) throw new Error("Unexpected update");
      Object.assign(snapshot.job, values);
      return { then: (resolve: (value: unknown) => void) => Promise.resolve().then(() => resolve(undefined)),
        returning: async () => [structuredClone(snapshot.job)] };
    } }) }),
    insert: (table: unknown) => ({ values: async (values: ProposalRow) => {
      if (table !== aiProposals) throw new Error("Unexpected insert");
      if (failInsert || snapshot.proposals.some(row => row.id === values.id)) throw new Error("Duplicate proposal ID");
      snapshot.proposals.push(structuredClone(values));
    } }),
  };
}

beforeEach(() => {
  selectionTime = new Date("2026-10-26T00:00:00.000Z");
  failInsert = false;
  state = { job: {
    id: "job-id", userId: "owner", type: "ai.propose", status: "queued",
    idempotencyKey: "request-id", fingerprint: "digest", payload: { prompt: "Plan my week" }, result: null,
    error: null, attempts: 0, maxAttempts: 3, runAt: selectionTime, leaseUntil: null,
    lockedBy: null, createdAt: selectionTime, updatedAt: selectionTime,
  }, proposals: [] };
  mocks.database.mockReturnValue({ transaction: async <T,>(fn: (tx: ReturnType<typeof transactionView>) => Promise<T>) => {
    const snapshot = structuredClone(state);
    const result = await fn(transactionView(snapshot));
    state = snapshot;
    return result;
  } });
});

describe("durable AI job transaction control flow (simulated database)", () => {
  it("refuses new work from a guest save after it was claimed", async () => {
    const insert = vi.fn();
    const tx = {
      select: () => ({ from: (table: unknown) => {
        const rows = table === playerStates ? [{ userId: "ab".repeat(32) }]
          : table === guestClaims ? [{ guestUserId: "ab".repeat(32) }] : [];
        return { where: () => ({ for: async () => rows,
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve) }) };
      } }),
      insert,
    };
    mocks.database.mockReturnValue({ transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) });
    await expect(enqueueAiJob("ab".repeat(32), "Plan my week", "d142dba6-9cd7-4e4d-bb79-34a553d48243"))
      .rejects.toMatchObject({ status: 409 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reclaims an expired lease and commits only the current worker's one result", async () => {
    expect((await claimJob("worker-a", selectionTime))?.attempts).toBe(1);
    await failJob("job-id", "worker-a", "temporary outage");
    expect(state.job.status).toBe("queued");
    selectionTime = new Date(state.job.runAt.getTime() + 1);
    expect((await claimJob("worker-b", selectionTime))?.attempts).toBe(2);
    expect(await completeAiJob("job-id", "worker-a", proposal)).toBe(false);
    expect(await completeAiJob("job-id", "worker-b", proposal)).toBe(true);
    expect(await completeAiJob("job-id", "worker-b", proposal)).toBe(false);
    expect(state.job).toMatchObject({ status: "succeeded", result: { proposalId: "job-id" }, lockedBy: null });
    expect(state.proposals).toHaveLength(1);
    expect(state.proposals[0]).toMatchObject({ id: "job-id", userId: "owner", proposal: { id: "job-id" } });
  });

  it("rolls back success if the proposal insert fails", async () => {
    await claimJob("worker-a", selectionTime);
    failInsert = true;
    const before = structuredClone(state);
    await expect(completeAiJob("job-id", "worker-a", proposal)).rejects.toThrow("Duplicate proposal ID");
    expect(state).toEqual(before);
  });

  it("makes the last failed attempt terminal", async () => {
    state.job.status = "running"; state.job.lockedBy = "worker-a"; state.job.attempts = 3;
    await failJob("job-id", "worker-a", "provider unavailable");
    expect(state.job.status).toBe("failed");
    expect(state.job.lockedBy).toBeNull();
    expect(state.proposals).toHaveLength(0);
  });
});

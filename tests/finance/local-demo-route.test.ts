import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyFinance, type FinanceState } from "@/finance";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), isLocalDemo: vi.fn(), readPrivate: vi.fn(), updateFinance: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/identity", () => ({
  requireUser: mocks.requireUser, isLocalDemo: mocks.isLocalDemo,
  checkOrigin: vi.fn(), errorResponse: () => Response.json({ error: "failure" }, { status: 500 }),
  HttpError: class HttpError extends Error {},
}));
vi.mock("@/server/store", () => ({ readPrivate: mocks.readPrivate, updateFinance: mocks.updateFinance }));
vi.mock("@/server/command-intents", () => ({ submitFinanceIntent: vi.fn() }));

import { GET } from "@/app/api/finance/route";

const request = (owner = "local-demo-player") => new Request(`http://127.0.0.1:3333/api/finance?expectedOwnerId=${owner}`);

describe("finance GET demo boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue("local-demo-player");
    mocks.isLocalDemo.mockReturnValue(true);
    mocks.readPrivate.mockResolvedValue(null);
  });

  it("persists sample transactions once and returns the same ledger on repeated reads", async () => {
    let saved: FinanceState | null = null;
    mocks.readPrivate.mockImplementation(async () => saved);
    mocks.updateFinance.mockImplementation(async (_user, fn) => {
      const result = fn(saved);
      saved = result.state;
      return result.result;
    });
    const first = await GET(request());
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Owner-Id")).toBe("local-demo-player");
    const seeded = await first.json() as FinanceState;
    expect(seeded.transactions.length).toBeGreaterThan(0);
    const second = await GET(request());
    expect(await second.json()).toEqual(seeded);
    expect(mocks.updateFinance).toHaveBeenCalledTimes(1);
  });

  it("leaves existing finance data and real production users untouched", async () => {
    const real = emptyFinance();
    real.accounts.push({ id: "real", name: "Real", openingBalance: 100, balance: 100, currency: "VND" });
    mocks.readPrivate.mockResolvedValue(real);
    expect(await (await GET(request())).json()).toEqual(real);
    mocks.isLocalDemo.mockReturnValue(false);
    mocks.readPrivate.mockResolvedValue(null);
    mocks.requireUser.mockResolvedValue("production-user");
    expect(await (await GET(request("production-user"))).json()).toEqual(emptyFinance());
    expect(mocks.updateFinance).not.toHaveBeenCalled();
  });

  it("rejects a stale owner before touching private finance data", async () => {
    const response = await GET(request("someone-else"));
    expect(response.status).toBe(409);
    expect(mocks.readPrivate).not.toHaveBeenCalled();
    expect(mocks.updateFinance).not.toHaveBeenCalled();
  });
});

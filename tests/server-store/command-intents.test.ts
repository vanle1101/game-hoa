import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ gameCommand: vi.fn(), database: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/runtime-mode", () => ({ isLocalDevelopment: () => false }));
vi.mock("@/server/database", () => ({ database: mocks.database }));
vi.mock("@/server/store", () => ({ gameCommand: mocks.gameCommand, readGame: vi.fn(), readPrivate: vi.fn(), updateFinance: vi.fn() }));

import { submitGameIntent } from "@/server/command-intents";

describe("server command intent admission", () => {
  it("does not persist an intent for automatic reconciliation", async () => {
    const result = { state: { userId: "owner", revision: 2 }, events: [], message: "Reconciled" };
    mocks.gameCommand.mockResolvedValue(result);
    expect(await submitGameIntent("owner", "reconcile-key", { type: "reconcile" }, 2)).toEqual({ status: "applied", result });
    expect(mocks.gameCommand).toHaveBeenCalledWith("owner", "reconcile-key", { type: "reconcile" });
    expect(mocks.database).not.toHaveBeenCalled();
  });
});

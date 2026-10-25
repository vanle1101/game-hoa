import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
vi.mock("@/server/identity", () => ({ HttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { createProposal } from "@/server/ai";
const plan = { title: "Learn", summary: "Study gradually", tasks: [{ title: "Read", description: "A chapter", difficulty: "easy", skill: "knowledge", duration: 25, dueDate: "2026-10-16" }] };
type Scenario = { status: number; body?: string; hang?: boolean };
let scenarios: Scenario[];
beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "openai-compatible"); vi.stubEnv("AI_BASE_URL", "https://api.example.com/v1");
  vi.stubEnv("AI_API_KEY", "test-only-credential"); vi.stubEnv("AI_MODEL", "test-model");
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  scenarios = [{ status: 200, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }) }];
  mocks.request.mockReset().mockImplementation((_url: URL, options: { signal: AbortSignal; lookup: (...args: unknown[]) => unknown }, receive: (response: unknown) => void) => {
    const scenario = scenarios.shift() || { status: 500 };
    const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
    request.destroy = () => undefined;
    request.end = () => {
      if (scenario.hang) { options.signal.addEventListener("abort", () => request.emit("error", new Error("Aborted")), { once: true }); return; }
      const response = Object.assign(new PassThrough(), { statusCode: scenario.status });
      receive(response); response.end(scenario.body || "provider-internal-secret");
    };
    return request;
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("remote AI contract", () => {
  it("validates a remote plan and pins the previously checked DNS address", async () => {
    const proposal = await createProposal("Learn more");
    expect(proposal.plan).toEqual(plan); expect(proposal.provider).toBe("openai-compatible");
    const options = mocks.request.mock.calls[0][1];
    const callback = vi.fn(); options.lookup("api.example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });
  it("refuses mixed public/private DNS records before credentials can be sent", async () => {
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(createProposal("Learn more")).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("retries a transient failure once and returns a validated proposal", async () => {
    scenarios.unshift({ status: 503 });
    expect((await createProposal("Learn more")).plan).toEqual(plan);
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it("never retries authentication errors or reflects provider response bodies", async () => {
    scenarios = [{ status: 401, body: "provider-internal-secret" }];
    await expect(createProposal("Learn more")).rejects.toThrow("Nhà cung cấp từ chối xác thực AI.");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("rejects schema-breaking responses instead of applying or replacing them with demo data", async () => {
    scenarios = [{ status: 200, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...plan, gold: 1000 }) } }] }) }];
    await expect(createProposal("Learn more")).rejects.toThrow("Kế hoạch AI không đáp ứng");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("aborts a hanging request at the bounded deadline", async () => {
    vi.useFakeTimers(); scenarios = [{ status: 200, hang: true }];
    const result = createProposal("Learn more");
    const assertion = expect(result).rejects.toThrow("AI phản hồi quá chậm");
    await vi.advanceTimersByTimeAsync(15_000); await assertion;
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});

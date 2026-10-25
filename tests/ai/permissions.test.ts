import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/identity", () => ({ HttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { aiRequestSchema, createProposal, isPublicAddress, planSchema, proposalAction, providerStatus, validatedEndpoint } from "@/server/ai";

const task = { title: "Study", description: "Review one chapter", difficulty: "easy", skill: "knowledge", duration: 25, dueDate: "2026-10-16" };
const plan = { title: "Learning", summary: "A small plan", tasks: [task] };
const proposal = { id: "d142dba6-9cd7-4e4d-bb79-34a553d48243", createdAt: "2026-10-15T10:00:00.000Z", status: "pending", provider: "demo", plan };

afterEach(() => vi.unstubAllEnvs());
describe("AI planning permissions", () => {
  it("accepts the narrow plan schema", () => expect(planSchema.safeParse(plan).success).toBe(true));
  it.each(["gold", "xp", "committed", "bossDamage", "finance", "operations"])("rejects injected %s operation", field => {
    expect(planSchema.safeParse({ ...plan, [field]: 100 }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, tasks: [{ ...task, [field]: 100 }] }).success).toBe(false);
  });
  it("rejects impossible calendar dates and oversized tasks", () => {
    expect(planSchema.safeParse({ ...plan, tasks: [{ ...task, dueDate: "2026-02-30" }] }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, tasks: Array.from({ length: 13 }, () => task) }).success).toBe(false);
  });
  it("approval only creates uncommitted campaign tasks", () => {
    const action = proposalAction(proposal);
    expect(action.type).toBe("campaign.create");
    if (action.type === "campaign.create") expect(action.tasks.every(item => item.committed === false && item.kind === "campaign")).toBe(true);
  });
  it("cannot approve a rejected or modified proposal", () => {
    expect(() => proposalAction({ ...proposal, status: "rejected" })).toThrow();
    expect(() => proposalAction({ ...proposal, plan: { ...plan, gold: 100 } })).toThrow();
  });
  it("approval request cannot carry replacement model content or finance data", () => {
    expect(aiRequestSchema.safeParse({ mode: "approve", id: proposal.id, plan }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ mode: "propose", prompt: "Plan my week", finance: {} }).success).toBe(false);
  });
  it("demo requires explicit configuration and cannot operate in production", async () => {
    vi.stubEnv("AI_PROVIDER", "demo"); vi.stubEnv("NODE_ENV", "production");
    expect(providerStatus().configured).toBe(false);
    await expect(createProposal("Plan my week")).rejects.toThrow();
  });
  it("explicit local demo remains clearly labeled", async () => {
    vi.stubEnv("AI_PROVIDER", "demo"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
    const result = await createProposal("Learn a language");
    expect(result.provider).toBe("demo"); expect(result.status).toBe("pending"); expect(result.plan.tasks).toHaveLength(2);
  });
});

describe("AI endpoint validation", () => {
  it.each(["http://example.com/v1", "https://localhost/v1", "https://127.0.0.1/v1", "https://[::1]/v1", "https://service.local/v1", "https://user:password@example.com/v1", "https://example.com:8080/v1", "https://example.com/v1?key=private"])("rejects unsafe endpoint %s", endpoint => {
    expect(() => validatedEndpoint(endpoint)).toThrow();
  });
  it("appends only the supported protocol route", () => {
    expect(validatedEndpoint("https://api.example.com/v1/").href).toBe("https://api.example.com/v1/chat/completions");
  });
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.2", "172.16.0.1", "100.64.0.1", "::1", "fc00::1", "::ffff:127.0.0.1", "fe80::1"])("rejects nonpublic resolution %s", address => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateLegacyPortrait, readServerPortrait } from "./portrait-client";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ";
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe("server portrait migration", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("rejects a response for a different appearance key", async () => {
    const transport = vi.fn(async () => Response.json({ ownerId: "owner", key: "other", dataUrl: image })) as unknown as typeof fetch;
    await expect(readServerPortrait("owner", "current", transport)).rejects.toThrow("không hợp lệ");
  });

  it("rejects a response from a previous account session", async () => {
    const transport = vi.fn(async () => Response.json({ ownerId: "other-owner", key: "current", dataUrl: image })) as unknown as typeof fetch;
    await expect(readServerPortrait("owner", "current", transport)).rejects.toThrow("không hợp lệ");
  });

  it("keeps the old browser copy until the server acknowledges it", async () => {
    const local = storage();
    local.setItem("lifelevel-portrait:owner:look", image);
    vi.stubGlobal("localStorage", local);
    const failed = vi.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    await expect(migrateLegacyPortrait("owner", "look", failed)).rejects.toThrow("Không thể lưu");
    expect(local.getItem("lifelevel-portrait:owner:look")).toBe(image);

    const accepted = vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch;
    await expect(migrateLegacyPortrait("owner", "look", accepted)).resolves.toBe(image);
    expect(local.getItem("lifelevel-portrait:owner:look")).toBeNull();
  });
});

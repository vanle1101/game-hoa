import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const code = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  runInNewContext(code, { self: { location: { origin: "https://life.test" }, addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; } }, URL });
  return handlers;
}
describe("PWA private response isolation", () => {
  it.each(["/api/game", "/api/finance", "/api/backup", "/api/auth/session", "/api/ai"])("never intercepts or caches %s", path => {
    const handlers = worker(); let intercepted = false;
    handlers.fetch({ request: new Request(`https://life.test${path}`), respondWith: () => { intercepted = true; } });
    expect(intercepted).toBe(false);
  });
  it("never intercepts mutations, external resources or RSC payloads", () => {
    const handlers = worker(); let intercepted = 0;
    for (const request of [new Request("https://life.test/action", { method: "POST" }), new Request("https://foreign.test/icon.svg"), new Request("https://life.test/?_rsc=private"), new Request("https://life.test/", { headers: { RSC: "1" } })]) handlers.fetch({ request, respondWith: () => { intercepted++; } });
    expect(intercepted).toBe(0);
  });
});

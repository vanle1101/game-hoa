import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["**/*.{test,spec}.{ts,tsx}"], exclude: ["node_modules/**", ".next/**", "e2e/**", "tests/e2e/**"] },
});

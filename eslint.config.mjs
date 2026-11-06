import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", ".next-verify/**", ".next-playwright/**", ".tmp/**", "out/**", "coverage/**", ".local-data/**", ".vercel/**", "dist-worker/**", "tmp/**", "next-env.d.ts", ".tmp-chrome-v21*/**"]),
  { files: ["desktop/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
]);

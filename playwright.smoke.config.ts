import { defineConfig } from "@playwright/test";
import fullConfig from "./playwright.config";

export default defineConfig({
  ...fullConfig,
  testMatch: ["**/smoke.spec.ts"],
  projects: [
    {
      name: "desktop-chromium-smoke",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 1,
      },
    },
  ],
});

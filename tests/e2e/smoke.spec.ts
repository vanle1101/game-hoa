import { expect, test } from "@playwright/test";

test("isolated Next runtime serves the app shell and real local game read", async ({ page, request }) => {
  const health = await request.get("/api/health/live");
  expect(health.ok()).toBe(true);

  const gameResponse = await request.get("/api/game");
  expect(gameResponse.ok()).toBe(true);
  const game = await gameResponse.json() as { mode: string; state: { userId: string } };
  expect(game.mode).toBe("local");
  expect(typeof game.state.userId).toBe("string");

  await page.goto("/");
  await expect(page.locator(".game-shell")).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Một chương mới. Một nơi thuộc về bạn." })).toBeVisible();
});

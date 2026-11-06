import { expect, test } from "@playwright/test";
import type { GameState } from "../../src/domain/types";

test("local save restores an active focus session after reload and cancels without rewards", async ({ page, request }, info) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");

  const closeWelcome = page.getByRole("button", { name: "Để sau", exact: true });
  await expect(closeWelcome).toBeVisible();
  await closeWelcome.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const openFocus = page.getByRole("button", { name: "Mở bộ tập trung" });
  await openFocus.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Tập trung từng việc một" })).toBeVisible();
  await expect(page.getByLabel("Nhiệm vụ cho phiên tập trung")).toBeVisible();

  const start = page.getByRole("button", { name: /Bắt đầu phiên \d+ phút/ });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByText("ĐANG TẬP TRUNG · ĐÃ LƯU")).toBeVisible();
  const runningScreenshot = info.outputPath("focus-session-running.png");
  await page.screenshot({ path: runningScreenshot, fullPage: true });

  const beforeReload = await (await request.get("/api/game", { headers: { "Cache-Control": "no-store" } })).json() as { mode: string; state: GameState };
  const runningSession = beforeReload.state.focusSessions?.find(session => session.status === "running");
  expect(beforeReload.mode).toBe("local");
  expect(runningSession?.plannedMinutes).toBeGreaterThan(0);
  const selectedOccurrence = beforeReload.state.occurrences.find(occurrence => occurrence.id === runningSession?.occurrenceId);
  expect(selectedOccurrence?.status).toBe("open");

  await page.reload();
  await page.getByRole("button", { name: "Mở phiên tập trung đang lưu" }).click();
  await expect(page.getByText("ĐANG TẬP TRUNG · ĐÃ LƯU")).toBeVisible();
  await expect(page.getByText(beforeReload.state.tasks.find(task => task.id === selectedOccurrence?.taskId)!.title, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hủy phiên, không thưởng" }).click();
  await page.getByRole("alertdialog", { name: "Xác nhận hủy phiên" }).getByRole("button", { name: "Hủy phiên", exact: true }).click();
  await expect(page.getByRole("button", { name: /Bắt đầu phiên \d+ phút/ })).toBeVisible();
  const afterCancel = await (await request.get("/api/game", { headers: { "Cache-Control": "no-store" } })).json() as { state: GameState };
  expect(afterCancel.state.focusSessions?.find(session => session.id === runningSession?.id)?.status).toBe("canceled");
  expect(afterCancel.state.occurrences.find(occurrence => occurrence.id === runningSession?.occurrenceId)?.status).toBe("open");
  expect(afterCancel.state.character.xp).toBe(0);
  expect(afterCancel.state.gold).toBe(0);
  expect(pageErrors).toEqual([]);
  await info.attach("focus-session-persistence.json", { body: JSON.stringify({ beforeReload: { mode: beforeReload.mode, revision: beforeReload.state.revision, session: runningSession }, afterCancel: { revision: afterCancel.state.revision, session: afterCancel.state.focusSessions?.find(session => session.id === runningSession?.id), occurrence: afterCancel.state.occurrences.find(occurrence => occurrence.id === runningSession?.occurrenceId)?.status, xp: afterCancel.state.character.xp, gold: afterCancel.state.gold }, pageErrors }, null, 2), contentType: "application/json" });
});

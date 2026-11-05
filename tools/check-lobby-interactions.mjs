import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem("lifelevel-entered", "true"));
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3336/", { waitUntil: "networkidle" });
  await page.locator(".vref-lobby").waitFor();

  await page.getByRole("button", { name: "Vật phẩm" }).click();
  const itemCount = await page.locator(".vref-reward-grid button").count();
  await page.getByRole("button", { name: "Đời sống" }).click();
  const lifeCount = await page.locator(".vref-reward-grid button").count();
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  const allCount = await page.locator(".vref-reward-grid button").count();
  await page.getByRole("textbox", { name: "Tìm trong sảnh chờ" }).fill("Căn hộ");
  const searchResults = await page.locator(".vref-search-results button").allTextContents();

  await page.locator(".vref-apartment-actions button").click();
  await page.locator(".world-main canvas").waitFor({ timeout: 30000 });
  const home = await page.evaluate(() => ({
    canvas: document.querySelectorAll(".world-main canvas").length,
    loading: document.body.textContent?.includes("Đang khởi tạo WebGL") ?? false,
    heading: document.querySelector(".world-heading h1")?.textContent,
  }));
  console.log(JSON.stringify({ itemCount, lifeCount, allCount, searchResults, home, errors }));
  if (errors.length || home.canvas < 1 || home.loading || itemCount !== 4 || lifeCount !== 2 || allCount !== 6) process.exitCode = 1;
} finally {
  await browser.close();
}

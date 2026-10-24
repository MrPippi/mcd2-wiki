import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("changelog", () => {
  test("lists updates newest first with kind tags and links to the pages", async ({ page }) => {
    await page.goto("/zh/changelog/");
    await expect(page.locator("h1")).toContainText("更新日誌");
    const entries = page.locator(".changelog-entry");
    const dates = await entries.locator("time").evaluateAll((times) => times.map((time) => time.getAttribute("datetime") ?? ""));
    expect(dates.length).toBeGreaterThan(1);
    expect([...dates].sort().reverse()).toEqual(dates);
    const soul = page.locator(".changelog-change a", { hasText: "新增靈魂附魔頁" });
    await expect(soul).toHaveAttribute("href", "/zh/soul-enchantments/");
    await expect(page.locator(".changelog-kind.is-new").first()).toHaveText("新增");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("shows English change text, marked as English, on other languages", async ({ page }) => {
    await page.goto("/ja/changelog/");
    await expect(page.locator("h1")).toContainText("更新履歴");
    const text = page.locator(".changelog-text").first();
    await expect(text).toHaveAttribute("lang", "en");
    await expect(page.locator(".changelog-kind").first()).toHaveText(/新規|改善|修正/);
  });

  test("is linked from the footer", async ({ page }) => {
    await page.goto("/en/");
    await page.getByTestId("footer-changelog").click();
    await expect(page).toHaveURL(/\/en\/changelog\/$/);
  });
});

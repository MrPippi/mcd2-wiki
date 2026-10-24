import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("game update log", () => {
  test("lists game versions newest first with official notes, kind tags and links", async ({ page }) => {
    await page.goto("/zh/changelog/");
    await expect(page.locator("h1")).toContainText("更新日誌");
    const updates = page.getByTestId("game-update");
    const dates = await updates.locator("time").evaluateAll((times) => times.map((time) => time.getAttribute("datetime") ?? ""));
    expect(dates.length).toBeGreaterThan(1);
    expect([...dates].sort().reverse()).toEqual(dates);
    const latest = updates.first();
    await expect(latest.getByTestId("official-notes")).toHaveAttribute("href", /^https:\/\/feedback\.minecraft\.net\//);
    await expect(latest.locator(".changelog-change a", { hasText: "伏聆者之怒" })).toHaveAttribute("href", "/zh/quests/ca09/");
    await expect(latest.locator(".changelog-kind.is-fixed").first()).toHaveText("修正");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("marks the version the site's data comes from and the versions after it", async ({ page }) => {
    await page.goto("/en/changelog/");
    const current = page.getByTestId("site-data-version");
    await expect(current).toHaveCount(1);
    const version = await current.locator("xpath=ancestor::li[@data-testid='game-update']").getAttribute("data-version");
    expect(version).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    const ahead = page.getByTestId("data-not-yet");
    if ((await ahead.count()) > 0) await expect(ahead.first()).toContainText(`still from ${version}`);
  });

  test("shows English change text, marked as English, on other languages", async ({ page }) => {
    await page.goto("/ja/changelog/");
    await expect(page.locator("h1")).toContainText("更新履歴");
    await expect(page.locator(".changelog-text").first()).toHaveAttribute("lang", "en");
  });

  test("is linked from the footer", async ({ page }) => {
    await page.goto("/en/");
    await page.getByTestId("footer-changelog").click();
    await expect(page).toHaveURL(/\/en\/changelog\/$/);
  });
});

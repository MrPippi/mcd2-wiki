import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

const card = (page: Page, slug: string) => page.locator(`[data-testid="soul-enchantment"][data-slug="${slug}"]`);

test.describe("soul enchantments", () => {
  test("lists the twelve families with their game names, icons and a column per tier", async ({ page }) => {
    await page.goto("/zh/soul-enchantments/");
    await expect(page.locator("h1")).toContainText("靈魂附魔");
    await expect(page.getByTestId("soul-enchantment")).toHaveCount(12);
    const health = card(page, "health");
    await expect(health.locator("h2 .primary")).toHaveText("背水一戰");
    await expect(health.locator("h2 .alt")).toHaveText("Persistence");
    await expect(health.locator("thead th")).toHaveText(["效果", "I", "II", "III"]);
    await expect(health.locator('tr[data-row="attr:healthMax:multiply"] td')).toHaveText(["×1.2", "×1.4", "×1.6"]);
    await expect(health.locator('tr[data-row="threat"] td')).toHaveText(["3–20", "0–20", "0–20"]);
    const icon = health.locator("img.soul-ench-icon");
    await expect(icon).toHaveAttribute("src", /\/icons\/soul-enchantments\/health\.png$/);
    await icon.scrollIntoViewIfNeeded();
    await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });

  test("shows the unconfirmed note, ability values in units, and links excluded mobs and quests", async ({ page }) => {
    await page.goto("/en/soul-enchantments/");
    await expect(page.getByTestId("guide-unconfirmed")).toContainText("Not yet confirmed in game");
    await expect(card(page, "soul-orbs").locator('tr[data-row="ability:orbRange"] td').first()).toHaveText("7.5 blocks");
    await expect(card(page, "speed").locator('tr[data-row="ability:swiftnessChance"] td')).toHaveText(["100%", "40%", "50%"]);
    const ranged = card(page, "ranged").getByTestId("soul-excluded-mobs");
    await expect(ranged.locator("a", { hasText: "Geomancer" })).toHaveAttribute("href", "/en/mobs/geomancer/");
    await expect(ranged).toContainText("Zombie (some variants)");
    await expect(card(page, "poison").getByTestId("soul-excluded-quests").locator("a")).toHaveAttribute("href", "/en/quests/ca04/");
  });

  test("the menu opens the page after the Soul Storms, and a Soul Corrupted mob links to it", async ({ page }) => {
    await page.goto("/en/mobs/zombie/");
    const link = page.getByTestId("mob-soul-enchantments").locator("a");
    await expect(link).toHaveText("Soul Enchantments");
    await link.click();
    await expect(page).toHaveURL(/\/en\/soul-enchantments\/$/);
    await page.getByTestId("site-menu").click();
    const items = page.locator(".site-menu a");
    const labels = await items.allTextContents();
    expect(labels.indexOf("Soul Enchantments")).toBe(labels.indexOf("Soul Storms") + 1);
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("Soul Enchantments");
  });

  test("fits a phone screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const lang of ["zh", "de", "ru"]) {
      await page.goto(`/${lang}/soul-enchantments/`);
      expect(await horizontalOverflow(page), lang).toBeLessThanOrEqual(0);
    }
  });
});

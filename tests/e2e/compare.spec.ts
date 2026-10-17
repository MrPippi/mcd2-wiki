import { expect, test, type Page } from "@playwright/test";

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const table = (page: Page) => page.getByTestId("compare-table");
const column = (page: Page, n: number) => page.getByTestId(`compare-pick-${n}`);
const pick = async (page: Page, n: number, slug: string) => {
  await column(page, n).locator("[data-pick-open]").click();
  await page.getByTestId("compare-options").locator(`[data-slug="${slug}"]`).click();
};

test.describe("weapon compare", () => {
  test("starts empty with three pickers", async ({ page }) => {
    await page.goto("/en/compare/");
    await expect(page.getByTestId("weapon-compare")).toBeVisible();
    await expect(page.getByTestId("compare-empty")).toBeVisible();
    await expect(table(page)).toBeHidden();
    await expect(page.locator("[data-pick]")).toHaveCount(3);
  });

  test("picking weapons fills the table and the address", async ({ page }) => {
    await page.goto("/en/compare/");
    await pick(page, 1, "axe");
    await pick(page, 2, "battlestaff");
    await expect(table(page).locator("thead")).toContainText("Axe");
    await expect(table(page).locator("thead")).toContainText("Battlestaff");
    await expect(page).toHaveURL(/\/en\/compare\/\?w=axe,battlestaff$/);
    await expect(table(page).locator("tbody th", { hasText: "Full combo" })).toHaveCount(1);
  });

  test("packs picks to the left and clears a column", async ({ page }) => {
    await page.goto("/en/compare/");
    await pick(page, 3, "axe");
    await expect(column(page, 1)).toHaveAttribute("data-slug", "axe");
    await expect(column(page, 3)).toHaveAttribute("data-slug", "");
    await pick(page, 2, "bow");
    await column(page, 1).locator("[data-clear]").click();
    await expect(column(page, 1)).toHaveAttribute("data-slug", "bow");
    await expect(page).toHaveURL(/\/en\/compare\/\?w=bow$/);
  });

  test("the picker shows icons, filters by name and blocks a weapon already picked", async ({ page }) => {
    await page.goto("/en/compare/?w=axe");
    await expect(column(page, 1).locator("[data-icon] img")).toBeVisible();
    await column(page, 2).locator("[data-pick-open]").click();
    const options = page.getByTestId("compare-options");
    await expect(page.getByTestId("compare-dialog")).toBeVisible();
    await expect(options.locator("[data-slug='axe']")).toBeDisabled();
    await expect(options.locator("[data-slug='bow'] img")).toBeVisible();
    await page.getByTestId("compare-filter").fill("crossb");
    await expect(options.locator("[data-slug='bow']")).toHaveCount(0);
    await expect(options.locator("[data-slug='crossbow']")).toBeVisible();
    await page.getByTestId("compare-dialog").locator("[data-close]").click();
    await expect(page.getByTestId("compare-dialog")).toBeHidden();
    await expect(column(page, 2).locator("[data-pick-open]")).toBeFocused();
  });

  test("highlights the best value in a ranked row", async ({ page }) => {
    await page.goto("/en/compare/?w=axe,battlestaff");
    const row = table(page).locator("tbody tr", { has: page.locator("th", { hasText: "Full combo" }) });
    await expect(row.locator("td[data-best='true']")).toHaveCount(1);
    await expect(row.locator("td[data-best='true'] .sr-only")).toHaveText(" (Best)");
  });

  test("a shared link restores the columns and mixes melee and ranged", async ({ page }) => {
    await page.goto("/en/compare/?w=axe,bow");
    await expect(column(page, 1)).toHaveAttribute("data-slug", "axe");
    await expect(column(page, 2)).toHaveAttribute("data-slug", "bow");
    const shots = table(page).locator("tbody tr", { has: page.locator("th", { hasText: "Shots per second" }) });
    await expect(shots.locator("td").first()).toHaveText("—");
  });

  test("lists the effects each weapon can roll and a unique weapon's built-in bonus", async ({ page }) => {
    await page.goto("/en/compare/?w=sword-unique1,axe");
    await expect(table(page).locator("tbody tr", { has: page.locator("th", { hasText: "Built in" }) })).toContainText("Pyromancer");
    await expect(table(page).locator("tbody tr", { has: page.locator("th", { hasText: "Effects it can roll" }) }).locator("li").first()).toBeVisible();
  });

  test("drops unknown and repeated weapons from a link and says so", async ({ page }) => {
    await page.goto("/en/compare/?w=axe,dragon,axe");
    await expect(page).toHaveURL(/\/en\/compare\/\?w=axe$/);
    await expect(page.getByTestId("compare-notice")).toHaveText("Weapons left out (unknown, repeated or more than 3): 2");
  });

  test("the language links keep the comparison", async ({ page }) => {
    await page.goto("/en/compare/");
    await pick(page, 1, "axe");
    await expect(page.locator('a[data-lang="ja"]').first()).toHaveAttribute("href", /\/ja\/compare\/\?w=axe$/);
  });

  test("copies the link", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/en/compare/?w=axe");
    await page.getByTestId("compare-copy").click();
    await expect(page.getByTestId("compare-status")).toHaveText("Link copied.");
  });

  for (const lang of ["zh", "de", "ru"]) {
    test(`does not scroll the page sideways at 412px (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await page.goto(`/${lang}/compare/?w=sword-unique1,crossbow,battlestaff`);
      await expect(table(page)).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("explains the comparison needs JavaScript", async ({ page }) => {
    await page.goto("/en/compare/");
    await expect(page.getByTestId("compare-noscript")).toBeVisible();
    await expect(page.getByTestId("weapon-compare")).toBeHidden();
  });
});

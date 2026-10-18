import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

const GUIDE_SLUGS = ["vendors", "enchanting", "rarity", "threat", "secret-talismans", "progression"] as const;

test.describe("guides hub", () => {
  test("lists the six guides and every card opens its guide, which links back", async ({ page }) => {
    await page.goto("/en/guides/");
    const cards = page.getByTestId("guide-card");
    await expect(cards).toHaveCount(GUIDE_SLUGS.length);
    for (const [index, slug] of GUIDE_SLUGS.entries()) {
      await page.goto("/en/guides/");
      await page.getByTestId("guide-card").nth(index).locator("a").click();
      await expect(page).toHaveURL(new RegExp(`/en/guides/${slug}/$`));
      await expect(page.locator("h1")).toBeVisible();
      await page.getByTestId("guide-back").click();
      await expect(page).toHaveURL(/\/en\/guides\/$/);
    }
  });

  test("the menu lists the guides after the drop calculator and marks the hub on its page", async ({ page }) => {
    await page.goto("/zh/guides/");
    await page.getByTestId("site-menu").click();
    const links = page.locator(".site-menu a");
    const texts = await links.allTextContents();
    expect(texts.indexOf("攻略")).toBe(texts.indexOf("掉落機率計算器") + 1);
    await expect(links.filter({ hasText: "攻略" })).toHaveAttribute("href", "/zh/guides/");
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("攻略");
  });
});

test.describe("guide content", () => {
  test("vendors shows three vendors and their Echo Shard costs", async ({ page }) => {
    await page.goto("/en/guides/vendors/");
    await expect(page.getByTestId("guide-vendor")).toHaveCount(3);
    await expect(page.getByTestId("guide-vendor-level")).toHaveCount(6);
    await expect(page.getByTestId("guide-vendors")).toContainText("Upgrades are paid in Echo Shards.");
  });

  test("secret talisman cards open the talisman pages", async ({ page }) => {
    await page.goto("/en/guides/secret-talismans/");
    await expect(page.getByTestId("guide-talisman")).toHaveCount(8);
    await page.getByTestId("guide-talisman").first().locator("a.item-link").click();
    await expect(page).toHaveURL(/\/en\/talisman\/[a-z-]+\/$/);
  });

  test("the unconfirmed tag shows only where the data cannot say how a number applies", async ({ page }) => {
    for (const [slug, expected] of [["vendors", 0], ["enchanting", 1], ["rarity", 1], ["secret-talismans", 0], ["progression", 0]] as const) {
      await page.goto(`/zh/guides/${slug}/`);
      await expect(page.getByTestId("guide-unconfirmed"), slug).toHaveCount(expected);
    }
  });
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 412, height: 915 } });
  for (const lang of ["zh", "de", "ru"] as const) {
    test(`no guide scrolls sideways at 412px (${lang})`, async ({ page }) => {
      for (const path of ["", ...GUIDE_SLUGS.map((slug) => `${slug}/`)]) {
        await page.goto(`/${lang}/guides/${path}`);
        expect(await horizontalOverflow(page), `${lang}/guides/${path}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

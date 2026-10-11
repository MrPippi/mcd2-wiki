import { expect, test, type Page } from "@playwright/test";

const siteMenu = (page: Page) => page.locator(".site-menu");
const langPicker = (page: Page) => page.locator(".lang-picker");

const openSiteMenu = async (page: Page) => {
  await page.getByTestId("site-menu").click();
  await expect(siteMenu(page)).toHaveAttribute("open", "");
};

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("header menu", () => {
  test("lists the map and the achievements in the page language", async ({ page }) => {
    await page.goto("/zh/melee/");
    await expect(page.getByTestId("site-menu")).toHaveAttribute("aria-label", "選單");
    await openSiteMenu(page);
    const links = siteMenu(page).locator("a");
    await expect(links).toHaveText(["地圖", "成就"]);
    await expect(links.nth(0)).toHaveAttribute("href", "/zh/map/");
    await expect(links.nth(1)).toHaveAttribute("href", "/zh/achievements/");
    await expect(siteMenu(page).locator("[aria-current='page']")).toHaveCount(0);
    await links.nth(1).click();
    await expect(page).toHaveURL(/\/zh\/achievements\/$/);
  });

  test("marks the current page and speaks the language of the page", async ({ page }) => {
    await page.goto("/ja/achievements/");
    await openSiteMenu(page);
    await expect(siteMenu(page).locator("a")).toHaveText(["マップ", "実績"]);
    await expect(siteMenu(page).locator("[aria-current='page']")).toHaveText("実績");
    await page.goto("/ja/map/");
    await openSiteMenu(page);
    await expect(siteMenu(page).locator("[aria-current='page']")).toHaveText("マップ");
  });

  test("closes on Esc, returning focus, and on an outside click", async ({ page }) => {
    await page.goto("/en/melee/");
    await openSiteMenu(page);
    await page.keyboard.press("Escape");
    await expect(siteMenu(page)).not.toHaveAttribute("open", "");
    await expect(page.getByTestId("site-menu")).toBeFocused();
    await openSiteMenu(page);
    await page.locator("h1").first().click();
    await expect(siteMenu(page)).not.toHaveAttribute("open", "");
  });

  test("keeps only one of the language menu and the site menu open", async ({ page }) => {
    await page.goto("/zh/");
    await page.getByTestId("lang-switch").click();
    await expect(langPicker(page)).toHaveAttribute("open", "");
    await openSiteMenu(page);
    await expect(langPicker(page)).not.toHaveAttribute("open", "");
    await page.getByTestId("lang-switch").click();
    await expect(langPicker(page)).toHaveAttribute("open", "");
    await expect(siteMenu(page)).not.toHaveAttribute("open", "");
  });

  test("stays inside a 360px screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/uk/melee/");
    await openSiteMenu(page);
    const box = await siteMenu(page).locator("ul").boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(360);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("opens as a details element and its links work", async ({ page }) => {
      await page.goto("/de/melee/");
      await page.getByTestId("site-menu").click();
      await siteMenu(page).locator("a", { hasText: "Erfolge" }).click();
      await expect(page).toHaveURL(/\/de\/achievements\/$/);
    });
  });
});

test("the home page's category list no longer includes the map", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator(".category-grid a[href$='/map/']")).toHaveCount(0);
  await expect(page.locator(".category-grid")).not.toContainText("世界地圖");
});

test.describe("achievements page", () => {
  test("lists all 32 Steam achievements by unlock rate, with icons, rates and hidden labels", async ({ page }) => {
    await page.goto("/zh/achievements/");
    await expect(page).toHaveTitle(/^成就 \| /);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
    await expect(page.locator("h1")).toContainText("成就");
    await expect(page.locator(".catalog-alt")).toHaveText("Achievements");
    const cards = page.locator(".achievement-card");
    await expect(cards).toHaveCount(32);
    const first = cards.first();
    await expect(first.locator(".achievement-name .primary")).toHaveText("家當在哪裡，家就在哪裡");
    await expect(first.locator(".achievement-name .alt")).toHaveText("Home is Where Your Stuff Is");
    await expect(first.locator(".achievement-rate-value")).toHaveText("91.9%");
    const rates = await cards.evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-rate"))));
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    await expect(page.locator(".achievement-hidden")).toHaveCount(19);
    await expect(page.locator(".achievement-hidden").first()).toHaveText("隱藏成就");
    await expect(page.locator(".achievement-card .tag.warn")).toHaveCount(0);
    await expect(page.locator(".achievements-credit")).toContainText("1912410");
    await expect(page.locator(".achievements-credit")).toContainText("© Mojang Studios");
  });

  test("shows a described achievement with its description", async ({ page }) => {
    await page.goto("/zh/achievements/");
    const card = page.locator("#equip-a-unique-item");
    await expect(card.locator(".achievement-desc .primary")).toHaveText("裝備一件獨特物品");
    await expect(card.locator(".achievement-desc .alt")).toHaveText("Equip a unique item");
  });

  test("loads every icon", async ({ page }) => {
    await page.goto("/zh/achievements/");
    const icons = page.locator(".achievement-icon");
    await expect(icons).toHaveCount(32);
    for (const icon of await icons.all()) await icon.scrollIntoViewIfNeeded();
    await expect.poll(() => icons.evaluateAll((nodes) => nodes.filter((node) => node instanceof HTMLImageElement && node.naturalWidth > 0).length)).toBe(32);
  });

  test("marks the English stand-in text on languages Steam does not cover", async ({ page }) => {
    await page.goto("/ja/achievements/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page).toHaveTitle(/^実績 \| /);
    await expect(page.locator("h1")).toContainText("実績");
    await expect(page.locator(".achievement-card").first().locator(".achievement-name .primary")).toHaveText("Home is Where Your Stuff Is");
    await expect(page.locator(".achievement-card .tag.warn")).toHaveCount(32);
    await expect(page.locator(".achievement-card .tag.warn").first()).toHaveText("未翻訳");
    await expect(page.locator(".achievement-hidden").first()).toHaveText("隠し実績");
  });

  test("compares English with Traditional Chinese", async ({ page }) => {
    await page.goto("/en/achievements/");
    await expect(page.locator(".achievement-card").first().locator(".achievement-name .alt")).toHaveText("家當在哪裡，家就在哪裡");
    await expect(page.locator(".achievement-card .tag.warn")).toHaveCount(0);
  });

  test("writes the rate the way the language writes percentages", async ({ page }) => {
    await page.goto("/tr/achievements/");
    await expect(page.locator(".achievement-card").first().locator(".achievement-rate-value")).toHaveText("%91,9");
  });

  test("lists 16 language alternates and switches language on the same page", async ({ page }) => {
    await page.goto("/zh/achievements/");
    await expect(page.locator("link[rel='alternate'][hreflang]")).toHaveCount(17);
    await expect(page.locator("link[hreflang='ko']")).toHaveAttribute("href", /\/ko\/achievements\/$/);
    await page.getByTestId("lang-switch").click();
    await page.locator(".lang-picker a", { hasText: "Français" }).click();
    await expect(page).toHaveURL(/\/fr\/achievements\/$/);
    await expect(page.locator("h1")).toContainText("Succès");
  });

  test("has no horizontal scroll on a narrow phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/ru/achievements/");
    await expect(page.locator("h1")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

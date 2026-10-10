import { expect, test, type Page } from "@playwright/test";

const openMenu = async (page: Page) => {
  await page.getByTestId("lang-switch").click();
  await expect(page.locator(".lang-picker")).toHaveAttribute("open", "");
};

const chooseLang = async (page: Page, nativeName: string) => {
  await openMenu(page);
  await page.locator(".lang-picker a", { hasText: nativeName }).click();
};

test("the menu switches language and keeps the entry", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await chooseLang(page, "日本語");
  await expect(page).toHaveURL(/\/ja\/melee\/sword\/$/);
  await expect(page.locator("h1 .primary")).toHaveText("剣");
});

test("the menu keeps the map query and hash", async ({ page }) => {
  await page.goto("/zh/map/?world=sift#3/3000/5000");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "3");
  await chooseLang(page, "Deutsch");
  await expect(page).toHaveURL(/\/de\/map\/\?world=sift#3\/\d+\/\d+$/);
});

test("the menu lists 16 languages, marks the current one and closes on Esc and outside clicks", async ({ page }) => {
  await page.goto("/ko/melee/");
  await openMenu(page);
  await expect(page.locator(".lang-picker a")).toHaveCount(16);
  await expect(page.locator(".lang-picker a[aria-current='true']")).toHaveText("한국어");
  await page.keyboard.press("Escape");
  await expect(page.locator(".lang-picker")).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("lang-switch")).toBeFocused();
  await openMenu(page);
  await page.locator("h1").first().click();
  await expect(page.locator(".lang-picker")).not.toHaveAttribute("open", "");
});

test("the root opens the language chosen last", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await chooseLang(page, "Français");
  await expect(page).toHaveURL(/\/fr\//);
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr\/$/);
});

test.describe("browser language", () => {
  test.use({ locale: "ja-JP" });
  test("sends the root to the matching language", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ja\/$/);
  });
});

test.describe("unsupported browser language", () => {
  test.use({ locale: "xx-YY" });
  test("sends the root to Traditional Chinese", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/zh\/$/);
  });
});

test("every page lists 16 language alternates plus x-default", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  const alternates = page.locator("link[rel='alternate'][hreflang]");
  await expect(alternates).toHaveCount(17);
  await expect(page.locator("link[hreflang='x-default']")).toHaveAttribute("href", /\/$/);
  await expect(page.locator("link[hreflang='ja']")).toHaveAttribute("href", /\/ja\/melee\/sword\/$/);
  await expect(page.locator("meta[property='og:locale:alternate']")).toHaveCount(15);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the menu opens as a details element and its links work", async ({ page }) => {
    await page.goto("/zh/melee/sword/");
    await page.getByTestId("lang-switch").click();
    await page.locator(".lang-picker a", { hasText: "Italiano" }).click();
    await expect(page).toHaveURL(/\/it\/melee\/sword\/$/);
  });

  test("the root refreshes to Traditional Chinese and lists the languages", async ({ page, request }) => {
    const html = await (await request.get("/")).text();
    expect(html.match(/<a href="\/[a-z-]+\/"/g)).toHaveLength(16);
    await page.goto("/");
    await expect(page).toHaveURL(/\/zh\/$/, { timeout: 10_000 });
  });
});

test("the open menu stays inside a 360px screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/pt/melee/sword/");
  await openMenu(page);
  const box = await page.locator(".lang-picker ul").boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("the 404 page sends visitors home in the language of the missing URL", async ({ page }) => {
  await page.goto("/ja/does-not-exist/");
  await expect(page.locator("[data-lang-home]")).toHaveAttribute("href", "/ja/");
  await expect(page.locator("form[data-lang-form]")).toHaveAttribute("action", "/ja/search/");
  await expect(page.locator(".lang-picker a[data-lang='de']")).toHaveAttribute("href", "/de/");
});

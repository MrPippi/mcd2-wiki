import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

const siteMenu = (page: Page) => page.locator(".site-menu");
const langPicker = (page: Page) => page.locator(".lang-picker");

const openSiteMenu = async (page: Page) => {
  await page.getByTestId("site-menu").click();
  await expect(siteMenu(page)).toHaveAttribute("open", "");
};

test.describe("header menu", () => {
  test("lists the map, the achievements and the bestiary in the page language", async ({ page }) => {
    await page.goto("/zh/melee/");
    await expect(page.getByTestId("site-menu")).toHaveAttribute("aria-label", "選單");
    await openSiteMenu(page);
    const links = siteMenu(page).locator("a");
    await expect(links).toHaveText(["地圖", "成就", "怪物圖鑑", "靈魂風暴", "配裝", "武器比較", "掉落機率計算器", "攻略", "任務", "地點", "頭目"]);
    await expect(links.nth(0)).toHaveAttribute("href", "/zh/map/");
    await expect(links.nth(1)).toHaveAttribute("href", "/zh/achievements/");
    await expect(links.nth(2)).toHaveAttribute("href", "/zh/mobs/");
    await expect(siteMenu(page).locator("[aria-current='page']")).toHaveCount(0);
    await links.nth(1).click();
    await expect(page).toHaveURL(/\/zh\/achievements\/$/);
  });

  test("draws its button as three bars rather than a font glyph", async ({ page }) => {
    await page.goto("/zh/melee/");
    const icon = page.getByTestId("site-menu").locator("svg.menu-icon");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon.locator("path, line, rect")).not.toHaveCount(0);
    await expect(page.getByTestId("site-menu")).not.toContainText("☰");
  });

  test("marks the current page and speaks the language of the page", async ({ page }) => {
    await page.goto("/ja/achievements/");
    await openSiteMenu(page);
    await expect(siteMenu(page).locator("a")).toHaveText(["マップ", "実績", "モンスター図鑑", "ソウルストーム", "ビルドプランナー", "武器比較", "ドロップ確率計算機", "攻略", "クエスト", "ロケーション", "ボス"]);
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
    await expect(page.locator(".achievements-head .tag.warn")).toHaveCount(0);
    await expect(page.locator(".achievements-credit")).toContainText("1912410");
    await expect(page.locator(".achievements-credit")).toContainText("© Mojang Studios");
  });

  test("shows a described achievement with its description", async ({ page }) => {
    await page.goto("/zh/achievements/");
    const card = page.locator(".achievement-card", { has: page.locator("#ach-equip-a-unique-item") });
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
    await expect(page.locator(".achievements-head .tag.warn")).toHaveCount(1);
    await expect(page.locator(".achievements-head .tag.warn")).toHaveText("未翻訳");
    await expect(page.locator(".achievement-card .tag.warn")).toHaveCount(0);
    await expect(page.locator(".achievement-hidden").first()).toHaveText("隠し実績");
  });

  test("compares English with Traditional Chinese", async ({ page }) => {
    await page.goto("/en/achievements/");
    await expect(page.locator(".achievement-card").first().locator(".achievement-name .alt")).toHaveText("家當在哪裡，家就在哪裡");
    await expect(page.locator(".achievement-card .tag.warn")).toHaveCount(0);
    await expect(page.locator(".achievements-head .tag.warn")).toHaveCount(0);
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

const firstCondition = (page: Page) => page.locator(".achievement-card").first().locator("details.achievement-condition");

test.describe("hidden achievement conditions", () => {
  test("stay hidden until revealed, then name the quest in both languages", async ({ page }) => {
    await page.goto("/zh/achievements/");
    await expect(page.locator("details.achievement-condition")).toHaveCount(19);
    const reveal = firstCondition(page);
    await expect(reveal).not.toHaveAttribute("open", "");
    await expect(reveal.locator("summary")).toHaveText("顯示解鎖條件");
    await expect(reveal.locator(".condition-text .primary")).toBeHidden();
    await reveal.locator("summary").click();
    await expect(reveal).toHaveAttribute("open", "");
    await expect(reveal.locator(".condition-text .primary")).toHaveText("完成任務「逃離烏賊海岸」");
    await expect(reveal.locator(".condition-text .alt")).toHaveText("Complete the quest “Escape from Squid Coast”");
  });

  test("names quest objectives and bosses", async ({ page }) => {
    await page.goto("/zh/achievements/");
    const card = (id: string) => page.locator(".achievement-card", { has: page.locator(`#ach-${id}`) });
    const objective = card("complete-enter-the-new-dimension-quest").locator("details.achievement-condition");
    await objective.locator("summary").click();
    await expect(objective.locator(".condition-text .primary")).toHaveText("完成任務目標「進入裂隙」");
    const boss = card("defeat-a-monarch").locator("details.achievement-condition");
    await boss.locator("summary").click();
    await expect(boss.locator(".condition-text .primary")).toHaveText("擊敗「君主」");
  });

  test("use the game's own quest names in other languages", async ({ page }) => {
    await page.goto("/ja/achievements/");
    const reveal = firstCondition(page);
    await reveal.locator("summary").click();
    await expect(reveal.locator(".condition-text .primary")).toHaveText("クエスト「イカ海岸から脱出する」をクリアする");
    await expect(reveal.locator(".tag.warn")).toHaveCount(0);
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("open as a details element", async ({ page }) => {
      await page.goto("/zh/achievements/");
      const reveal = firstCondition(page);
      await expect(reveal.locator(".condition-text .primary")).toBeHidden();
      await reveal.locator("summary").click();
      await expect(reveal.locator(".condition-text .primary")).toHaveText("完成任務「逃離烏賊海岸」");
    });
  });
});

test.describe("achievement search", () => {
  test("finds an achievement by its name and links to its card", async ({ page }) => {
    await page.goto(`/zh/search/?q=${encodeURIComponent("家當在哪裡")}`);
    const link = page.locator('.pagefind-ui__results a[href*="/zh/achievements/"]').first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.pagefind-ui__results a[href*="/zh/achievements/#ach-complete-arrive-in-brave-haven-quest"]').first()).toBeVisible();
  });

  test("finds an achievement by its compare-language name and description", async ({ page }) => {
    for (const term of ["Stuff", "裝備一件獨特物品"]) {
      await page.goto(`/zh/search/?q=${encodeURIComponent(term)}`);
      await expect(page.locator('.pagefind-ui__results a[href*="/zh/achievements/"]').first(), term).toBeVisible({ timeout: 15_000 });
    }
  });

  test("keeps hidden unlock conditions out of the index", async ({ page }) => {
    await page.goto("/en/search/?q=Souldown");
    await expect(page.locator(".pagefind-ui__message")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.pagefind-ui__results a[href*="/achievements/"]')).toHaveCount(0);
  });
});

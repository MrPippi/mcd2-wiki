import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

const dropRow = (page: Page, label: string) => page.getByTestId("mob-drops").locator(".mob-drop", { has: page.locator(".mob-drop-slot", { hasText: label }) });

test.describe("bestiary index", () => {
  test("groups mobs by kind and links each card to its page", async ({ page }) => {
    await page.goto("/zh/mobs/");
    await expect(page.locator("h1 [data-pagefind-meta='title']")).toHaveText("怪物圖鑑");
    await expect(page.locator(".catalog-alt")).toHaveText("Bestiary");
    await expect(page.locator(".mob-group > h2 .mob-group-name")).toHaveText(["頭目", "小頭目", "一般怪物", "變種"]);
    const zombie = page.locator(".mob-group[data-group='regular'] li", { has: page.locator(".mob-card-name", { hasText: /^殭屍$/ }) });
    await expect(zombie.locator(".mob-card-alt")).toHaveText("Zombie");
    await expect(zombie.locator("img")).toHaveAttribute("alt", "");
    await zombie.locator("a").click();
    await expect(page).toHaveURL(/\/zh\/mobs\/zombie\/$/);
  });

  test("filters by name and hides groups left empty", async ({ page }) => {
    await page.goto("/en/mobs/");
    await page.locator(".filter-text").fill("witch");
    await expect(page.locator(".mob-group[data-group='boss']")).toBeVisible();
    await expect(page.locator(".mob-group[data-group='variant']")).toBeHidden();
    await page.locator(".filter-text").fill("zzzz");
    await expect(page.locator(".mob-group:visible")).toHaveCount(0);
    await expect(page.locator(".no-results")).toBeVisible();
  });

  test("credits the portraits and shows a frame for mobs without one", async ({ page }) => {
    await page.goto("/en/mobs/");
    await expect(page.locator(".mob-credit")).toHaveText("Portraits are renders of the game's models.");
    const bee = page.locator("li", { hasText: "Bee" }).first();
    await expect(bee.getByTestId("mob-portrait-placeholder")).toBeVisible();
    await expect(bee.locator("a")).toHaveAccessibleName(/^Bee\s*蜜蜂$/);
  });
});

test.describe("mob page", () => {
  test("shows names, portrait, stats, areas and drops for a regular mob", async ({ page }) => {
    await page.goto("/zh/mobs/zombie/");
    await expect(page.locator("article[data-pagefind-body]")).toHaveCount(1);
    await expect(page.locator("h1 .primary")).toHaveText("殭屍");
    await expect(page.locator("h1 .alt")).toHaveText("Zombie");
    await expect(page.locator(".mob-plate .mob-portrait img")).toHaveAttribute("alt", "殭屍");
    await expect(page.locator(".mob-plate .mob-portrait img")).toHaveAttribute("src", "/mobs/zombie.webp");
    const stats = page.getByTestId("mob-stats").first();
    await expect(stats.locator("tr", { hasText: "生命值" }).locator("td")).toHaveText("8");
    await expect(stats.locator("tr", { hasText: "爆炸抗性倍率" }).locator("td")).toHaveText("×1.5");
    const frozen = page.getByTestId("mob-areas").locator("a", { hasText: "冰封高地" });
    await expect(frozen).toHaveAttribute("href", "/zh/map/?world=overworld#4/6611/4173");
    await expect(page.getByTestId("mob-areas").locator("a", { hasText: "地下城" })).toHaveAttribute("href", "/zh/map/");
    const gear = dropRow(page, "裝備").first();
    await expect(gear).toContainText("隨機次數：1，每次 1.25%");
    await expect(gear).toContainText("資料中沒有物品清單。");
    await expect(gear).not.toContainText("區域");
    await expect(page.getByTestId("mob-drops-note").first()).toHaveText("依遊戲資料整理，實際掉落可能受遊戲機制影響。");
    await expect(page.getByTestId("mob-variants").locator("a")).toHaveCount(4);
  });

  test("shows the Soul Corrupted version only when the game has one", async ({ page }) => {
    await page.goto("/en/mobs/zombie/");
    const soul = page.getByTestId("mob-soul-corrupted");
    await expect(soul.locator("h2")).toHaveText("Soul Corrupted");
    await expect(soul.getByTestId("mob-stats").locator("tr", { hasText: "Health" }).locator("td")).toHaveText("200");
    await expect(soul.locator(".mob-drop", { hasText: "Gear" })).toContainText("Random rolls: 1, 25% each");
    await page.goto("/en/mobs/monstrosity-moss/");
    await expect(page.getByTestId("mob-soul-corrupted")).toHaveCount(0);
  });

  test("describes a boss's drops as guaranteed plus rolls and drops the zero parts", async ({ page }) => {
    await page.goto("/en/mobs/monstrosity-moss/");
    const gear = dropRow(page, "Gear");
    await expect(gear.locator(".mob-drop-rule li")).toHaveText(["Guaranteed: 1", "Random rolls: 6, 50% each"]);
    await expect(gear).toContainText("Items come from the area's drop pool.");
    const talismans = dropRow(page, "Talismans");
    await expect(talismans.locator(".mob-drop-rule li")).toHaveText(["Guaranteed: 1"]);
    await expect(talismans).toContainText("Items come from this mob's own list.");
    await page.goto("/en/mobs/maw/");
    await expect(dropRow(page, "Gear").locator(".mob-drop-rule li")).toHaveText(["Guaranteed: 1", "Random rolls: 3, 15% each"]);
  });

  test("lists two areas with the same name once", async ({ page }) => {
    await page.goto("/en/mobs/skeleton/");
    await expect(page.getByTestId("mob-areas").locator("a", { hasText: /^Dungeon$/ })).toHaveCount(1);
  });

  test("links a variant back to its mob, and shows a frame when there is no portrait", async ({ page }) => {
    await page.goto("/en/mobs/husk/");
    await page.getByTestId("mob-variant-of").locator("a").click();
    await expect(page).toHaveURL(/\/en\/mobs\/zombie\/$/);
    await page.goto("/en/mobs/bee/");
    await expect(page.getByTestId("mob-portrait-placeholder")).toHaveAttribute("aria-label", "No portrait yet");
    await expect(page.locator(".mob-plate .mob-portrait img")).toHaveCount(0);
    await expect(page.getByTestId("mob-drops-note")).toBeVisible();
  });

  for (const lang of ["de", "ru"]) {
    test(`stays inside a 360px screen in ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      for (const path of [`/${lang}/mobs/`, `/${lang}/mobs/zombie/`, `/${lang}/mobs/monstrosity-moss/`]) {
        await page.goto(path);
        await expect(page.locator(".mobs-page, .mob-page")).toHaveCount(1);
        expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
      }
    });
  }
});

import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("how to obtain", () => {
  test("lists areas, quest and merchant for the sickles, and leaves area-pool chests to the calculator", async ({ page }) => {
    await page.goto("/zh/melee/sickles/");
    const block = page.getByTestId("item-sources");
    await expect(block.locator("h2")).toHaveText("取得方式");
    await expect(block.locator("[data-source-kind='areas'] a").first()).toHaveAttribute("href", /\/zh\/map\//);
    await expect(block.locator("[data-source-kind='areas'] .source-area-icon").first()).toHaveAttribute("src", /\/icons\/locations\//);
    await expect(block.locator("[data-source-kind='chests']")).toHaveCount(0);
    await expect(block.locator("[data-source-kind='quests'] [data-testid='guaranteed']")).toHaveCount(1);
    await expect(block.locator("[data-source-kind='merchants'] [data-testid='merchant-category']")).toContainText("近戰");
    await expect(block.locator(".note")).toBeVisible();
  });

  test("shows a mushroom piece's quest as 2 of 4 and never a percentage", async ({ page }) => {
    await page.goto("/en/armor/piece/mushroom-chest/");
    const block = page.getByTestId("item-sources");
    await expect(block.locator("[data-source-kind='quests'] [data-testid='picks']")).toHaveText("2 of 4");
    await expect(block.getByTestId("source-reward-of")).toHaveText("Reward of The Cleric’s Apprentice");   // the quest, not the internal row id
    await expect(block.locator("[data-source-kind='quests'] .item-alt")).toHaveCount(0);
    await expect(block.locator("[data-source-kind='merchants'] [data-testid='merchant-category']")).toContainText("Armor");
    expect(await block.innerText()).not.toContain("%");
    await block.getByTestId("source-reward-of").getByRole("link").click();
    await expect(page).toHaveURL(/\/en\/quests\/foa1-s10-a\/$/);
  });

  test("marks fixed chests and names them by the site's translated label", async ({ page }) => {
    await page.goto("/zh/artifact/firework-quiver/");
    const block = page.getByTestId("item-sources");
    await expect(block.getByTestId("chest-fixed")).toHaveCount(1);
    // Gear pages leave area-pool chests to the drop calculator.
    await expect(block.getByTestId("chest-area")).toHaveCount(0);
    const chests = block.locator("[data-source-kind='chests']");
    await expect(chests.locator("li")).toContainText("營地木箱");
    await expect(chests.locator(".item-alt")).toHaveText("Camp Wooden Chest");
    await expect(block.locator(".tag.warn")).toHaveCount(0);
    await expect(block.locator("[data-source-kind='areas'] .tag.warn")).toHaveCount(0);
    await expect(page.locator("main h1 ~ .tag.warn, .entry-title .tag.warn")).toHaveCount(0);
    expect(await block.innerText()).not.toContain("%");
  });

  test("a gear piece found only in area-pool chests lists no chests", async ({ page }) => {
    await page.goto("/zh/armor/piece/hewn-bark-helmet/");
    await expect(page.getByTestId("item-sources").locator("[data-source-kind='chests']")).toHaveCount(0);
  });

  test("gathers an enchantment's sources from its books", async ({ page }) => {
    await page.goto("/zh/enchantment/piercing/");
    await expect(page.getByTestId("item-sources").locator("[data-source-kind='quests'] li")).not.toHaveCount(0);
    await expect(page.getByTestId("book-source")).toBeVisible();
  });

  test("an English page shows no untranslated marker and no Chinese fallback line", async ({ page }) => {
    await page.goto("/en/melee/sickles/");
    await expect(page.getByTestId("item-sources").locator(".tag.warn")).toHaveCount(0);
  });

  test("names an enchantment's book pool by its area and lists what drops the books", async ({ page }) => {
    await page.goto("/zh/enchantment/ricochet/");
    const block = page.getByTestId("item-sources");
    await expect(block.locator("[data-source-kind='book-pools'] .source-name")).toHaveText(["地下城"]);
    const drops = block.locator("[data-source-kind='book-drops']");
    await expect(drops.locator("h3")).toContainText("附魔書掉落來源");
    await expect(drops.locator("li")).toHaveCount(3);
    await expect(drops.getByRole("link", { name: "寶箱豬" })).toHaveAttribute("href", /\/zh\/mobs\/piggy-bank\/$/);
    await expect(drops.getByTestId("book-drop-rule").first()).toHaveText("必掉：1");
  });

  test("leaves unique enchantments out of the enchantment list, but keeps their pages", async ({ page }) => {
    await page.goto("/zh/enchantment/");
    await expect(page.locator("a[href$='/zh/enchantment/swirling-unique/']")).toHaveCount(0);
    await expect(page.locator("a[href$='/zh/enchantment/swirling/']").first()).toBeVisible();
    const response = await page.goto("/zh/enchantment/swirling-unique/");
    expect(response?.status()).toBe(200);
  });

  test("has no block for an item the game data gives no source", async ({ page }) => {
    await page.goto("/zh/melee/battlestaff-unique1/");
    await expect(page.getByTestId("item-sources")).toHaveCount(0);
  });

  for (const lang of ["de", "ru"]) {
    test(`stays inside a 360px screen in ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      for (const path of [`/${lang}/melee/sickles/`, `/${lang}/armor/piece/mushroom-chest/`, `/${lang}/artifact/firework-quiver/`, `/${lang}/enchantment/ricochet/`]) {
        await page.goto(path);
        await expect(page.getByTestId("item-sources")).toBeVisible();
        expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
      }
    });
  }
});

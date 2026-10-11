import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("how to obtain", () => {
  test("lists areas, chests, quest and merchant for the sickles", async ({ page }) => {
    await page.goto("/zh/melee/sickles/");
    const block = page.getByTestId("item-sources");
    await expect(block.locator("h2")).toHaveText("取得方式");
    await expect(block.locator("[data-source-kind='areas'] a").first()).toHaveAttribute("href", /\/zh\/map\//);
    await expect(block.locator("[data-source-kind='chests'] li").first().locator(".tag").first()).toBeVisible();
    await expect(block.locator("[data-source-kind='quests'] [data-testid='guaranteed']")).toHaveCount(1);
    await expect(block.locator("[data-source-kind='merchants'] [data-testid='merchant-category']")).toContainText("近戰");
    await expect(block.locator(".note")).toBeVisible();
  });

  test("shows a mushroom piece's quest as 2 of 4 and never a percentage", async ({ page }) => {
    await page.goto("/en/armor/piece/mushroom-chest/");
    const block = page.getByTestId("item-sources");
    await expect(block.locator("[data-source-kind='quests'] [data-testid='picks']")).toHaveText("2 of 4");
    await expect(block.locator("[data-source-kind='merchants'] [data-testid='merchant-category']")).toContainText("Armor");
    expect(await block.innerText()).not.toContain("%");
  });

  test("marks fixed chests and keeps the untranslated marker inside the block", async ({ page }) => {
    await page.goto("/zh/artifact/firework-quiver/");
    const block = page.getByTestId("item-sources");
    await expect(block.getByTestId("chest-fixed")).toHaveCount(1);
    await expect(block.getByTestId("chest-area").first()).toBeVisible();
    await expect(block.locator(".tag.warn").first()).toHaveText("未翻譯");
    await expect(page.locator("main h1 ~ .tag.warn, .entry-title .tag.warn")).toHaveCount(0);
    expect(await block.innerText()).not.toContain("%");
  });

  test("gathers an enchantment's sources from its books", async ({ page }) => {
    await page.goto("/zh/enchantment/piercing/");
    await expect(page.getByTestId("item-sources").locator("[data-source-kind='quests'] li")).not.toHaveCount(0);
    await expect(page.getByTestId("book-source")).toBeVisible();
  });

  test("an English page shows no untranslated marker", async ({ page }) => {
    await page.goto("/en/melee/sickles/");
    await expect(page.getByTestId("item-sources").locator(".tag.warn")).toHaveCount(0);
  });

  test("has no block for an item the game data gives no source", async ({ page }) => {
    await page.goto("/zh/melee/battlestaff-unique1/");
    await expect(page.getByTestId("item-sources")).toHaveCount(0);
  });

  for (const lang of ["de", "ru"]) {
    test(`stays inside a 360px screen in ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      for (const path of [`/${lang}/melee/sickles/`, `/${lang}/armor/piece/mushroom-chest/`, `/${lang}/artifact/firework-quiver/`]) {
        await page.goto(path);
        await expect(page.getByTestId("item-sources")).toBeVisible();
        expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
      }
    });
  }
});

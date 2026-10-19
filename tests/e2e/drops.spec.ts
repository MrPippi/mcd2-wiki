import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("drop odds", () => {
  test("an item page lists drop odds by kind of source, with the rest folded", async ({ page }) => {
    await page.goto("/en/enchantment/channeling/");
    const section = page.getByTestId("drop-odds");
    await expect(section).toBeVisible();
    await expect(section.getByTestId("drop-group-chest")).toBeVisible();
    await expect(section.getByTestId("drop-more").first()).toBeVisible();
    await expect(section.getByTestId("guide-unconfirmed")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("gear pages leave shared chests to the calculator; a talisman page keeps the talisman's own chest", async ({ page }) => {
    await page.goto("/en/melee/sword/");
    await expect(page.getByTestId("drop-odds").getByTestId("drop-group-chest")).toHaveCount(0);
    await page.goto("/en/talisman/plummeting/");
    await expect(page.getByTestId("drop-odds").getByTestId("drop-group-chest")).toBeVisible();
  });

  test("the page says what is not included and flags chests whose area the data does not give", async ({ page }) => {
    await page.goto("/en/enchantment/channeling/");
    await expect(page.getByTestId("drop-not-included")).toContainText("merchants, Soul Storm chests and key chests");
    await expect(page.getByTestId("drop-unplaced").first()).toBeVisible();
    await page.goto("/en/drops/?item=enchantment-book%2Fchanneling");
    await expect(page.getByTestId("drop-not-included")).toBeVisible();
    await expect(page.getByTestId("drop-results").locator(".tag.warn").first()).toBeVisible();
  });

  test("gear pages list regular mobs in their own group, with an area link and the per-kill note", async ({ page }) => {
    await page.goto("/en/melee/sword/");
    const group = page.getByTestId("drop-odds").getByTestId("drop-group-regular");
    await expect(group).toBeVisible();
    await expect(group.getByTestId("drop-regular-note")).toBeVisible();
    await expect(group).toContainText("Regular mobs");
    await expect(group).toContainText("Soul Corrupted");
    await expect(group.locator("tbody")).not.toContainText("Geomancer");
    await expect(group.locator("tbody a").first()).toBeVisible();
    await expect(page.getByTestId("drop-not-included")).not.toContainText("regular mobs");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("the calculator lists regular mobs once in the source menu and prints small chances with two significant digits", async ({ page }) => {
    await page.goto("/en/drops/?item=melee/sword-unique1");
    const menu = page.getByTestId("drop-source");
    await expect(menu.locator("option", { hasText: /^Regular mobs$/ })).toHaveCount(1);
    await menu.selectOption("regular:Hostile");
    const rows = page.getByTestId("drop-results").locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().locator("td.drop-chance")).toHaveText(/^0\.00\d+%$/);
  });

  test("the calculator names every source in the menu once, with the dungeon and rift note on procedural chests", async ({ page }) => {
    await page.goto("/en/drops/?item=melee/sword-unique1");
    const menu = page.getByTestId("drop-source");
    await expect(menu.locator("option", { hasText: /^Fancy Chest$/ })).toHaveCount(1);
    await expect(menu.locator("option", { hasText: /^Fancy Chest · dungeon and rift version$/ })).toHaveCount(1);
    const texts = await menu.locator("option").allTextContents();
    expect(new Set(texts).size).toBe(texts.length);
  });

  test("the calculator recomputes when the threat level, difficulty or rarity changes", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/en/drops/?item=melee/sword-unique1");
    await expect(page.getByTestId("drop-calc")).toBeVisible();
    const rows = page.getByTestId("drop-results").locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const high = await rows.first().locator("td.drop-chance").textContent();
    await page.getByTestId("drop-threat").selectOption("8");
    await expect(page).toHaveURL(/threat=8/);
    const low = await page.getByTestId("drop-results").locator("tbody tr").first().locator("td.drop-chance").textContent();
    expect(low).not.toBe(high);
    await page.getByTestId("drop-difficulty").selectOption("low");
    await expect(page.getByTestId("drop-summary")).toContainText("No source can give this item");
    expect(errors).toEqual([]);
  });

  test("the item picker lists every item by category with icons, books in their frame", async ({ page }) => {
    await page.goto("/en/drops/");
    await page.getByTestId("drop-item-pick").click();
    const options = page.getByTestId("drop-options");
    await expect(page.getByTestId("drop-dialog")).toBeVisible();
    await expect(options.locator("h3")).toHaveText(["Melee Weapons", "Ranged Weapons", "Armor", "Artifacts", "Talismans", "Enchantment Books"]);
    await expect(options.locator("[data-key='melee/sword'] img")).toBeVisible();
    await expect(options.locator("[data-key='enchantment-book/channeling'] img.picker-frame")).toHaveCount(1);
  });

  test("the picker marks the chosen item and keeps the result while it is open", async ({ page }) => {
    await page.goto("/en/drops/?item=talisman%2Fplummeting");
    await expect(page.getByTestId("drop-item-pick")).toContainText("Ocelot's Paw");
    await page.getByTestId("drop-item-pick").click();
    await expect(page.getByTestId("drop-options").locator("[aria-current='true']")).toHaveAttribute("data-key", "talisman/plummeting");
    await page.getByTestId("drop-filter").fill("zzzz-no-match");
    await expect(page.getByTestId("drop-dialog").locator("[data-no-results]")).toBeVisible();
    await page.getByTestId("drop-dialog").locator("[data-close]").click();
    await expect(page.getByTestId("drop-item-pick")).toBeFocused();
    await expect(page.getByTestId("drop-results").locator("tbody tr").first()).toBeVisible();
  });

  test("the calculator picks an item by name filter", async ({ page }) => {
    await page.goto("/en/drops/");
    await expect(page.getByTestId("drop-summary")).toContainText("Choose an item");
    await page.getByTestId("drop-item-pick").click();
    await page.getByTestId("drop-filter").fill("ocelot");
    const options = page.getByTestId("drop-options").locator("button");
    await expect(options).toHaveCount(1);
    await options.first().click();
    await expect(page.getByTestId("drop-dialog")).toBeHidden();
    await expect(page.getByTestId("drop-item-pick")).toBeFocused();
    await expect(page.getByTestId("drop-results").locator("tbody tr").first()).toContainText("100.00%");
  });

  test("without scripts the calculator shows a note and the item page keeps its odds", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/drops/");
    await expect(page.getByTestId("drop-noscript")).toBeVisible();
    await expect(page.getByTestId("drop-calc")).toBeHidden();
    await page.goto("/en/enchantment/channeling/");
    await expect(page.getByTestId("drop-odds")).toBeVisible();
    await context.close();
  });

  test("the calculator does not scroll the page sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/drops/?item=melee/sword-unique1");
    await expect(page.getByTestId("drop-results")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.goto("/en/enchantment/channeling/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

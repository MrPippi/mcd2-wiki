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

  test("the calculator picks an item by name filter", async ({ page }) => {
    await page.goto("/en/drops/");
    await expect(page.getByTestId("drop-summary")).toContainText("Choose an item");
    await page.getByTestId("drop-filter").fill("ocelot");
    const options = page.getByTestId("drop-item").locator("option");
    await expect(options).toHaveCount(2);
    await page.getByTestId("drop-item").selectOption({ index: 1 });
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

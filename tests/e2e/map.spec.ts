import { expect, test } from "@playwright/test";

test("map page shows its title, world tabs and marker filters", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator("h1")).toHaveText("世界地圖");
  await expect(page.locator(".map-tabs a")).toHaveText([/主世界/, /隙浮/, /營地/]);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/主世界/);
  await expect(page.locator("input[name='kind']")).toHaveCount(5);
  await expect(page.locator("[data-count='rift']")).toHaveText(/^[1-9]\d*$/);
});

test("the header and the home page link to the map", async ({ page }) => {
  await page.goto("/zh/");
  await page.locator(".category-grid a", { hasText: "世界地圖" }).click();
  await expect(page).toHaveURL(/\/zh\/map\/(#.*)?$/);
  await page.goto("/zh/melee/");
  await page.getByTestId("map-link").click();
  await expect(page).toHaveURL(/\/zh\/map\/(#.*)?$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the map page shows the world overview and says why it cannot zoom", async ({ page }) => {
    await page.goto("/zh/map/");
    await expect(page.locator(".map-fallback img")).toBeVisible();
    await expect(page.locator(".map-fallback")).toContainText("需要 JavaScript");
  });
});

test("the map page has no horizontal scroll on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/zh/map/");
  await expect(page.locator("h1")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

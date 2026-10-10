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

test("the map loads tiles and markers", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(page.locator(".map-marker--minecart").first()).toBeAttached();
  await expect(page.locator(".map-fallback")).toBeHidden();
});

test("world tabs switch maps and record the world in the URL", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.locator(".map-tabs a", { hasText: "隙浮" }).click();
  await expect(page).toHaveURL(/\?world=sift/);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/隙浮/);
  await expect(page.locator("[data-count='rift']")).toHaveText("0");
  await page.locator(".map-tabs a", { hasText: "營地" }).click();
  await expect(page).toHaveURL(/\?world=camp/);
  await expect(page.locator(".map-marker")).toHaveCount(0);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
});

test("an unknown world falls back to the overworld", async ({ page }) => {
  await page.goto("/zh/map/?world=nether");
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/主世界/);
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "overworld");
});

test("switching worlds does not reuse the previous world's view", async ({ page }) => {
  await page.goto("/zh/map/#5/7000/7000");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "5");
  await page.locator(".map-tabs a", { hasText: "隙浮" }).click();
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "sift");
  await expect(page.locator(".world-map")).not.toHaveAttribute("data-zoom", "5");
});

test("hiding a marker kind removes it and survives a reload", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".map-marker--rift").first()).toBeAttached();
  await page.locator("input[name='kind'][value='rift']").uncheck();
  await expect(page.locator(".map-marker--rift")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("input[name='kind'][value='rift']")).not.toBeChecked();
  await expect(page.locator(".map-marker--minecart").first()).toBeAttached();
  await expect(page.locator(".map-marker--rift")).toHaveCount(0);
});

test("searching flies to a marker and opens its details", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("鐵匠");
  await page.getByTestId("map-results").getByRole("button", { name: /鐵匠/ }).click();
  await expect(page.locator(".leaflet-popup-content")).toContainText("鐵匠");
  await expect(page).toHaveURL(/#\d+\/\d+\/\d+$/);
});

test("a search with no match says so", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("zzzz");
  await expect(page.getByTestId("map-empty")).toBeVisible();
  await expect(page.getByTestId("map-results").locator("button")).toHaveCount(0);
});

test("a shared view opens at the same zoom, and a broken one is pulled back in range", async ({ page }) => {
  await page.goto("/zh/map/#4/432/4416");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "4");
  await page.goto("/zh/map/#99/-50/99999");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "5");
  await page.goto("/zh/map/#abc");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
});

test("language switch keeps the world and the view", async ({ page }) => {
  await page.goto("/zh/map/?world=sift#3/3000/5000");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "3");
  await page.getByTestId("lang-switch").click();
  await expect(page).toHaveURL(/\/en\/map\/\?world=sift#3\/\d+\/\d+$/);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/The Sift/);
});

test("area names appear only when zoomed in", async ({ page }) => {
  await page.goto("/zh/map/#0/4096/4096");
  await expect(page.locator(".world-map")).toHaveAttribute("data-labels", "off");
  await expect(page.locator(".map-marker--area").first()).toBeHidden();
  await page.goto("/zh/map/#4/432/4416");
  await expect(page.locator(".world-map")).toHaveAttribute("data-labels", "on");
});

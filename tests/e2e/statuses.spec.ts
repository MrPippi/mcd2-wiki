import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("status pages", () => {
  test("show the status data, the fusion and the sources that use it", async ({ page }) => {
    await page.goto("/zh/status/conductive/");
    const data = page.getByTestId("status-data");
    await expect(data.locator('[data-row="alignment"] dd')).toHaveText("減益");
    await expect(data.locator('[data-row="duration"] dd')).toContainText("8");
    await expect(data.locator('[data-row="attr:damageTaken:multiply"] dd')).toHaveText("×1.25");
    const fusion = page.getByTestId("status-fusion");
    await expect(fusion.locator("a")).toHaveAttribute("href", "/zh/status/burning/");
    await expect(fusion).toContainText("Overload");
    const sources = page.getByTestId("status-sources");
    await expect(sources.locator('li[data-kind="enchantment"] a').first()).toHaveAttribute("href", /\/zh\/enchantment\//);
    await expect(sources.locator('li[data-kind="mob"] a').first()).toHaveAttribute("href", /\/zh\/mobs\//);
  });

  test("fit a phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/en/status/burning/");
    await expect(page.getByTestId("status-sources")).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

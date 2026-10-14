import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("quests", () => {
  test("list → quest → prerequisite → reward item", async ({ page }) => {
    await page.goto("/en/quests/");
    await expect(page.getByTestId("quest-section-core").getByTestId("quest-card")).toHaveCount(15);
    await expect(page.getByTestId("quest-section-side").getByTestId("quest-card")).toHaveCount(16);
    await expect(page.getByTestId("quest-section-echoGolem").getByTestId("quest-card")).toHaveCount(4);
    await expect(page.getByTestId("quest-section-bossReplay").getByTestId("quest-card")).toHaveCount(7);

    await page.getByTestId("quest-section-core").getByRole("link", { name: /The Missing Note Blocks/ }).click();
    await expect(page).toHaveURL(/\/en\/quests\/ca04\/$/);
    await expect(page.locator("h1")).toContainText("The Missing Note Blocks");
    await expect(page.getByTestId("quest-objectives").locator("li")).not.toHaveCount(0);

    await page.getByTestId("quest-prerequisites").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/quests\/ca03\/$/);
    await expect(page.getByTestId("quest-unlocks")).toContainText("The Missing Note Blocks");

    const item = page.getByTestId("quest-rewards-first").getByTestId("quest-reward-item").first();
    const name = (await item.innerText()).trim();
    await item.click();
    await expect(page).toHaveURL(/\/en\/armor\/piece\//);
    await expect(page.locator("h1")).toContainText(name);
  });

  test("the menu opens the quest list", async ({ page }) => {
    await page.goto("/zh/");
    await page.getByTestId("site-menu").click();
    await page.locator(".site-menu").getByRole("link", { name: "任務" }).click();
    await expect(page).toHaveURL(/\/zh\/quests\/$/);
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("任務");
    await expect(page.locator("h1")).toHaveText("任務");
  });

  test("a quest page links its mobs and its region on the map", async ({ page }) => {
    await page.goto("/zh/quests/ca03/");
    await expect(page.getByTestId("quest-mobs").locator("a[href='/zh/mobs/maw/']")).toBeVisible();
    await expect(page.getByTestId("quest-region-link")).toHaveAttribute("href", /\/zh\/map\//);
  });

  for (const lang of ["zh", "de", "ru"]) {
    test(`no sideways scroll at 412px (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 900 });
      for (const path of [`/${lang}/quests/`, `/${lang}/quests/dea1-s13-a/`, `/${lang}/quests/ca10-br/`]) {
        await page.goto(path);
        expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
      }
    });
  }
});

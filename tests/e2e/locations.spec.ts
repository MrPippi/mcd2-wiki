import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

test.describe("locations", () => {
  test("list → location → mob → back", async ({ page }) => {
    await page.goto("/en/locations/");
    await expect(page.getByTestId("location-card")).toHaveCount(15);
    await page.getByTestId("location-card").filter({ hasText: "Frozen Highlands" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/en\/locations\/frozen-highlands\/$/);
    await expect(page.locator("h1")).toContainText("Frozen Highlands");
    await expect(page.getByTestId("location-level")).toHaveText("26");
    await expect(page.getByTestId("location-place").filter({ hasText: "Ice Caves" })).toContainText("×4");

    const boss = page.getByTestId("location-mobs").locator(".location-mob-group[data-group='boss'] a").first();
    const name = (await boss.locator(".mob-card-name").innerText()).trim();
    await boss.click();
    await expect(page).toHaveURL(/\/en\/mobs\/[a-z-]+\/$/);
    await expect(page.locator("h1")).toContainText(name);
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/locations\/frozen-highlands\/$/);
  });

  test("the map link opens the map on the region's marker", async ({ page }) => {
    await page.goto("/zh/locations/howling-woods/");
    await page.getByTestId("location-map-link").click();
    await expect(page).toHaveURL(/\/zh\/map\/\?world=overworld#4\/4242\/4046/);
  });

  test("a mob's area opens its location page", async ({ page }) => {
    await page.goto("/zh/mobs/zombie/");
    await page.getByTestId("mob-areas").getByRole("link", { name: "冰封高地", exact: true }).click();
    await expect(page).toHaveURL(/\/zh\/locations\/frozen-highlands\/$/);
    await page.goBack();
    // Each map link is named after its area, so a screen reader's link list tells them apart.
    await page.getByTestId("mob-areas").getByRole("link", { name: "地圖: 冰封高地" }).click();
    await expect(page).toHaveURL(/\/zh\/map\/\?world=overworld#4\/6611\/4173/);
  });

  test("groups the area drops by category, with the certain extras and the unconfirmed books marked", async ({ page }) => {
    await page.goto("/zh/locations/the-deep-dark/");
    const groups = page.getByTestId("location-loot").locator(".location-loot-group");
    await expect(groups).toHaveCount(5);
    await expect(groups.locator(".location-subhead")).toHaveText([/^近戰武器 \(9\)$/, /^遠程武器 \(4\)$/, /^護甲 \(20\)$/, /^神器 \(10\)$/, /^附魔書 \(17\)$/]);
    await expect(page.getByTestId("location-loot").getByTestId("location-loot-item")).toHaveCount(60);
    await expect(page.getByTestId("location-loot-unconfirmed")).toHaveCount(0);
    await expect(page.getByTestId("location-loot-extra-note")).toBeVisible();
    await expect(page.locator(".location-title img").first()).toBeVisible();

    await page.goto("/zh/locations/ravines/");
    const books = page.locator(".location-loot-group[data-group='enchantment-book']");
    await expect(books.getByTestId("location-loot-item")).toHaveCount(17);
    await expect(books.getByTestId("location-loot-unconfirmed")).toHaveCount(17);
    await expect(page.locator(".location-title img").first()).toBeVisible();
  });

  test("shows the guaranteed boss drop where the area has no pool, and hides the section where nothing is known", async ({ page }) => {
    await page.goto("/zh/locations/lush-caves/");
    await expect(page.getByTestId("location-loot").getByTestId("location-loot-item")).toHaveCount(1);
    await expect(page.locator(".location-loot-group[data-group='talisman'] .location-subhead")).toContainText("(1)");
    await page.goto("/zh/locations/squid-coast/");
    await expect(page.getByTestId("location-loot")).toHaveCount(0);
  });

  test("lists the quest rewards in their own section", async ({ page }) => {
    await page.goto("/zh/locations/squid-coast/");
    const rewards = page.getByTestId("location-rewards");
    await expect(rewards.locator("h2")).toHaveText("任務獎勵");
    await expect(rewards.getByTestId("location-reward-item")).toHaveCount(4);
    await expect(rewards.locator(".location-subhead")).toHaveText([/^護甲 \(4\)$/]);
    await page.goto("/zh/locations/ravines/");
    await expect(page.getByTestId("location-rewards")).toHaveCount(0);
  });

  test("the menu lists locations and bosses after the quests", async ({ page }) => {
    await page.goto("/zh/");
    await page.getByTestId("site-menu").click();
    const links = page.locator(".site-menu a");
    await expect(links.nth(-3)).toHaveText("任務");
    await expect(links.nth(-2)).toHaveText("地點");
    await expect(links.nth(-1)).toHaveText("頭目");
    await links.nth(-2).click();
    await expect(page).toHaveURL(/\/zh\/locations\/$/);
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("地點");
  });
});

test.describe("bosses", () => {
  test("lists the bosses then the mini-bosses and links the mob page and the quests", async ({ page }) => {
    await page.goto("/en/bosses/");
    await expect(page.getByTestId("boss-group-boss").getByTestId("boss-card")).toHaveCount(10);
    await expect(page.getByTestId("boss-group-miniboss").getByTestId("boss-card")).toHaveCount(6);
    const maw = page.locator("[data-testid='boss-card'][data-slug='maw']");
    await expect(page.getByTestId("boss-card").first()).toHaveAttribute("data-slug", "soul-corrupted-witch");

    await maw.getByTestId("boss-mob-link").click();
    await expect(page).toHaveURL(/\/en\/mobs\/maw\/$/);
    await page.goBack();
    await maw.getByTestId("boss-core-quests").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/quests\/ca03\/$/);
    await page.goBack();
    await maw.getByTestId("boss-regions").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/locations\/the-deep-dark\/$/);
  });

  test("the menu opens the bosses page", async ({ page }) => {
    await page.goto("/de/");
    await page.getByTestId("site-menu").click();
    await page.locator(".site-menu").getByRole("link", { name: "Bosse" }).click();
    await expect(page).toHaveURL(/\/de\/bosses\/$/);
    await expect(page.locator("h1")).toHaveText("Bosse");
  });
});

for (const lang of ["zh", "de", "ru"]) {
  test(`no sideways scroll at 412px (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 });
    for (const path of [`/${lang}/locations/`, `/${lang}/locations/frozen-highlands/`, `/${lang}/locations/the-deep-dark/`, `/${lang}/bosses/`]) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
  });
}

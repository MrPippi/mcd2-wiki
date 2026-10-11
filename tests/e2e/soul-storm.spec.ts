import { expect, test, type Page } from "@playwright/test";

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("live schedule (UTC)", () => {
  test.use({ timezoneId: "UTC" });

  test("a running storm counts down to its end", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-11T00:00:00Z") });
    await page.goto("/en/soul-storm/");
    const clock = page.getByTestId("soul-storm-clock");
    await expect(clock).toBeVisible();
    await expect(page.getByTestId("soul-storm-status")).toHaveText("Now: Humbler Huskland");
    await expect(page.getByTestId("soul-storm-countdown")).toContainText("20:00");
    await page.clock.runFor(1000);
    await expect(page.getByTestId("soul-storm-countdown")).toContainText("19:59");
  });

  test("between storms it names the next area and when it starts", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-11T00:25:00Z") });
    await page.goto("/en/soul-storm/");
    await expect(page.getByTestId("soul-storm-status")).toHaveText("Next: Lullaby Hills");
    await expect(page.getByTestId("soul-storm-countdown")).toContainText("15:00");
    await expect(page.getByTestId("soul-storm-upcoming").locator("tbody tr")).toHaveCount(7);
  });

  test("always warns that the times are estimated", async ({ page }) => {
    await page.goto("/zh/soul-storm/");
    await expect(page.getByTestId("soul-storm-unverified")).toHaveText("推算時刻，尚未經遊戲內確認");
  });
});

test.describe("viewer's time zone", () => {
  test.use({ timezoneId: "Asia/Taipei" });
  test("lists the upcoming storms in local time and names the zone", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-11T00:00:00Z") });
    await page.goto("/zh/soul-storm/");
    await expect(page.getByTestId("soul-storm-upcoming").locator("tbody tr").first()).toContainText("08:00");
    await expect(page.getByTestId("soul-storm-timezone")).toContainText("Asia/Taipei");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("shows the static schedule and the rotation, no countdown", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    await expect(page.getByTestId("soul-storm-clock")).toBeHidden();
    await expect(page.getByTestId("soul-storm-cadence")).toContainText("every 40 minutes");
    await expect(page.getByTestId("soul-storm-rotation").locator("a")).toHaveCount(7);
    await expect(page.getByTestId("soul-storm-unverified")).toBeVisible();
  });
});

test.describe("static sections", () => {
  test("a rotation link opens the map on the area", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    await page.getByTestId("soul-storm-rotation").getByRole("link", { name: "Humbler Huskland" }).click();
    await expect(page).toHaveURL(/\/en\/map\/\?world=sift#4\/\d+(\.\d+)?\/\d+(\.\d+)?/);
  });

  test("the Storm Monstrosities link to the bestiary", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    const links = page.getByTestId("soul-storm-monstrosities").locator("a");
    await expect(links).toHaveCount(3);
    await expect(links.first()).toHaveAttribute("href", "/en/mobs/monstrosity-copper/");
  });

  test("chests say what the data supports and nothing more", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    const chests = page.getByTestId("soul-storm-chests");
    await expect(chests.getByTestId("soul-storm-unconfirmed")).toHaveCount(2);
    await expect(chests).toContainText("Guaranteed: 4");
    await expect(chests).toContainText("The data has no item list for this.");
    await expect(page.locator("body")).not.toContainText("Nearly as cool as Kira");
  });

  test("does not overflow on a phone in a long language", async ({ page }) => {
    await page.goto("/de/soul-storm/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("menu and search", () => {
  test("the menu lists Soul Storms after the bestiary and marks it on its page", async ({ page }) => {
    await page.goto("/zh/soul-storm/");
    await page.getByTestId("site-menu").click();
    await expect(page.locator(".site-menu a")).toHaveText(["地圖", "成就", "怪物圖鑑", "靈魂風暴"]);
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("靈魂風暴");
  });

  test("site search finds the page by its English name from a Japanese page", async ({ page }) => {
    await page.goto(`/ja/search/?q=${encodeURIComponent("Soul Storms")}`);
    await expect(page.locator('.pagefind-ui__results a[href*="/ja/soul-storm/"]').first()).toBeVisible({ timeout: 15_000 });
  });
});

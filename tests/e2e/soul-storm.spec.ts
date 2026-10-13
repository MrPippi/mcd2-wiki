import { expect, test, type Page } from "@playwright/test";

const LEAD_MS = 60_000;
const TICK_MS = 1000;

/**
 * Opens a page on a fake clock that starts a minute early, so a slow load never passes the target. Pausing one tick
 * early moves the page's overdue ticker to that instant; the next tick then lands exactly on the target.
 */
async function openAt(page: Page, path: string, target: string): Promise<void> {
  const targetMs = Date.parse(target);
  await page.clock.install({ time: new Date(targetMs - LEAD_MS) });
  await page.goto(path);
  await page.clock.pauseAt(new Date(targetMs - TICK_MS));
  await page.clock.runFor(TICK_MS);
}

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("live schedule (UTC)", () => {
  test.use({ timezoneId: "UTC" });

  test("a running storm counts down to its end", async ({ page }) => {
    await openAt(page, "/en/soul-storm/", "2026-10-11T00:00:00Z");
    const clock = page.getByTestId("soul-storm-clock");
    await expect(clock).toBeVisible();
    await expect(page.getByTestId("soul-storm-status")).toHaveText("Now: Humbler Huskland");
    await expect(page.getByTestId("soul-storm-countdown")).toHaveText(/(^|[^0-9])20:00([^0-9]|$)/);
    await page.clock.runFor(TICK_MS);
    await expect(page.getByTestId("soul-storm-countdown")).toHaveText(/(^|[^0-9])19:59([^0-9]|$)/);
    await page.clock.runFor(TICK_MS);
    await expect(page.getByTestId("soul-storm-countdown")).toHaveText(/(^|[^0-9])19:58([^0-9]|$)/);
  });

  test("between storms it names the next area and when it starts", async ({ page }) => {
    await openAt(page, "/en/soul-storm/", "2026-10-11T00:25:00Z");
    await expect(page.getByTestId("soul-storm-status")).toHaveText("Next: Lullaby Hills");
    await expect(page.getByTestId("soul-storm-countdown")).toHaveText(/(^|[^0-9])15:00([^0-9]|$)/);
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

  for (const lang of ["de", "ru"]) {
    test(`does not overflow on a phone in a long language (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await page.goto(`/${lang}/soul-storm/`);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("menu and search", () => {
  test("the menu lists Soul Storms after the bestiary and marks it on its page", async ({ page }) => {
    await page.goto("/zh/soul-storm/");
    await page.getByTestId("site-menu").click();
    await expect(page.locator(".site-menu a")).toHaveText(["地圖", "成就", "怪物圖鑑", "靈魂風暴", "配裝", "武器比較"]);
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("靈魂風暴");
  });

  test("site search finds the page by its English name from a Japanese page", async ({ page }) => {
    await page.goto(`/ja/search/?q=${encodeURIComponent("Soul Storms")}`);
    await expect(page.locator('.pagefind-ui__results a[href*="/ja/soul-storm/"]').first()).toBeVisible({ timeout: 15_000 });
  });
});

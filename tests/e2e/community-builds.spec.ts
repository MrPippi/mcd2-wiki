import { expect, test, type Page, type Route } from "@playwright/test";
import { COMMUNITY_API } from "../../src/lib/community/config";

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const BUILDS = [
  { id: "aaaaaaaaaa", code: "v=1&gv=1.1.3.0&m=axe&h=cave-crawler-helmet&a=blizzard-staff", title: "Frost axe", lang: "zh", gameVersion: "1.1.3.0", createdAt: 1_800_000_000, votes: 4 },
  { id: "bbbbbbbbbb", code: "v=1&m=sword", title: "<b>Sword</b>", lang: "en", gameVersion: "", createdAt: 1_800_000_100, votes: 1 },
];

/** Stubs Turnstile (it answers at once) and the API; returns the requests the page sent. */
async function stub(page: Page, overrides: Record<string, (route: Route) => Promise<void>> = {}): Promise<{ method: string; path: string; body: unknown }[]> {
  const sent: { method: string; path: string; body: unknown }[] = [];
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.turnstile = { render(el, o) { setTimeout(() => o.callback('token-1')); return 'w'; }, execute() {}, reset() {} };" }),
  );
  await page.route(`${COMMUNITY_API}/**`, async (route) => {
    const url = new URL(route.request().url());
    const body = route.request().postData();
    sent.push({ method: route.request().method(), path: `${url.pathname}${url.search}`, body: body ? JSON.parse(body) : undefined });
    const override = overrides[`${route.request().method()} ${url.pathname}`];
    if (override) return override(route);
    if (route.request().method() === "GET") return route.fulfill({ json: { builds: url.searchParams.get("sort") === "new" ? [...BUILDS].reverse() : BUILDS, more: false } });
    if (url.pathname.endsWith("/vote")) return route.fulfill({ json: { votes: 5 } });
    if (url.pathname.endsWith("/report")) return route.fulfill({ json: { votes: 4 } });
    return route.fulfill({ status: 201, json: { id: "cccccccccc" } });
  });
  return sent;
}

test.describe("community builds page", () => {
  test("lists builds with their items, sorts them, and opens a build", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/zh/builds/");
    const cards = page.locator(".community-card");
    await expect(cards).toHaveCount(2);
    const first = cards.first();
    await expect(first.locator(".community-title")).toHaveText("Frost axe");
    await expect(first.locator(".community-item img")).toHaveCount(3);
    await expect(first.locator(".community-item img").first()).toHaveAttribute("alt", "斧頭");
    await expect(first.locator(".community-meta")).toContainText("1.1.3.0");
    await expect(first.locator(".community-open")).toHaveAttribute("href", "/zh/build/?v=1&gv=1.1.3.0&m=axe&h=cave-crawler-helmet&a=blizzard-staff");
    // Titles are text, never markup.
    await expect(cards.nth(1).locator(".community-title")).toHaveText("<b>Sword</b>");
    await page.getByRole("button", { name: "最新" }).click();
    await expect(cards.first().locator(".community-title")).toHaveText("<b>Sword</b>");
    expect(sent.map((one) => one.path)).toEqual(["/builds?sort=top&page=0", "/builds?sort=new&page=0"]);
  });

  test("likes once and reports after asking, with a Turnstile token and this browser's id", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/zh/builds/");
    const card = page.locator('.community-card[data-build="aaaaaaaaaa"]');
    const like = card.locator("[data-like]");
    await expect(like).toHaveText("讚 · 4");
    await like.click();
    await expect(like).toHaveText("已按讚 · 5");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    const report = card.locator("[data-report]");
    await report.click();
    await expect(report).toHaveText("確定檢舉？");
    await report.click();
    await expect(report).toHaveText("已檢舉");
    await expect(report).toBeDisabled();
    const posts = sent.filter((one) => one.method === "POST");
    expect(posts.map((one) => one.path)).toEqual(["/builds/aaaaaaaaaa/vote", "/builds/aaaaaaaaaa/report"]);
    expect(posts[0]!.body).toEqual({ voter: expect.stringMatching(/^[0-9a-f-]{36}$/), token: "token-1" });
    // The like survives a reload in this browser.
    await page.reload();
    await expect(page.locator('.community-card[data-build="aaaaaaaaaa"] [data-like]')).toHaveAttribute("aria-pressed", "true");
  });

  test("says when the list is empty or cannot load", async ({ page }) => {
    await stub(page, { "GET /builds": (route) => route.fulfill({ json: { builds: [], more: false } }) });
    await page.goto("/en/builds/");
    await expect(page.getByTestId("community-status")).toContainText("No one has shared a build yet");
    await page.unroute(`${COMMUNITY_API}/**`);
    await stub(page, { "GET /builds": (route) => route.fulfill({ status: 500, json: { error: "server" } }) });
    await page.reload();
    await expect(page.getByTestId("community-status")).toHaveText("Couldn't load community builds. Try again later.");
  });

  test("does not scroll sideways on a phone", async ({ page }) => {
    await stub(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/de/builds/");
    await expect(page.locator(".community-card")).toHaveCount(2);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("publish from the build page", () => {
  test("sends the build with its title, language and a Turnstile token", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/zh/build/?v=1&m=axe");
    const form = page.getByTestId("community-publish");
    await expect(form).toBeVisible();
    await page.getByTestId("community-title").fill("冰霜斧頭");
    await page.getByTestId("community-submit").click();
    await expect(page.getByTestId("community-publish-status")).toHaveText("已發布！");
    await expect(form.locator("[data-publish-link]")).toHaveAttribute("href", "/zh/builds/");
    const post = sent.find((one) => one.method === "POST")!;
    expect(post.body).toEqual({ code: expect.stringContaining("m=axe"), title: "冰霜斧頭", lang: "zh", token: "token-1" });
  });

  test("asks for an item first and explains API errors", async ({ page }) => {
    await stub(page, { "POST /builds": (route) => route.fulfill({ status: 409, json: { error: "exists", id: "aaaaaaaaaa" } }) });
    await page.goto("/en/build/");
    await page.getByTestId("community-title").fill("Nothing");
    await page.getByTestId("community-submit").click();
    await expect(page.getByTestId("community-publish-status")).toHaveText("Pick at least one item first.");
    await page.goto("/en/build/?v=1&m=axe");
    await page.getByTestId("community-title").fill("Axe");
    await page.getByTestId("community-submit").click();
    await expect(page.getByTestId("community-publish-status")).toHaveText("Someone has already published this build.");
  });
});

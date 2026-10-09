import { expect, test } from "@playwright/test";

test("home lists categories and links to them", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator("h1")).toContainText("Minecraft Dungeons II");
  await page.locator(".category-grid a", { hasText: "近戰武器" }).click();
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
});

test("entry page shows bilingual name and icon", async ({ page }) => {
  await page.goto("/zh/melee/");
  await page.locator(".entry-card a", { has: page.locator(".primary", { hasText: /^劍$/ }) }).click();
  await expect(page).toHaveURL(/\/zh\/melee\/sword\/$/);
  await expect(page.locator("h1 .primary")).toHaveText("劍");
  await expect(page.locator("h1 .alt")).toHaveText("Sword");
  await expect(page.locator(".entry-head img")).toBeVisible();
});

test("language switch keeps the same entry", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await page.getByTestId("lang-switch").click();
  await expect(page).toHaveURL(/\/en\/melee\/sword\/$/);
  await expect(page.locator("h1 .primary")).toHaveText("Sword");
});

test("compare mode toggles and persists across reloads", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await expect(page.locator("h1 .alt")).toBeVisible();
  await page.getByTestId("compare-toggle").click();
  await expect(page.locator("h1 .alt")).toBeHidden();
  await page.reload();
  await expect(page.locator("h1 .alt")).toBeHidden();
  await page.getByTestId("compare-toggle").click();
  await expect(page.locator("h1 .alt")).toBeVisible();
});

test("compare mode still works when storage is blocked", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/zh/melee/sword/");
  await expect(page.locator("h1 .alt")).toBeVisible();
  await page.getByTestId("compare-toggle").click();
  await expect(page.locator("h1 .alt")).toBeHidden();
  expect(errors).toEqual([]);
});

test("list filter narrows by text and variant", async ({ page }) => {
  await page.goto("/zh/melee/");
  const cards = page.locator(".entry-card");
  const total = await cards.count();
  await page.getByTestId("list-filter").locator(".filter-text").fill("劍");
  const visible = page.locator(".entry-card:visible");
  const shown = await visible.count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(total);
  for (const names of await visible.evaluateAll((els) => els.map((el) => el.getAttribute("data-names") ?? ""))) {
    expect(names).toContain("劍");
  }
  await page.getByTestId("list-filter").locator("button[data-variant='unique']").click();
  for (const variant of await visible.evaluateAll((els) => els.map((el) => el.getAttribute("data-variant")))) {
    expect(variant).toBe("unique");
  }
});

test("armor set page lists its pieces and links back", async ({ page }) => {
  await page.goto("/zh/armor/disciple/");
  await expect(page.getByTestId("set-piece")).toHaveCount(4);
  await page.getByTestId("set-piece").first().locator("a").click();
  await expect(page).toHaveURL(/\/zh\/armor\/piece\/disciple-[a-z]+\/$/);
  await expect(page.locator(".related a[href='/zh/armor/disciple/']")).toBeVisible();
});

test("effect table shows placeholder markers", async ({ page }) => {
  await page.goto("/zh/effect/");
  await expect(page.locator(".placeholder").first()).toHaveText("{數值}");
});

test("search finds entries by Chinese and English terms", async ({ page }) => {
  for (const term of ["劍", "sword"]) {
    await page.goto(`/zh/search/?q=${encodeURIComponent(term)}`);
    await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
  }
});

test("all internal links and images resolve", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "crawl once");
  test.setTimeout(300_000);
  const queue = ["/zh/", "/en/"];
  const seen = new Set(queue);
  const broken: string[] = [];
  while (queue.length > 0) {
    const url = queue.shift() as string;
    const response = await request.get(url);
    if (!response.ok()) {
      broken.push(`${url} → ${response.status()}`);
      continue;
    }
    if (!(response.headers()["content-type"] ?? "").includes("text/html")) continue;
    const html = await response.text();
    for (const [, link] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      if (link.startsWith("/pagefind/") || link.startsWith("/_astro/") || seen.has(link)) continue;
      seen.add(link);
      queue.push(link);
    }
  }
  expect(broken).toEqual([]);
});

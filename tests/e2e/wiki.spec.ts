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

test("status table shows icons next to names", async ({ page }) => {
  await page.goto("/zh/status/");
  await expect(page.locator("tr:has(#burning) img.entry-icon")).toBeVisible();
});

test("enchantment cards show icons", async ({ page }) => {
  await page.goto("/zh/enchantment/arcane/");
  await expect(page.locator(".entry-head img")).toBeVisible();
});

test("enchantment page explains it comes from an enchantment book", async ({ page }) => {
  await page.goto("/zh/enchantment/arcane/");
  await expect(page.getByTestId("book-source")).toContainText("附魔書");
});

test("enchantment page shows a book description that differs from the enchantment", async ({ page }) => {
  await page.goto("/zh/enchantment/mauler-dive/");
  await expect(page.getByTestId("book-source")).toContainText("跳躍攻擊會產生閃電與冰霜波動");
});

test("enchantment books no longer have their own section", async ({ page, request }) => {
  await page.goto("/zh/");
  await expect(page.locator(".site-nav a", { hasText: "附魔書" })).toHaveCount(0);
  expect((await request.get("/zh/enchantment-book/")).status()).toBe(404);
});

test("icons sit inside the game's slot frames", async ({ page, request }) => {
  await page.goto("/zh/melee/sword/");
  await expect(page.locator(".entry-head .icon-frame.frame-inventory img")).toBeVisible();
  await page.goto("/zh/enchantment/arcane/");
  await expect(page.locator(".entry-head .icon-frame.frame-enchantment img")).toBeVisible();
  for (const frame of ["artifact", "enchantment"]) {
    expect((await request.get(`/icons/frames/${frame}.png`)).status()).toBe(200);
  }
});

const slotBorder = (el: Element) => getComputedStyle(el).getPropertyValue("--slot-border").trim().toLowerCase();

test("normal gear uses the plain inventory slot", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  const slot = page.locator(".entry-head .icon-frame.frame-inventory");
  expect(await slot.evaluate(slotBorder)).toBe("#897a6d");
  await expect(slot.locator(".slot-star")).toHaveCount(0);
});

test("unique gear uses the orange slot with the corner rarity mark and no star", async ({ page }) => {
  await page.goto("/zh/melee/sword-unique1/");
  const slot = page.locator(".entry-head .icon-frame.frame-inventory.is-unique");
  expect(await slot.evaluate(slotBorder)).toBe("#ff7e2f");
  await expect(slot.locator(".slot-mark")).toBeVisible();
  await expect(slot.locator(".slot-star")).toHaveCount(0);
});

test("artifacts sit in the hotbar artifact slot", async ({ page }) => {
  await page.goto("/zh/artifact/");
  await page.locator(".entry-card a").first().click();
  await expect(page.locator(".entry-head .icon-frame.frame-artifact img")).toBeVisible();
});

test("enchantment icons fill the diamond window of the book frame", async ({ page }) => {
  await page.goto("/zh/enchantment/arcane/");
  const frame = await page.locator(".entry-head .icon-frame").boundingBox();
  const icon = await page.locator(".entry-head .icon-frame img").boundingBox();
  if (!frame || !icon) throw new Error("icon or frame not rendered");
  // The diamond window spans x 39–217 and y 13–195 of the 256px frame art.
  expect(icon.width / frame.width).toBeCloseTo(178 / 256, 1);
  expect((icon.x - frame.x) / frame.width).toBeCloseTo(39 / 256, 1);
  expect((icon.y + icon.height / 2 - frame.y) / frame.height).toBeCloseTo(104 / 256, 1);
  const frameOnTop = await page.locator(".entry-head .icon-frame").evaluate(
    (el) => getComputedStyle(el, "::after").backgroundImage,
  );
  expect(frameOnTop).toContain("frames/enchantment.png");
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

test("search on the English site finds entries by their Chinese name", async ({ page }) => {
  await page.goto(`/en/search/?q=${encodeURIComponent("遊牧者兜帽")}`);
  await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
});

test("search result titles keep the two languages apart", async ({ page }) => {
  await page.goto("/zh/search/?q=sword");
  const titles = page.locator(".pagefind-ui__result-title");
  await expect(titles.first()).toBeVisible({ timeout: 15_000 });
  for (const title of await titles.allInnerTexts()) {
    expect(title).not.toMatch(/[一-鿿][A-Za-z]|[A-Za-z][一-鿿]/);
  }
});

test("searching an effect links to its table row", async ({ page }) => {
  await page.goto(`/zh/search/?q=${encodeURIComponent("致命鋒刃")}`);
  await expect(page.locator('.pagefind-ui__results a[href*="#critical-edge"]').first()).toBeVisible({ timeout: 15_000 });
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

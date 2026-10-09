import { expect, test, type Locator, type Page } from "@playwright/test";

/** Opens an entry from a category list; on touch devices the first tap opens the details sheet. */
async function openFromList(page: Page, card: Locator): Promise<void> {
  await card.locator("a.item-link").click();
  const sheet = page.getByTestId("item-sheet");
  if (await sheet.isVisible()) await sheet.locator(".sheet-view").click();
}

test("home lists categories and links to them", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator("h1")).toContainText("Minecraft Dungeons II");
  await page.locator(".category-grid a", { hasText: "近戰武器" }).click();
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
});

test("entry page shows bilingual name and icon", async ({ page }) => {
  await page.goto("/zh/melee/");
  await openFromList(page, page.locator(".entry-card", { has: page.locator(".primary", { hasText: /^劍$/ }) }));
  await expect(page).toHaveURL(/\/zh\/melee\/sword\/$/);
  await expect(page.locator("h1 .primary")).toHaveText("劍");
  await expect(page.locator("h1 .alt")).toHaveText("Sword");
  await expect(page.locator(".entry-head img.entry-icon")).toBeVisible();
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


test("enchantment cards show icons", async ({ page }) => {
  await page.goto("/zh/enchantment/arcane/");
  await expect(page.locator(".entry-head img.entry-icon")).toBeVisible();
});

test("enchantment page explains it comes from an enchantment book", async ({ page }) => {
  await page.goto("/zh/enchantment/arcane/");
  await expect(page.getByTestId("book-source")).toContainText("附魔書");
});

test("enchantment page shows a book description that differs from the enchantment", async ({ page }) => {
  await page.goto("/zh/enchantment/fire-aspect-ii/");
  await expect(page.getByTestId("book-source")).toContainText("波動會造成相當於武器傷害");
});

test("entries without an icon are not published", async ({ page, request }) => {
  expect((await request.get("/zh/enchantment/clawing-shadow-unique/")).status()).toBe(404);
  await page.goto("/zh/enchantment/");
  await expect(page.locator(".entry-card .framed-placeholder")).toHaveCount(0);
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
  await openFromList(page, page.locator(".entry-card").first());
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

test("navigation, home cards and headings show the game's category icons", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator(".site-nav a", { hasText: "近戰武器" }).locator("img.ui-icon")).toBeVisible();
  await expect(page.locator(".category-grid a", { hasText: "附魔" }).locator("img.ui-icon")).toBeVisible();
  await page.goto("/zh/effect/");
  await expect(page.locator("h1 img.ui-icon")).toBeVisible();
});

test("armor pieces are labelled with their slot icon", async ({ page }) => {
  await page.goto("/zh/armor/disciple/");
  await expect(page.getByTestId("set-piece").first().locator(".piece-label img.ui-icon")).toBeVisible();
});

test("talismans have their own pages", async ({ page }) => {
  await page.goto("/zh/talisman/");
  await expect(page.locator(".entry-card")).toHaveCount(24);
  await page.goto("/zh/talisman/ammo-capacity/");
  await expect(page.locator("h1 .primary")).toHaveText("黑橡木枝條");
  await expect(page.locator(".entry-head img.entry-icon")).toBeVisible();
});

test("statuses and cosmetics are not published for now", async ({ page, request }) => {
  await page.goto("/zh/");
  for (const label of ["狀態", "披風", "寵物", "外觀"]) {
    await expect(page.locator(".site-nav a", { hasText: label })).toHaveCount(0);
  }
  for (const path of ["/zh/status/", "/zh/cape/", "/zh/pet/", "/zh/skin/", "/zh/cape/hero/"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("the normal/unique filter only appears where unique items exist", async ({ page }) => {
  await page.goto("/zh/talisman/");
  await expect(page.locator("button[data-variant='unique']")).toHaveCount(0);
  await page.goto("/zh/melee/");
  await expect(page.locator("button[data-variant='unique']")).toHaveCount(1);
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

test("the game palette and self-hosted fonts are in use", async ({ page, request }) => {
  await page.goto("/zh/");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(11, 26, 32)");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    // check() is also true for families the page never declared, so require a loaded face as well.
    const loaded = (family: string) => [...document.fonts].some((face) => face.family.replace(/"/g, "") === family && face.status === "loaded");
    return {
      pixel: document.fonts.check("16px Cubic11", "劍") && loaded("Cubic11"),
      label: document.fonts.check("16px Silkscreen", "A") && loaded("Silkscreen"),
    };
  });
  expect(fonts).toEqual({ pixel: true, label: true });
  expect((await request.get("/licenses/Cubic-11-OFL.txt")).status()).toBe(200);
});

test("category tabs mark the current category", async ({ page }) => {
  await page.goto("/zh/melee/");
  await expect(page.locator(".category-tabs a[aria-current='page']")).toHaveAttribute("data-category", "melee");
  await page.goto("/zh/melee/sword/");
  await expect(page.locator(".category-tabs a[aria-current='page']")).toHaveAttribute("data-category", "melee");
  await page.goto("/zh/armor/piece/disciple-helmet/");
  await expect(page.locator(".category-tabs a[aria-current='page']")).toHaveAttribute("data-category", "armor");
});

test("Q and E switch between category tabs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "keyboard shortcuts are a desktop feature");
  await page.goto("/zh/melee/");
  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/zh\/ranged\/$/);
  await page.keyboard.press("q");
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
  await page.keyboard.press("q");
  await expect(page).toHaveURL(/\/zh\/effect\/$/);
});

test("typing in search boxes never switches tabs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "keyboard shortcuts are a desktop feature");
  await page.goto("/zh/melee/");
  await page.locator(".header-search input").press("e");
  await page.locator(".filter-text").press("q");
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
  await page.goto("/zh/search/");
  await page.locator("#search input").press("e");
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/zh\/search\/$/);
});

test("the header search goes to the search page", async ({ page }) => {
  await page.goto("/zh/melee/");
  await page.locator(".header-search input").fill("sword");
  await page.locator(".header-search input").press("Enter");
  await expect(page).toHaveURL(/\/zh\/search\/\?q=sword$/);
  await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
});

test("the language switch keeps the search query and anchor", async ({ page }) => {
  await page.goto(`/zh/search/?q=${encodeURIComponent("劍")}`);
  await expect(page.getByTestId("lang-switch")).toHaveAttribute("href", "/en/search/?q=%E5%8A%8D");
  await page.goto("/zh/effect/#critical-edge");
  await expect(page.getByTestId("lang-switch")).toHaveAttribute("href", "/en/effect/#critical-edge");
});

test("the home page is a title banner with a slot for every category", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator(".home-hero .kicker")).toHaveText("UNOFFICIAL FAN WIKI");
  await expect(page.locator(".home-title")).toContainText("Minecraft Dungeons II");
  await expect(page.locator(".category-grid li")).toHaveCount(7);
  await expect(page.locator(".category-grid .category-slot img.ui-icon")).toHaveCount(7);
  await page.locator(".home-search input").fill("劍");
  await page.locator(".home-search button").click();
  await expect(page).toHaveURL(/\/zh\/search\/\?q=/);
});

const cardNamed = (page: Page, name: string) =>
  page.locator(".entry-card", { has: page.locator(".primary", { hasText: new RegExp(`^${name}$`) }) });

test("items show their names under the slots", async ({ page }) => {
  await page.goto("/zh/melee/");
  await expect(cardNamed(page, "劍").locator(".item-name")).toBeVisible();
  await expect(cardNamed(page, "燃燒之刃").locator(".item-name.is-unique")).toBeVisible();
});

test("hovering or focusing an item shows its details beside the grid", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover is a desktop interaction");
  await page.goto("/zh/melee/");
  const tooltip = page.getByTestId("item-tooltip");
  await expect(tooltip).toContainText("將游標移到物品上");
  await cardNamed(page, "劍").hover();
  await expect(tooltip.locator(".tooltip-name .primary")).toHaveText("劍");
  await expect(tooltip.locator(".kicker")).toHaveText("MELEE WEAPON");
  await expect(tooltip).toContainText("經典");
  await cardNamed(page, "燃燒之刃").locator("a.item-link").focus();
  await expect(tooltip.locator(".kicker")).toHaveText("UNIQUE MELEE WEAPON");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/zh\/melee\/sword-unique1\/$/);
});

test("the details panel hides English when compare mode is off", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover is a desktop interaction");
  await page.goto("/zh/melee/");
  await page.getByTestId("compare-toggle").click();
  await cardNamed(page, "劍").hover();
  const alt = page.getByTestId("item-tooltip").locator(".tooltip-name .alt");
  await expect(alt).toHaveCount(1);
  await expect(alt).toBeHidden();
});

test("tapping an item on a phone opens the details sheet instead of leaving", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch interaction");
  await page.goto("/zh/melee/");
  const card = cardNamed(page, "燃燒之刃");
  await card.locator("a.item-link").click();
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
  const sheet = page.getByTestId("item-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".kicker")).toHaveText("UNIQUE MELEE WEAPON");
  await expect(sheet.locator(".sheet-view")).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await card.locator("a.item-link").click();
  await sheet.locator(".sheet-close").click();
  await expect(sheet).toBeHidden();
  await card.locator("a.item-link").click();
  await sheet.locator(".sheet-view").click();
  await expect(page).toHaveURL(/\/zh\/melee\/sword-unique1\/$/);
});

test("items stay plain links without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://localhost:4329/zh/melee/");
  await expect(page.getByTestId("item-sheet")).toBeHidden();
  await cardNamed(page, "劍").locator("a.item-link").click();
  await expect(page).toHaveURL(/\/zh\/melee\/sword\/$/);
  await context.close();
});

test("the armor list shows sets with their pieces in the details", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover is a desktop interaction");
  await page.goto("/zh/armor/");
  await cardNamed(page, "修行者").hover();
  const tooltip = page.getByTestId("item-tooltip");
  await expect(tooltip.locator(".kicker")).toHaveText("ARMOR SET");
  await expect(tooltip.locator(".tooltip-pieces li")).toHaveCount(4);
});

test("a long details sheet scrolls while its view button stays on screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch interaction");
  await page.goto("/zh/melee/");
  const card = cardNamed(page, "劍");
  await card.locator("template.item-tip").evaluate((template: HTMLTemplateElement) => {
    const desc = template.content.querySelector(".tooltip-desc");
    for (let i = 0; i < 40; i += 1) desc?.append(Object.assign(document.createElement("p"), { textContent: `第 ${i} 行很長的說明文字` }));
  });
  await card.locator("a.item-link").click();
  const sheet = page.getByTestId("item-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".sheet-view")).toBeInViewport({ ratio: 1 });
  await sheet.locator(".sheet-view").click();
  await expect(page).toHaveURL(/\/zh\/melee\/sword\/$/);
});

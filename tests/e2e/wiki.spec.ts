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
  expect((await request.get("/icons/frames/enchantment.png")).status()).toBe(200);
});

const slotBorder = (el: Element) => getComputedStyle(el).getPropertyValue("--slot-border").trim().toLowerCase();

test("normal gear uses the plain inventory slot", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  const slot = page.locator(".entry-head .icon-frame.frame-inventory");
  expect(await slot.evaluate(slotBorder)).toBe("#cfd2cc");
  await expect(slot.locator(".slot-star")).toHaveCount(0);
});

const tagArt = (el: Element) => getComputedStyle(el).borderImageSource;

test("the rarity row shows the game's rarity tags with the name inside", async ({ page }) => {
  await page.goto("/zh/melee/sword-unique1/");
  const uniqueTags = page.getByTestId("info-box").locator(".rarity-tag");
  await expect(uniqueTags).toHaveCount(1);
  await expect(uniqueTags).toHaveText("獨特");
  expect(await uniqueTags.evaluate(tagArt)).toMatch(/unique\.[\w-]+\.png/);

  // "Every item can be common, rare, or special" (official wiki), so all three are listed.
  await page.goto("/zh/melee/sword/");
  const normalTags = page.getByTestId("info-box").locator(".rarity-tag");
  await expect(normalTags).toHaveText(["普通", "稀有", "特殊"]);
  const arts = await normalTags.evaluateAll((els) => els.map((el) => getComputedStyle(el).borderImageSource));
  ["common", "rare", "special"].forEach((tier, i) => expect(arts[i]).toContain(`/${tier}.`));

  await page.goto("/en/armor/disciple/");
  await expect(page.getByTestId("info-box").locator(".rarity-tag")).toHaveText(["Common", "Rare", "Special"]);
});

test("the rarity label explains the tiers on hover and focus, not in the row", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  const box = page.getByTestId("info-box");
  await expect(box.locator(".rarity")).not.toContainText("可能為");
  const term = box.locator(".rarity-term");
  const hint = page.locator(`#${await term.getAttribute("aria-describedby")}`);
  await expect(hint).toBeHidden();
  await term.hover();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText("每件物品都可能是普通、稀有或特殊品質，這裡列出所有可能。");
  await page.mouse.move(5, 5);
  await expect(hint).toBeHidden();
  await term.focus();
  await expect(hint).toBeVisible();

  await page.goto("/zh/melee/sword-unique1/");
  const uniqueTerm = page.getByTestId("info-box").locator(".rarity-term");
  await uniqueTerm.hover();
  await expect(page.locator(`#${await uniqueTerm.getAttribute("aria-describedby")}`)).toHaveText(
    "獨特版本是此物品的另一種型態，有自己的名稱與外觀。",
  );
});

test("unique gear uses the vermilion crop marks and no star", async ({ page }) => {
  await page.goto("/zh/melee/sword-unique1/");
  const slot = page.locator(".entry-head .icon-frame.frame-inventory.is-unique");
  expect(await slot.evaluate(slotBorder)).toBe("#c4391f");
  await expect(slot.locator(".slot-mark")).toBeVisible();
  await expect(slot.locator(".slot-star")).toHaveCount(0);
});

test("artifacts are shown bare on the plate like other gear", async ({ page }) => {
  await page.goto("/zh/artifact/");
  await expect(page.locator(".entry-card .icon-frame.frame-artifact")).toHaveCount(0);
  await openFromList(page, page.locator(".entry-card").first());
  await expect(page.locator(".entry-head .icon-frame.frame-inventory img")).toBeVisible();
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

test("the specimen palette and self-hosted fonts are in use", async ({ page }) => {
  await page.goto("/zh/");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(243, 244, 241)");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    // check() is also true for families the page never declared, so require a loaded face as well.
    const loaded = (family: string) => [...document.fonts].some((face) => face.family.replace(/"/g, "") === family && face.status === "loaded");
    return {
      display: document.fonts.check("700 16px 'Noto Serif TC'", "劍") && loaded("Noto Serif TC"),
      body: document.fonts.check("16px 'Geist Variable'", "A") && loaded("Geist Variable"),
    };
  });
  expect(fonts).toEqual({ display: true, body: true });
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
  // The URL changes before the new page's key handler is attached; wait for it before the next key.
  await page.goto("/zh/melee/");
  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/zh\/ranged\/$/);
  await page.waitForLoadState("domcontentloaded");
  await page.keyboard.press("q");
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
  await page.waitForLoadState("domcontentloaded");
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
  // Phones fold the header search behind an icon button.
  const toggle = page.locator(".search-toggle");
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.locator(".header-search input")).toBeFocused();
  }
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

test("the home page is a cover with a featured specimen and a row for every category", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator(".home-hero .kicker")).toHaveText("UNOFFICIAL FAN WIKI");
  await expect(page.locator(".home-title")).toContainText("Minecraft Dungeons II");
  await expect(page.locator(".category-grid li")).toHaveCount(7);
  await expect(page.locator(".category-grid .category-slot img.ui-icon")).toHaveCount(7);
  await expect(page.locator(".hero-specimen .specimen-plate img.entry-icon")).toBeVisible();
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

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element is not rendered");
  return box;
};

test("hovering an item shows its details next to the cursor and follows it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover is a desktop interaction");
  // Tall enough that the tooltip fits below the cursor on the first row of slots.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/zh/melee/");
  const tooltip = page.getByTestId("item-tooltip");
  await expect(tooltip).toBeHidden();
  const first = page.locator(".entry-card").first();
  const name = (await first.locator(".item-name").textContent())?.trim() ?? "";
  const slot = await boxOf(first.locator(".icon-frame"));
  await page.mouse.move(slot.x + 10, slot.y + 10);
  await expect(tooltip.locator(".tooltip-name .primary")).toHaveText(name);
  await expect(tooltip.locator(".kicker")).toHaveText(/MELEE WEAPON$/);
  await expect.poll(async () => (await boxOf(tooltip)).x).toBeCloseTo(slot.x + 10 + 16, 0);
  await expect.poll(async () => (await boxOf(tooltip)).y).toBeCloseTo(slot.y + 10 + 16, 0);
  await page.mouse.move(slot.x + 40, slot.y + 30);
  await expect.poll(async () => (await boxOf(tooltip)).x).toBeCloseTo(slot.x + 40 + 16, 0);
  await page.mouse.move(5, 5);
  await expect(tooltip).toBeHidden();
});

test("the cursor tooltip flips to the left near the right edge of the window", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover is a desktop interaction");
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/zh/melee/");
  const cards = page.locator(".entry-card .icon-frame");
  const boxes = await Promise.all((await cards.all()).slice(0, 12).map(boxOf));
  const rightmost = boxes.reduce((a, b) => (b.x > a.x ? b : a));
  const cursor = { x: rightmost.x + rightmost.width - 4, y: rightmost.y + 10 };
  await page.mouse.move(cursor.x, cursor.y);
  const tooltip = page.getByTestId("item-tooltip");
  await expect(tooltip).toBeVisible();
  const box = await boxOf(tooltip);
  expect(box.x + box.width).toBeLessThanOrEqual(cursor.x - 16 + 1);
  expect(box.x).toBeGreaterThanOrEqual(8);
});

test("keyboard focus shows the details beside the item", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover is a desktop interaction");
  await page.goto("/zh/melee/");
  const link = cardNamed(page, "燃燒之刃").locator("a.item-link");
  await link.focus();
  const tooltip = page.getByTestId("item-tooltip");
  await expect(tooltip.locator(".kicker")).toHaveText("UNIQUE MELEE WEAPON");
  await expect(link).toHaveAttribute("aria-describedby", "item-tooltip");
  const card = await boxOf(cardNamed(page, "燃燒之刃"));
  const box = await boxOf(tooltip);
  const beside = box.x >= card.x + card.width || box.x + box.width <= card.x;
  expect(beside).toBe(true);
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

test("entry pages show an info box with the key facts", async ({ page }) => {
  await page.goto("/zh/armor/piece/disciple-helmet/");
  await expect(page.locator(".entry-kicker")).toHaveText("ARMOR");
  const box = page.getByTestId("info-box");
  await expect(box.locator("dl.facts")).toContainText("護甲");
  await expect(box.locator("dl.facts")).toContainText("頭盔");
  await expect(box.locator("a[href='/zh/armor/disciple/']")).toBeVisible();
  await expect(page.locator(".entry-head img.entry-icon")).toHaveAttribute("loading", "eager");
});

test("unique entries use the unique kicker and an orange title", async ({ page }) => {
  await page.goto("/zh/melee/sword-unique1/");
  await expect(page.locator(".entry-kicker")).toHaveText("UNIQUE MELEE WEAPON");
  await expect(page.locator("h1.is-unique .primary")).toHaveText("燃燒之刃");
  await expect(page.getByTestId("info-box").locator("dl.facts")).toContainText("獨特");
});

test("the info box sits beside the content on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop layout");
  await page.goto("/zh/melee/sword/");
  const box = await page.getByTestId("info-box").boundingBox();
  const title = await page.locator("h1").boundingBox();
  if (!box || !title) throw new Error("layout not rendered");
  expect(box.x + box.width).toBeLessThanOrEqual(title.x);
});

test("related entries show their slot icon", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await expect(page.locator(".related a[href='/zh/melee/sword-unique1/'] img.entry-icon")).toBeVisible();
});

test("armor set pages use the same info box layout", async ({ page }) => {
  await page.goto("/zh/armor/disciple/");
  await expect(page.locator(".entry-kicker")).toHaveText("ARMOR SET");
  await expect(page.getByTestId("info-box").locator(".set-preview img.entry-icon")).toHaveCount(4);
  await expect(page.getByTestId("set-piece")).toHaveCount(4);
});

test("the effects table and search results use the specimen palette", async ({ page }) => {
  await page.goto("/zh/effect/");
  const head = await page.locator(".entry-table thead th").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(head).toBe("rgba(0, 0, 0, 0)");
  await page.goto("/zh/search/?q=sword");
  await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
  const primary = await page.locator("#search .pagefind-ui").evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--pagefind-ui-primary").trim().toLowerCase(),
  );
  // Vermilion marks the current place; it is the only accent.
  expect(primary).toBe("#c4391f");
});

test("no purple from the old theme remains", async ({ page }) => {
  for (const path of ["/zh/", "/zh/melee/", "/zh/melee/sword/", "/zh/armor/disciple/", "/zh/effect/"]) {
    await page.goto(path);
    const purple = await page.evaluate(() =>
      [...document.querySelectorAll("body *")].some((el) => {
        const s = getComputedStyle(el);
        return ["rgb(21, 18, 28)", "rgb(34, 29, 43)", "rgb(45, 38, 56)", "rgb(61, 52, 72)"].some(
          (c) => s.backgroundColor === c || s.borderTopColor === c,
        );
      }),
    );
    expect(purple, path).toBe(false);
  }
});

test("search excerpts leave out the info box and section labels", async ({ page }) => {
  await page.goto("/zh/search/?q=sword");
  const excerpts = page.locator(".pagefind-ui__result-excerpt");
  await expect(excerpts.first()).toBeVisible({ timeout: 15_000 });
  const text = (await excerpts.allTextContents()).join(" ");
  for (const label of ["DESCRIPTION", "RELATED", "稀有度", "相關條目"]) expect(text, label).not.toContain(label);
});

test("category tabs keep their names for screen readers on every screen size", async ({ page }) => {
  await page.goto("/zh/melee/");
  const tabs = page.locator(".category-tabs");
  for (const name of ["近戰武器", "遠程武器", "效果"]) await expect(tabs.getByRole("link", { name, exact: true })).toHaveCount(1);
});

test("the details sheet takes focus and gives it back when closed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch interaction");
  await page.goto("/zh/melee/");
  const link = cardNamed(page, "燃燒之刃").locator("a.item-link");
  await link.click();
  const sheet = page.getByTestId("item-sheet");
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(link).toBeFocused();
  await link.click();
  await sheet.locator(".sheet-close").click();
  await expect(link).toBeFocused();
});

test("wide touch screens use the whole width for the grid instead of a hover panel", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one wide touch context is enough");
  const context = await browser.newContext({
    viewport: { width: 1180, height: 820 },
    isMobile: true,
    hasTouch: true,
    baseURL: testInfo.project.use.baseURL,
  });
  const page = await context.newPage();
  await page.goto("/zh/melee/");
  expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(true);
  await expect(page.getByTestId("item-tooltip")).toBeHidden();
  await context.close();
});

test("the English kicker is not part of the search index", async ({ page }) => {
  await page.goto("/zh/search/?q=weapon");
  await expect(page.locator(".pagefind-ui__message")).toBeVisible({ timeout: 15_000 });
  const text = (await page.locator(".pagefind-ui__result-excerpt").allTextContents()).join(" ");
  for (const kicker of ["MELEE WEAPON", "RANGED WEAPON"]) expect(text, kicker).not.toContain(kicker);
});

test("wide touch screens label the category tabs", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one wide touch context is enough");
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    isMobile: true,
    hasTouch: true,
    baseURL: testInfo.project.use.baseURL,
  });
  const page = await context.newPage();
  await page.goto("/zh/melee/");
  const labels = page.locator(".category-tabs .tab-label");
  await expect(labels).toHaveCount(7);
  const shown = await labels.evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      return getComputedStyle(el).opacity === "1" && box.width > 10 && box.height > 10;
    }),
  );
  expect(shown).toEqual(Array(7).fill(true));
  await context.close();
});

test("the details sheet closes on an outside tap or when the filter hides its item", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch interaction");
  await page.goto("/zh/melee/");
  const sheet = page.getByTestId("item-sheet");
  const link = cardNamed(page, "燃燒之刃").locator("a.item-link");
  await link.click();
  await expect(sheet).toBeVisible();
  await page.locator("h1").click();
  await expect(sheet).toBeHidden();
  await link.click();
  await expect(sheet).toBeVisible();
  await page.locator(".filter-text").fill("zzz-no-such-item");
  await expect(sheet).toBeHidden();
  await expect(page.locator(".filter-text")).toBeFocused();
});

test("the site uses the game's own icons", async ({ page, request }) => {
  await page.goto("/zh/");
  const icon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(icon).toBe("/icons/brand/favicon.png");
  expect((await request.get(icon ?? "")).status()).toBe(200);
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(touch ?? "")).status()).toBe(200);
});

test("weapon pages list the wiki's compatible effects with tier values and credit the wiki", async ({ page }) => {
  await page.goto("/zh/melee/axe/");
  await expect(page.getByTestId("unique-effect")).toHaveCount(0);
  const section = page.getByTestId("compatible-effects");
  const first = section.locator("tbody tr").first();
  await expect(section.locator("tbody tr")).toHaveCount(9);
  await expect(first).toContainText("致命鋒刃");
  await expect(first.locator(".tier-value")).toHaveText(["10%", "20%", "30%"]);
  await expect(first.locator("a[href='/zh/effect/#critical-edge']")).toBeVisible();
  const credit = page.getByTestId("effect-source");
  await expect(credit.locator("a[href='https://minecraft.wiki/w/Dungeons_II:Axe']")).toBeVisible();
  await expect(credit.locator("a[href='https://creativecommons.org/licenses/by-nc-sa/3.0/']")).toHaveText("CC BY-NC-SA 3.0");
});

test("unique weapons show their fixed effect with its value filled in", async ({ page }) => {
  await page.goto("/zh/melee/axe-unique1/");
  const fixed = page.getByTestId("unique-effect");
  await expect(fixed).toContainText("製箭師");
  await expect(fixed.locator(".fixed-desc .primary .value")).toHaveText("35%");
  await expect(fixed.locator(".fixed-desc .alt .value")).toHaveText("35%");
  await expect(fixed.locator("a[href='/zh/effect/#reconstruction']")).toBeVisible();
});

test("weapons the wiki has not covered yet say so instead of showing an empty table", async ({ page }) => {
  await page.goto("/zh/ranged/bow/");
  const section = page.getByTestId("compatible-effects");
  await expect(section).toContainText("Minecraft Wiki 尚未收錄");
  await expect(section.locator("table")).toHaveCount(0);
  await expect(page.getByTestId("effect-source").locator("a[href='https://minecraft.wiki/w/Dungeons_II:Bow']")).toBeVisible();
});

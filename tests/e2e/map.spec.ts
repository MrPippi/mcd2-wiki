import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers/overflow";

const filterPanel = (page: Page) => page.locator(".map-stage details.map-filters");
const kindToggle = (page: Page, kind: string) => page.locator(`.map-filter[data-kind='${kind}']`);

/** The marker filter starts folded on every screen; open it before using its toggles. */
async function openFilters(page: Page): Promise<void> {
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  if ((await filterPanel(page).getAttribute("open")) === null) await filterPanel(page).locator("summary").click();
  await expect(filterPanel(page)).toHaveAttribute("open", "");
}

const mapBox = (page: Page) => page.locator(".map-stage").boundingBox();

test("map page shows its title, world tabs and marker filters", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator("h1")).toHaveText("世界地圖");
  await expect(page.locator(".map-tabs a")).toHaveText([/主世界/, /隙浮/, /營地/]);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/主世界/);
  await expect(page.locator(".map-filter")).toHaveCount(9);
  for (const kind of ["rift", "quest-main", "quest-side", "storm", "talisman-chest", "dungeon"]) {
    await expect(page.locator(`[data-count='${kind}']`)).toHaveText(/^[1-9]\d*$/);
  }
  await expect(page.locator(".map-filter-label")).toContainText(["主線任務", "支線任務", "風暴產生器", "護符寶箱", "地下城"]);
});

test("the world tabs are the game's pixelated map crops, the active one framed and the others dimmed", async ({ page }) => {
  await page.goto("/zh/map/");
  const arts = page.locator(".map-tab-art");
  await expect(arts).toHaveCount(3);
  await expect(arts.first()).toHaveAttribute("src", /map\/tabs\/overworld\.webp$/);
  expect(await arts.first().evaluate((el) => getComputedStyle(el).imageRendering)).toBe("pixelated");
  const filter = (index: number) => arts.nth(index).evaluate((el) => getComputedStyle(el).filter);
  expect(await filter(0)).toBe("none");
  expect(await filter(1)).toContain("brightness(0.5)");
  await expect(page.locator(".map-tab-name").first()).toHaveText("主世界");
});

test("the Z and X keycaps flank the tabs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "keycap hints are hidden on touch screens");
  await page.goto("/zh/map/");
  const keys = page.locator(".map-key");
  await expect(keys).toHaveCount(2);
  await expect(keys.first()).toHaveAttribute("src", /map\/keys\/z\.png$/);
  await expect(keys.last()).toHaveAttribute("src", /map\/keys\/x\.png$/);
  const [z, first, last, x] = await Promise.all([keys.first().boundingBox(), page.locator(".map-tabs a").first().boundingBox(), page.locator(".map-tabs a").last().boundingBox(), keys.last().boundingBox()]);
  expect(z!.x + z!.width).toBeLessThanOrEqual(first!.x);
  expect(x!.x).toBeGreaterThanOrEqual(last!.x + last!.width);
});

test("X and Z switch to the next and previous world and keep the URL in step", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("x");
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "sift");
  await expect(page).toHaveURL(/\?world=sift/);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/隙浮/);
  await page.keyboard.press("x");
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "camp");
  await page.keyboard.press("z");
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "sift");
  await page.keyboard.press("z");
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "overworld");
});

test("Z and X are ignored while typing in the search box and with modifier keys", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("map-search").fill("");
  await page.getByTestId("map-search").press("x");
  await expect(page.getByTestId("map-search")).toHaveValue("x");
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "overworld");
  await page.locator(".map-stage").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Control+x");
  await page.keyboard.press("Shift+x");
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "overworld");
});

test("the empty area around the land is the game's fog sand", async ({ page }) => {
  await page.goto("/zh/map/");
  expect(await page.locator(".map-stage").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(210, 178, 135)");
});

test("an area's main and side quest pins each list only their own quests", async ({ page }) => {
  await page.goto("/zh/map/#4/4242/4046");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  // Spot pins are titled after their quest; only an area's pins carry the area's name.
  await expect(page.locator(".map-marker--quest-main[title='咆哮森林']")).toHaveCount(1);
  await page.locator(".map-marker--quest-side[title='咆哮森林']").click();
  const links = page.locator(".leaflet-popup-content .map-popup-quests a");
  await expect(links.first()).toHaveAttribute("href", /\/zh\/quests\/[a-z0-9-]+\/$/);
  const side = await links.count();
  await page.locator(".leaflet-popup-close-button").click();
  await page.locator(".map-marker--quest-main[title='咆哮森林']").click();
  const main = await links.count();
  expect(side).toBeGreaterThan(0);
  expect(main).toBeGreaterThan(0);
  expect(side + main).toBeGreaterThanOrEqual(5);
});

test("a storm generator pin names its area and says it is a possible spot", async ({ page }) => {
  await page.goto("/zh/map/#4/4047/3955");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await page.locator(".map-marker--storm[title='咆哮森林']").first().evaluate((el) => (el as HTMLElement).click());
  const popup = page.locator(".leaflet-popup-content .map-popup");
  await expect(popup.locator(".map-popup-kind")).toHaveText("風暴產生器");
  await expect(popup.locator(".map-popup-name")).toHaveText("咆哮森林");
  await expect(popup.locator(".map-popup-note")).toContainText("可能出現風暴產生器的位置");
});

test("a talisman chest pin links to the talisman it holds", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("幸運草");
  await page.getByTestId("map-results").getByRole("button", { name: /幸運草/ }).first().click();
  const popup = page.locator(".leaflet-popup-content .map-popup");
  await expect(popup.locator(".map-popup-kind")).toHaveText("護符寶箱");
  await expect(popup.locator(".map-popup-name a")).toHaveAttribute("href", /\/zh\/talisman\/[a-z0-9-]+\/$/);
});

test("dungeon pins are drawn and can be hidden with their filter", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".map-marker--dungeon").first()).toBeAttached();
  await openFilters(page);
  await kindToggle(page, "dungeon").click();
  await expect(page.locator(".map-marker--dungeon")).toHaveCount(0);
  await kindToggle(page, "dungeon").click();
  await expect(page.locator(".map-marker--dungeon").first()).toBeAttached();
});

test("the main quest filter hides main quest pins and keeps the side ones", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".map-marker--quest-main").first()).toBeAttached();
  await openFilters(page);
  await kindToggle(page, "quest-main").click();
  await expect(page.locator(".map-marker--quest-main")).toHaveCount(0);
  await expect(page.locator(".map-marker--quest-side").first()).toBeAttached();
});

test("the rift filter swatch is the game's icon", async ({ page }) => {
  await page.goto("/zh/map/");
  const swatch = kindToggle(page, "rift").locator(".map-swatch-icon");
  await expect(swatch).toHaveCount(1);
  await expect(swatch).toHaveJSProperty("tagName", "IMG");
  await expect(swatch).toHaveAttribute("src", /t_ui_icon_rift\.png$/);
});

test("the header menu links to the map", async ({ page }) => {
  await page.goto("/zh/melee/");
  await page.getByTestId("site-menu").click();
  await page.locator(".site-menu a", { hasText: "地圖" }).click();
  await expect(page).toHaveURL(/\/zh\/map\/(#.*)?$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the map page shows the world overview and says why it cannot zoom", async ({ page }) => {
    await page.goto("/zh/map/");
    await expect(page.locator(".map-fallback img")).toBeVisible();
    await expect(page.locator(".map-fallback")).toContainText("需要 JavaScript");
  });
});

test("the map page has no horizontal scroll on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/zh/map/");
  await expect(page.locator("h1")).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("the map loads tiles and markers", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(page.locator(".map-marker--minecart").first()).toBeAttached();
  await expect(page.locator(".map-fallback")).toBeHidden();
});

test("world tabs switch maps and record the world in the URL", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.locator(".map-tabs a", { hasText: "隙浮" }).click();
  await expect(page).toHaveURL(/\?world=sift/);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/隙浮/);
  await expect(page.locator("[data-count='rift']")).toHaveText("0");
  await page.locator(".map-tabs a", { hasText: "營地" }).click();
  await expect(page).toHaveURL(/\?world=camp/);
  // The camp has no stations or merchants, only the first quest's spots.
  await expect(page.locator(".map-marker:not(.map-marker--quest-main):not(.map-marker--quest-side)")).toHaveCount(0);
  await expect(page.locator(".map-marker--quest-main").first()).toBeAttached();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
});

test("an unknown world falls back to the overworld", async ({ page }) => {
  await page.goto("/zh/map/?world=nether");
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/主世界/);
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "overworld");
  await expect(page).toHaveURL(/\?world=overworld/);
});

test("a modified click on a world tab leaves the current map alone", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await page.locator(".map-tabs a", { hasText: "隙浮" }).click({ modifiers: ["Control"] });
  await page.waitForTimeout(300);
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "overworld");
  for (const other of page.context().pages()) if (other !== page) await other.close();
});

test("switching worlds does not reuse the previous world's view", async ({ page }) => {
  await page.goto("/zh/map/#5/7000/7000");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "5");
  await page.locator(".map-tabs a", { hasText: "隙浮" }).click();
  await expect(page.locator(".world-map")).toHaveAttribute("data-world", "sift");
  await expect(page.locator(".world-map")).not.toHaveAttribute("data-zoom", "5");
});

test("hiding a marker kind removes it and survives a reload", async ({ page }) => {
  await page.goto("/zh/map/");
  await expect(page.locator(".map-marker--rift").first()).toBeAttached();
  await openFilters(page);
  await kindToggle(page, "rift").click();
  await expect(page.locator(".map-marker--rift")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await expect(kindToggle(page, "rift")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".map-marker--minecart").first()).toBeAttached();
  await expect(page.locator(".map-marker--rift")).toHaveCount(0);
});

test("searching flies to a marker and opens its details", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("鐵匠");
  await page.getByTestId("map-results").getByRole("button", { name: /鐵匠/ }).click();
  await expect(page.locator(".leaflet-popup-content")).toContainText("鐵匠");
  await expect(page).toHaveURL(/#\d+\/\d+\/\d+$/);
});

test("a rift result does not repeat its kind label", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("裂隙");
  const first = page.getByTestId("map-results").locator("button").first();
  await expect(first).toBeVisible();
  await expect(first).not.toContainText("裂隙 · 裂隙");
});

test("a rift popup names the rift once", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("裂隙");
  await page.getByTestId("map-results").locator("button").first().click();
  const popup = page.locator(".leaflet-popup-content .map-popup");
  await expect(popup.locator(".map-popup-name")).toHaveText("裂隙");
  await expect(popup.locator(".map-popup-kind")).toHaveCount(0);
  expect((await popup.innerText()).split("裂隙").length - 1).toBe(1);
});

test("the Russian map renders markers and its search finds Russian and English names", async ({ page }) => {
  await page.goto("/ru/map/");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".map-marker--minecart").first()).toBeAttached();
  await page.getByTestId("map-search").fill("Кузнец");
  await expect(page.getByTestId("map-results").getByRole("button", { name: /Кузнец/ }).first()).toBeVisible();
  await page.getByTestId("map-search").fill("blacksmith");
  await expect(page.getByTestId("map-results").getByRole("button", { name: /Кузнец/ }).first()).toBeVisible();
  await page.getByTestId("map-results").getByRole("button", { name: /Кузнец/ }).first().click();
  await expect(page.locator(".leaflet-popup-content")).toContainText("Кузнец");
});

test("a search with no match says so", async ({ page }) => {
  await page.goto("/zh/map/");
  await page.getByTestId("map-search").fill("zzzz");
  await expect(page.getByTestId("map-empty")).toBeVisible();
  await expect(page.getByTestId("map-results").locator("button")).toHaveCount(0);
});

test("a shared view opens at the same zoom, and a broken one is pulled back in range", async ({ page }) => {
  await page.goto("/zh/map/#4/432/4416");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "4");
  await page.goto("/zh/map/#99/-50/99999");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "5");
  await page.goto("/zh/map/#abc");
  await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
});

test("language switch keeps the world and the view", async ({ page }) => {
  await page.goto("/zh/map/?world=sift#3/3000/5000");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "3");
  await page.getByTestId("lang-switch").click();
  await page.locator(".lang-picker a[data-lang='en']").click();
  await expect(page).toHaveURL(/\/en\/map\/\?world=sift#3\/\d+\/\d+$/);
  await expect(page.locator(".map-tabs [aria-current='page']")).toHaveText(/The Sift/);
});

test("area names appear only when zoomed in", async ({ page }) => {
  // The minimum zoom follows the panel; a small panel keeps it below the zoom where names appear (zMax - 3).
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto("/zh/map/#0/4096/4096");
  await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "1");
  await expect(page.locator(".world-map")).toHaveAttribute("data-labels", "off");
  await expect(page.locator(".map-marker--area").first()).toBeHidden();
  await page.goto("/zh/map/#4/432/4416");
  await expect(page.locator(".world-map")).toHaveAttribute("data-labels", "on");
});

test("area labels do not capture clicks meant for the pin beneath", async ({ page }) => {
  await page.goto("/zh/map/#4/432/4416");
  await expect(page.locator(".map-marker--area").first()).toBeAttached();
  await expect(page.locator(".map-marker--area.leaflet-interactive")).toHaveCount(0);
});

test("area names are not a marker filter", async ({ page }) => {
  await page.goto("/zh/map/");
  // Plain 「區域」 (the area names) must not be a filter.
  expect(await page.locator(".map-filter-label").allTextContents()).not.toContain("區域");
  await expect(kindToggle(page, "area")).toHaveCount(0);
});

test("area labels are plain text with no icon", async ({ page }) => {
  await page.goto("/zh/map/#4/432/4416");
  const label = page.locator(".map-marker--area .map-label").first();
  await expect(label).toBeVisible();
  await expect(label).toHaveText(/\S/);
  await expect(page.locator(".map-marker--area img")).toHaveCount(0);
});

test.describe("marker filter on the map", () => {
  test("starts folded on a desktop screen, still floating on the map", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zh/map/");
    await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
    await expect(filterPanel(page)).toBeVisible();
    await expect(filterPanel(page)).not.toHaveAttribute("open", "");
    await expect(kindToggle(page, "rift")).toBeHidden();
    await filterPanel(page).locator("summary").click();
    await expect(kindToggle(page, "rift")).toBeVisible();
  });

  test("sits inside the map box and toggles a kind by colour", async ({ page }) => {
    await page.goto("/zh/map/");
    await openFilters(page);
    await expect(page.locator(".map-panel .map-filters")).toHaveCount(0);
    const stage = await mapBox(page);
    const panel = await filterPanel(page).boundingBox();
    expect(stage && panel).toBeTruthy();
    expect(panel!.x).toBeGreaterThanOrEqual(stage!.x);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 0.5);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 0.5);
    const rift = kindToggle(page, "rift");
    await expect(rift).toHaveAttribute("aria-pressed", "true");
    await expect(rift).toContainText("裂隙");
    await expect(rift.locator(".map-count")).toHaveText(/^[1-9]\d*$/);
    expect(await rift.locator(".map-swatch-icon").evaluate((el) => getComputedStyle(el).filter)).not.toContain("grayscale");
    await rift.click();
    await expect(rift).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => rift.locator(".map-swatch-icon").evaluate((el) => getComputedStyle(el).filter)).toContain("grayscale");
    await expect(page.locator(".map-marker--rift")).toHaveCount(0);
    await expect(page.locator(".map-marker--minecart").first()).toBeAttached();
    await rift.press("Enter");
    await expect(rift).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".map-marker--rift").first()).toBeAttached();
  });

  test("does not zoom the map when scrolling over it", async ({ page }) => {
    await page.goto("/zh/map/#3/4096/4096");
    await openFilters(page);
    await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "3");
    await kindToggle(page, "rift").hover();
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(400);
    await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "3");
  });

  test("leaves a large map on a desktop screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/zh/map/");
    await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
    const box = await mapBox(page);
    expect(box!.width).toBeGreaterThanOrEqual(1150);
    expect(box!.height).toBeGreaterThanOrEqual(640);
    const leaflet = await page.locator(".leaflet-container").boundingBox();
    expect(Math.abs(leaflet!.width - box!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(leaflet!.height - box!.height)).toBeLessThanOrEqual(2);
  });

  test("folds away on a phone and opens from its button", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/zh/map/");
    await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
    const box = await mapBox(page);
    expect(box!.width).toBeGreaterThanOrEqual(320);
    expect(box!.height).toBeGreaterThanOrEqual(600);
    await expect(filterPanel(page)).not.toHaveAttribute("open", "");
    await expect(kindToggle(page, "rift")).toBeHidden();
    await filterPanel(page).locator("summary").click();
    await expect(kindToggle(page, "rift")).toBeVisible();
    await kindToggle(page, "merchant").click();
    await expect(page.locator(".map-marker--merchant")).toHaveCount(0);
    await filterPanel(page).locator("summary").click();
    await expect(kindToggle(page, "rift")).toBeHidden();
  });
});

test.describe("zoom limits and popups", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("zooming out stops once the render fills the panel", async ({ page }) => {
    await page.goto("/zh/map/#0/4096/4096");
    const root = page.locator(".world-map");
    await expect(root).toHaveAttribute("data-ready", "true");
    const zoom = Number(await root.getAttribute("data-zoom"));
    expect(zoom).toBeGreaterThanOrEqual(1);
    await expect(page.locator(".leaflet-control-zoom-out")).toHaveClass(/leaflet-disabled/);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const canvas = document.querySelector(".map-canvas")!.getBoundingClientRect();
          const tiles = [...document.querySelectorAll(".leaflet-tile-loaded")].map((tile) => tile.getBoundingClientRect());
          if (tiles.length === 0) return false;
          const left = Math.min(...tiles.map((t) => t.left));
          const top = Math.min(...tiles.map((t) => t.top));
          const right = Math.max(...tiles.map((t) => t.right));
          const bottom = Math.max(...tiles.map((t) => t.bottom));
          return left <= canvas.left + 1 && top <= canvas.top + 1 && right >= canvas.right - 1 && bottom >= canvas.bottom - 1;
        }),
      )
      .toBe(true);
  });

  test("zooming in stops at the top zoom", async ({ page }) => {
    await page.goto("/zh/map/#99/4096/4096");
    await expect(page.locator(".world-map")).toHaveAttribute("data-zoom", "5");
    await expect(page.locator(".leaflet-control-zoom-in")).toHaveClass(/leaflet-disabled/);
  });

  test("a marker popup is wide enough to read", async ({ page }) => {
    await page.goto("/zh/map/");
    await expect(page.locator(".world-map")).toHaveAttribute("data-ready", "true");
    await page.locator(".map-marker--rift").first().click();
    const content = page.locator(".leaflet-popup-content");
    await expect(content).toBeVisible();
    expect((await content.boundingBox())!.width).toBeGreaterThanOrEqual(200);
  });

  test("the world tabs do not scroll vertically", async ({ page }) => {
    await page.goto("/zh/map/");
    const overflow = await page.locator(".map-tabs ol").evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

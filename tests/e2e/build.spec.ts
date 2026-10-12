import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const slot = (page: Page, key: string) => page.getByTestId(`build-slot-${key}`);

async function pick(page: Page, key: string, name: string): Promise<void> {
  await slot(page, key).locator("[data-pick]").click();
  const dialog = page.getByTestId("build-dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("build-filter").fill(name);
  await dialog.getByRole("button", { name, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe("build planner", () => {
  test("shows the planner and hides the failure note", async ({ page }) => {
    await page.goto("/en/build/");
    await expect(page.getByTestId("build-planner")).toBeVisible();
    await expect(page.getByTestId("build-failed")).toBeHidden();
    await expect(slot(page, "melee")).toContainText("Choose…");
  });

  test("picking an item fills the slot, links its page and writes the URL", async ({ page }) => {
    await page.goto("/en/build/");
    await pick(page, "melee", "Axe");
    await expect(slot(page, "melee")).toContainText("Axe");
    await expect(slot(page, "melee").locator("[data-link]")).toHaveAttribute("href", "/en/melee/axe/");
    await expect(page).toHaveURL(/\/en\/build\/\?v=1&gv=[^&]+&m=axe$/);
  });

  test("a shared link opens the same build", async ({ page }) => {
    await page.goto("/en/build/?v=1&m=axe&r=bow&a=blizzard-staff,,corrupted-beacon&t=brawling");
    await expect(slot(page, "melee")).toContainText("Axe");
    await expect(slot(page, "ranged")).toContainText("Bow");
    await expect(slot(page, "artifact1")).toContainText("Winter Staff");
    await expect(slot(page, "artifact2")).toContainText("Choose…");
    await expect(slot(page, "artifact3")).toContainText("Corrupted Beacon");
    await expect(slot(page, "talisman1")).toContainText("Fist of Iron");
    await expect(page.getByTestId("build-notice")).toBeHidden();
  });

  test("says how many items of a link no longer exist", async ({ page }) => {
    await page.goto("/en/build/?v=1&m=axe&r=not-a-bow&h=dragon");
    await expect(slot(page, "melee")).toContainText("Axe");
    await expect(page.getByTestId("build-notice")).toHaveText("Items that could not be placed (gone from the game or repeated): 2");
  });

  test("drops unreadable items from the address and clears the notice on the next change", async ({ page }) => {
    await page.goto("/en/build/?ref=discord&v=1&m=axe&h=dragon");
    await expect(page).toHaveURL(/\/en\/build\/\?ref=discord&v=1&gv=[^&]+&m=axe$/);
    await expect(page.getByTestId("build-notice")).toBeVisible();
    await pick(page, "ranged", "Bow");
    await expect(page.getByTestId("build-notice")).toBeHidden();
    await expect(page).toHaveURL(/\/en\/build\/\?ref=discord&v=1&gv=[^&]+&m=axe&r=bow$/);
  });

  test("keeps the list commas readable in the address", async ({ page }) => {
    await page.goto("/en/build/");
    await pick(page, "artifact3", "Winter Staff");
    await expect(page).toHaveURL(/\/en\/build\/\?v=1&gv=[^&]+&a=,,blizzard-staff$/);
  });

  test("a click inside the picker keeps it open; the backdrop closes it", async ({ page }) => {
    await page.goto("/en/build/");
    await slot(page, "melee").locator("[data-pick]").click();
    const dialog = page.getByTestId("build-dialog");
    await page.getByTestId("build-filter").fill("Axe");
    const box = (await dialog.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + box.height - 4); // inside the dialog, below the results
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("build-filter")).toHaveValue("Axe");
    const viewport = page.viewportSize()!;
    test.skip(box.width >= viewport.width - 8, "the picker fills the screen on phones: no backdrop to click");
    await page.mouse.click(4, viewport.height - 4);
    await expect(dialog).toBeHidden();
  });

  test("clearing a slot keeps keyboard focus on that slot", async ({ page }) => {
    await page.goto("/en/build/?v=1&m=axe");
    await slot(page, "melee").locator("[data-clear]").focus();
    await page.keyboard.press("Enter");
    await expect(slot(page, "melee").locator("[data-pick]")).toBeFocused();
  });

  test("picking returns focus to the slot", async ({ page }) => {
    await page.goto("/en/build/");
    await pick(page, "ranged", "Bow");
    await expect(slot(page, "ranged").locator("[data-pick]")).toBeFocused();
  });

  test("shows the game version and warns about a build made for another one", async ({ page }) => {
    const { version } = JSON.parse(await readFile("scripts/extract/game-version.json", "utf8")) as { version: string };
    await page.goto("/en/build/?v=1&gv=0.9.0.0&m=axe");
    await expect(page.getByTestId("build-game-version")).toHaveText(`Game version ${version}`);
    await expect(page.getByTestId("build-notice")).toContainText(`game version 0.9.0.0; the data is now ${version}`);
    await expect(slot(page, "melee")).toContainText("Axe");
    await pick(page, "ranged", "Bow");
    await expect(page.getByTestId("build-notice")).toBeHidden();
    expect(new URL(page.url()).searchParams.get("gv")).toBe(version);
  });

  test("a link for the current game version shows no notice", async ({ page }) => {
    const { version } = JSON.parse(await readFile("scripts/extract/game-version.json", "utf8")) as { version: string };
    await page.goto(`/en/build/?v=1&gv=${version}&m=axe`);
    await expect(slot(page, "melee")).toContainText("Axe");
    await expect(page.getByTestId("build-notice")).toBeHidden();
  });

  test("has three artifact slots and drops a fourth from a link", async ({ page }) => {
    await page.goto("/en/build/?v=1&a=blizzard-staff,carapace-ocarina,corrupted-beacon,conductive-bracelet");
    await expect(page.locator("[data-slot^='artifact']")).toHaveCount(3);
    await expect(slot(page, "artifact3")).toContainText("Corrupted Beacon");
    await expect(page.getByTestId("build-notice")).toContainText(": 1");
  });

  test.describe("enchantments", () => {
    const enchantRow = (page: Page, key: string) => page.getByTestId(`build-enchant-${key}`);

    test("an empty slot offers no enchantment; a filled one does", async ({ page }) => {
      await page.goto("/en/build/");
      await expect(enchantRow(page, "melee")).toBeHidden();
      await pick(page, "melee", "Axe");
      await expect(enchantRow(page, "melee")).toBeVisible();
      await expect(enchantRow(page, "melee")).toContainText("Add enchantment");
    });

    test("artifacts and talismans take no enchantment", async ({ page }) => {
      await page.goto("/en/build/?v=1&a=blizzard-staff&t=brawling");
      await expect(page.getByTestId("build-enchant-artifact1")).toHaveCount(0);
      await expect(page.getByTestId("build-enchant-talisman1")).toHaveCount(0);
    });

    test("picking an enchantment and its level writes slug:level to the address", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=axe");
      await enchantRow(page, "melee").locator("[data-enchant-pick]").click();
      await page.getByTestId("build-filter").fill("Fire Aspect");
      await page.getByTestId("build-dialog").getByRole("button", { name: "Fire Aspect", exact: true }).click();
      await expect(enchantRow(page, "melee")).toContainText("Fire Aspect");
      await expect(page).toHaveURL(/&m=axe&e=fire-aspect:1$/);
      await expect(enchantRow(page, "melee").locator("[data-enchant-pick]")).toBeFocused();
      await enchantRow(page, "melee").locator("[data-tier]").selectOption("3");
      await expect(page).toHaveURL(/&m=axe&e=fire-aspect:3$/);
    });

    test("only offers enchantments that fit the slot", async ({ page }) => {
      await page.goto("/en/build/?v=1&r=bow&c=cave-crawler-chest");
      await enchantRow(page, "ranged").locator("[data-enchant-pick]").click();
      const options = page.getByTestId("build-options");
      await expect(options.getByRole("button", { name: "Ricochet", exact: true })).toBeVisible();
      await expect(options.getByRole("button", { name: "Fire Aspect", exact: true })).toHaveCount(0);
      await page.getByTestId("build-dialog").locator("[data-close]").click();
      await enchantRow(page, "chest").locator("[data-enchant-pick]").click();
      await expect(options.getByRole("button", { name: "Bottomless Brew", exact: true })).toBeVisible();
    });

    test("a shared link restores enchantments, and clearing the item removes its enchantment", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=axe&h=cave-crawler-helmet&e=fire-aspect:2,,multi-roll:3");
      await expect(enchantRow(page, "melee")).toContainText("Fire Aspect");
      await expect(enchantRow(page, "melee").locator("[data-tier]")).toHaveValue("2");
      await expect(enchantRow(page, "helmet")).toContainText("Somersault");
      await slot(page, "melee").locator("[data-clear]").click();
      await expect(enchantRow(page, "melee")).toBeHidden();
      await expect(page).toHaveURL(/&h=cave-crawler-helmet&e=,,multi-roll:3$/);
    });

    test("swapping the item keeps the enchantment; the picker marks the current one", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=axe&e=fire-aspect:2");
      await pick(page, "melee", "Battlestaff");
      await expect(enchantRow(page, "melee")).toContainText("Fire Aspect");
      await expect(page).toHaveURL(/&m=battlestaff&e=fire-aspect:2$/);
      await enchantRow(page, "melee").locator("[data-enchant-pick]").click();
      await expect(page.getByTestId("build-options").locator("[aria-current='true']")).toContainText("Fire Aspect");
    });

    test("the enchantment button names its slot and its current enchantment", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=axe&e=fire-aspect:2");
      await expect(enchantRow(page, "melee").locator("[data-enchant-pick]")).toHaveAccessibleName(/Melee.*Enchantment.*Fire Aspect/);
    });

    test("removing an enchantment keeps the item", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=axe&e=fire-aspect:2");
      await enchantRow(page, "melee").locator("[data-enchant-clear]").click();
      await expect(enchantRow(page, "melee")).toContainText("Add enchantment");
      await expect(enchantRow(page, "melee").locator("[data-enchant-pick]")).toBeFocused();
      await expect(page).toHaveURL(/&m=axe$/);
    });

    test("an enchantment that does not fit its slot is dropped from a link", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=axe&e=ricochet:1");
      await expect(enchantRow(page, "melee")).toContainText("Add enchantment");
      await expect(page.getByTestId("build-notice")).toContainText(": 1");
    });

    test("a unique weapon shows the bonus it always carries", async ({ page }) => {
      await page.goto("/en/build/?v=1&m=sword-unique1");
      await expect(page.getByTestId("build-fixed-melee")).toHaveText("Built in: Pyromancer");
      await page.goto("/en/build/?v=1&m=axe");
      await expect(page.getByTestId("build-fixed-melee")).toBeHidden();
    });
  });

  test("opens a link from another version empty", async ({ page }) => {
    await page.goto("/en/build/?v=9&m=axe");
    await expect(slot(page, "melee")).toContainText("Choose…");
    await expect(page.getByTestId("build-notice")).toContainText("another version");
  });

  test("a whole armor set fills all four pieces", async ({ page }) => {
    await page.goto("/en/build/");
    await page.getByTestId("build-whole-set").click();
    const first = page.getByTestId("build-options").locator("button").first();
    await first.click();
    for (const key of ["helmet", "chest", "leggings", "boots"]) await expect(slot(page, key)).toHaveAttribute("data-filled", "true");
    await expect(page).toHaveURL(/[?&]h=.+&c=.+&l=.+&b=/);
  });

  test("an artifact in one slot cannot be picked again in another", async ({ page }) => {
    await page.goto("/en/build/?v=1&a=blizzard-staff");
    await slot(page, "artifact2").locator("[data-pick]").click();
    await page.getByTestId("build-filter").fill("Winter Staff");
    await expect(page.getByTestId("build-options").getByRole("button", { name: /Winter Staff/ })).toBeDisabled();
  });

  test("the search finds an item by its comparison-language name", async ({ page }) => {
    await page.goto("/zh/build/");
    await slot(page, "melee").locator("[data-pick]").click();
    await page.getByTestId("build-filter").fill("axe");
    await expect(page.getByTestId("build-options").locator("button").first()).toBeVisible();
    await page.getByTestId("build-filter").fill("zzzz-nothing");
    await expect(page.getByTestId("build-options").locator("button")).toHaveCount(0);
    await expect(page.getByTestId("build-dialog").locator("[data-empty]")).toBeVisible();
    // The first Escape clears the search box (the browser's own behaviour), the next closes the dialog.
    await page.getByTestId("build-filter").fill("");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("build-dialog")).toBeHidden();
  });

  test("clearing a slot and the whole build updates the URL", async ({ page }) => {
    await page.goto("/en/build/?v=1&m=axe&r=bow");
    await slot(page, "melee").locator("[data-clear]").click();
    await expect(page).toHaveURL(/\/en\/build\/\?v=1&gv=[^&]+&r=bow$/);
    await page.getByTestId("build-reset").click();
    await expect(page).toHaveURL(/\/en\/build\/$/);
    await expect(slot(page, "ranged")).toContainText("Choose…");
  });

  test("the language links keep the build", async ({ page }) => {
    await page.goto("/en/build/");
    await pick(page, "melee", "Axe");
    const ja = page.locator('a[data-lang="ja"]').first();
    await expect(ja).toHaveAttribute("href", /\/ja\/build\/\?v=1&gv=[^&]+&m=axe$/);
  });

  test("copies the link", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/en/build/?v=1&m=axe");
    await page.getByTestId("build-copy").click();
    await expect(page.getByTestId("build-status")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/en\/build\/\?v=1&m=axe$/);
  });

  test("falls back to a selectable address when copying fails", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    });
    await page.goto("/en/build/?v=1&m=axe");
    await page.getByTestId("build-copy").click();
    await expect(page.getByTestId("build-url")).toBeVisible();
    await expect(page.getByTestId("build-url")).toHaveValue(/\/en\/build\/\?v=1&m=axe$/);
  });

  test("downloads the build as a 1200×630 PNG", async ({ page }) => {
    await page.goto("/en/build/?v=1&m=axe&r=bow");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("build-download").click()]);
    expect(download.suggestedFilename()).toBe("mcd2-build.png");
    const bytes = await readFile((await download.path())!);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });

  test("the site menu links the planner", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator('a[href="/en/build/"]').first()).toBeAttached();
  });

  for (const lang of ["zh", "de", "ru"]) {
    test(`does not scroll sideways at 412px (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await page.goto(`/${lang}/build/?v=1&m=axe-unique1&r=bow-unique1&a=blizzard-staff,carapace-ocarina,corrupted-beacon&t=ammo-capacity,artifact-cooldown,brawling`);
      await expect(page.getByTestId("build-planner")).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
      await slot(page, "melee").locator("[data-pick]").click();
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("explains the planner needs JavaScript", async ({ page }) => {
    await page.goto("/en/build/");
    await expect(page.getByTestId("build-noscript")).toBeVisible();
    await expect(page.getByTestId("build-planner")).toBeHidden();
  });
});

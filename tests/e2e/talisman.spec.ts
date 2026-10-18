import { expect, test } from "@playwright/test";

const PAGES = [
  { lang: "zh", text: "藥水的冷卻時間縮短", secret: "秘密護符", maxLevel: "最高等級" },
  { lang: "ja", text: "ポーションのクールダウン時間", secret: "秘密のタリスマン", maxLevel: "最大レベル" },
] as const;

for (const { lang, text, secret, maxLevel } of PAGES) {
  test(`a talisman page shows its description, level values and secret badge (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/talisman/potion-cooldown/`);
    const description = page.locator(".description .primary");
    await expect(description).toContainText(text);
    await expect(description.locator(".value")).toHaveText("10%~25%");
    const levels = page.getByTestId("talisman-levels");
    await expect(levels.locator("tbody tr")).toHaveCount(3);
    await expect(levels.getByTestId("level-value")).toHaveText(["10%", "15%", "25%"]);
    await expect(levels.locator(".lang-text")).toHaveCount(0);
    await expect(levels.locator("tbody tr").first()).toContainText("18480");
    await expect(levels.locator("tbody tr").nth(2)).toContainText(maxLevel);
    await expect(page.getByTestId("secret-talisman")).toHaveText(secret);
    await expect(page.locator(".placeholder")).toHaveCount(0);
  });
}

test("a companion talisman shows its cooldown and per-level multipliers", async ({ page }) => {
  await page.goto("/zh/talisman/wolf/");
  const levels = page.getByTestId("talisman-levels");
  await expect(levels).toContainText("30 秒");
  await expect(levels.locator("tbody tr").nth(2)).toContainText("×1.65");
  await expect(page.getByTestId("secret-talisman")).toHaveCount(0);
});

test("a talisman whose game translation misreads a percentage shows the corrected sentence", async ({ page }) => {
  await page.goto("/zh/talisman/ammo-capacity/");
  await expect(page.locator(".description .primary")).toHaveText("箭矢攜帶量提高 20%~60%。");
  await expect(page.getByTestId("info-box").locator(".tag.warn")).toHaveCount(0);
  await page.goto("/zh/effect/");
  await expect(page.locator("tr", { has: page.locator("#ammo-capacity") })).toContainText("箭矢攜帶量提高");
});

test("talismans whose values are not in the game data show unknown markers and a note", async ({ page }) => {
  await page.goto("/zh/talisman/speed-increment/");
  const description = page.locator(".description .primary");
  await expect(description).toContainText("Increases movement speed by");
  await expect(description.locator(".unknown-value")).toHaveText(["?", "?"]);
  await expect(page.getByTestId("values-unknown")).toContainText("數值不在遊戲資料檔中");
  await expect(page.getByTestId("info-box").locator(".tag.warn")).toHaveText("未翻譯");
  await expect(page.getByTestId("secret-talisman")).toHaveText("秘密護符");
  await expect(page.locator(".placeholder")).toHaveCount(0);
});

test("every talisman page has a description and no unfilled placeholder", async ({ page }) => {
  await page.goto("/zh/talisman/");
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    [...new Set(links.map((link) => link.getAttribute("href") ?? "").filter((href) => /\/zh\/talisman\/[a-z0-9-]+\/$/.test(href)))],
  );
  expect(hrefs).toHaveLength(24);
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.locator(".description .primary"), href).toBeVisible();
    await expect(page.locator(".placeholder"), href).toHaveCount(0);
    await expect(page.getByTestId("talisman-levels"), href).toBeVisible();
  }
});

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
    await expect(levels.locator("tbody tr").first().locator(".primary .value")).toHaveText("10%");
    await expect(levels.locator("tbody tr").nth(2).locator(".primary .value")).toHaveText("25%");
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

test("every talisman page has a description and no unfilled placeholder", async ({ page }) => {
  await page.goto("/zh/talisman/");
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    [...new Set(links.map((link) => link.getAttribute("href") ?? "").filter((href) => /\/zh\/talisman\/[a-z0-9-]+\/$/.test(href)))],
  );
  expect(hrefs.length).toBeGreaterThanOrEqual(21);
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.locator(".description .primary"), href).toBeVisible();
    await expect(page.locator(".placeholder"), href).toHaveCount(0);
    await expect(page.getByTestId("talisman-levels"), href).toBeVisible();
  }
});

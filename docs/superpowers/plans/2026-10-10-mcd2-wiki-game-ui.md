# 遊戲風格改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把網站改成遊戲 UI 風格：深藍綠配色與像素字型、遊戲物品欄分頁導覽、物品欄＋說明面板列表、資訊欄條目頁、標題橫幅首頁，並改善手機體驗。

**Architecture:** 只改 `src/`（Astro 頁面、元件、樣式）與測試；資料、抽取管線、網址不變。樣式拆成多個小 CSS 檔由 `Base.astro` 依序匯入；過渡期保留 `legacy.css`，新樣式檔排在其後覆蓋，最後一個任務刪除它。互動（分頁快捷鍵、說明面板、底部面板、語言切換保留查詢）用 Astro 元件內的原生 TS 腳本，判斷邏輯抽成可單元測試的純函式。

**Tech Stack:** Astro 7、TypeScript、原生 CSS、`@fontsource/silkscreen`、俐方體 11 號（自行託管）、Vitest 5、Playwright 1.64、Pagefind 1.5。

**Spec:** `docs/superpowers/specs/2026-10-10-mcd2-wiki-game-ui-design.md`

## Global Constraints

- 分支：`feat/game-ui`（已從 `master` 建立）。完成後開新 PR 到 `master`；不直接推 `master`。
- 不改 `scripts/extract/**`、`src/data/**`、`public/icons/**`、網址結構。
- 不新增前端框架或 CSS 框架；唯一新增的套件是 `@fontsource/silkscreen@^5`。
- 配色 token（逐字）：`--bg #0b1a20`、`--surface #10222a`、`--surface-2 #1c2b31`、`--border #2c3b42`、`--text #e8e2d8`、`--muted #8fa3aa`、`--accent #ff7e2f`、`--link #8fd6e0`、`--radius 0`。
- 字型：中文像素字 `Cubic11`（`src/assets/fonts/cubic-11/Cubic_11.woff2`，經 Vite 打包）、英文標籤 `Silkscreen`、內文系統字型；`font-display: swap`。授權檔 `public/licenses/Cubic-11-OFL.txt`，頁尾連結。
- 斷點：版面兩欄 ≥ 900px；分頁列手機樣式 < 700px；說明面板依 `(hover: hover)`／`(hover: none)` 切換互動。
- 既有物品格／外框樣式（`frames`）、獨特標記、中英對照、搜尋、篩選、未發布分類 404 全部維持。
- 預覽與 E2E 埠號 4329（4321 屬於使用者另一個專案）。
- 每個 commit 用 conventional commits；不加任何 attribution 行。
- 檔案 ≤ 400 行、函式 < 50 行。

## Review Focus

1. **網站部署在子路徑**（`BASE_PATH=/mcd2-wiki/`）→ 字型檔與授權連結都要帶 base；不能寫死 `/fonts/...`。（Task 7）
2. **在任何輸入框中打字**（標題列搜尋、首頁搜尋、Pagefind 搜尋框、篩選框）→ 按 Q／E 不切換分類；鍵盤 Tab 到物品時說明面板跟著更新，Enter 進入條目頁。（Task 3、Task 5）
3. **JavaScript 未執行或載入失敗** → 物品仍是一般連結、可直接進條目頁；底部面板保持隱藏。（Task 5）
4. **關閉中英對照後** → 從 template 複製到說明面板／底部面板的英文對照也要隱藏。（Task 5）
5. **手機底部面板內容很長** → 面板可捲動，「查看」按鈕仍可見可點。（Task 5）

---

## File Structure

```
src/
├─ assets/fonts/cubic-11/Cubic_11.woff2        新增（Task 1）
├─ styles/
│   ├─ tokens.css   新增：配色、字型（Task 1）
│   ├─ base.css     新增：reset、排版、按鈕、輸入框、面板、kicker、區塊標題、tag（Task 1）
│   ├─ frames.css   新增：物品格與外框（自 global.css 原樣搬移）（Task 1）
│   ├─ legacy.css   過渡：舊版面規則（Task 1 建立，Task 7 刪除）
│   ├─ layout.css   新增：標題列、分類分頁、主內容、頁尾（Task 3）
│   ├─ home.css     新增（Task 4）
│   ├─ items.css    新增：物品網格、說明面板、底部面板、篩選列、效果表格（Task 5、7）
│   ├─ entry.css    新增：條目頁兩欄、資訊欄、區塊、相關、套裝、附魔書（Task 6）
│   └─ search.css   新增：Pagefind 配色（Task 7）
├─ lib/tabs.ts, lang-switch.ts, kicker.ts       新增純函式（Task 2）
├─ lib/related.ts                                修改：加 icon/category/variant（Task 6）
├─ lib/i18n.ts                                   修改：新增 UI 字串（Task 2）
├─ components/
│   ├─ SiteHeader.astro, CategoryTabs.astro      新增（Task 3）
│   ├─ HomeHero.astro                            新增（Task 4）
│   ├─ ItemCard.astro, TooltipPanel.astro, ItemBrowser.astro   新增（Task 5）；刪除 EntryCard.astro
│   ├─ InfoBox.astro, EntrySection.astro         新增（Task 6）
│   ├─ EntryDetail.astro, BookSource.astro, EntryIcon.astro    修改（Task 6）
│   └─ EntryTable.astro                          修改（Task 7）
├─ layouts/Base.astro                            修改（Task 1、3–7）
└─ pages/…                                       修改（Task 3–7）
public/licenses/Cubic-11-OFL.txt                 新增（Task 1）
tests/unit/site/tabs.test.ts, lang-switch.test.ts, kicker.test.ts   新增（Task 2）
tests/e2e/wiki.spec.ts                           修改（每個任務）
```

---

### Task 1: 配色、字型與樣式檔拆分

**Files:**
- Create: `src/assets/fonts/cubic-11/Cubic_11.woff2`, `public/licenses/Cubic-11-OFL.txt`, `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/frames.css`, `src/styles/legacy.css`
- Modify: `.gitignore`, `package.json`, `src/layouts/Base.astro`
- Delete: `src/styles/global.css`
- Test: `tests/e2e/wiki.spec.ts`

**Interfaces:**
- Produces: CSS 變數 `--bg --surface --surface-2 --border --text --muted --accent --link --danger --radius --max --font-body --font-pixel --font-label`；共用 class `.panel .panel-bar .kicker .section-title .section-en .sr-only .button .tag .count .note`。

- [ ] **Step 1: 寫失敗 E2E 測試（附加到 `tests/e2e/wiki.spec.ts` 結尾）**

```ts
test("the game palette and self-hosted fonts are in use", async ({ page, request }) => {
  await page.goto("/zh/");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(11, 26, 32)");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return { pixel: document.fonts.check("16px Cubic11", "劍"), label: document.fonts.check("16px Silkscreen", "A") };
  });
  expect(fonts).toEqual({ pixel: true, label: true });
  expect((await request.get("/licenses/Cubic-11-OFL.txt")).status()).toBe(200);
});
```

- [ ] **Step 2: 建置並執行，確認失敗**

Run: `npm run build && npx playwright test --project=chromium --reporter=line -g "game palette"`
Expected: FAIL（背景色為 `rgb(21, 18, 28)`）。

- [ ] **Step 3: 下載字型與授權、安裝 Silkscreen、忽略 `.superpowers/`**

```bash
mkdir -p src/assets/fonts/cubic-11 public/licenses
curl -fsSL -o src/assets/fonts/cubic-11/Cubic_11.woff2 "https://cdn.jsdelivr.net/gh/ACh-K/Cubic-11@main/fonts/web/Cubic_11.woff2"
curl -fsSL -o public/licenses/Cubic-11-OFL.txt "https://cdn.jsdelivr.net/gh/ACh-K/Cubic-11@main/OFL.txt"
npm install @fontsource/silkscreen@^5
printf '\n# Brainstorm companion and workflow scratch\n.superpowers/\n' >> .gitignore
```
Expected: woff2 約 400 KB；`OFL.txt` 開頭為 `Copyright`；`package.json` 出現 `@fontsource/silkscreen`。

- [ ] **Step 4: 建立 `src/styles/tokens.css`**

```css
@font-face {
  font-family: "Cubic11";
  src: url("../assets/fonts/cubic-11/Cubic_11.woff2") format("woff2");
  font-display: swap;
}

:root {
  color-scheme: dark;
  --bg: #0b1a20;
  --surface: #10222a;
  --surface-2: #1c2b31;
  --border: #2c3b42;
  --text: #e8e2d8;
  --muted: #8fa3aa;
  --accent: #ff7e2f;
  --link: #8fd6e0;
  --danger: #e06666;
  --radius: 0;
  --max: 1180px;
  --font-body: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
  --font-pixel: "Cubic11", var(--font-body);
  --font-label: "Silkscreen", "Cubic11", monospace;
}
```

- [ ] **Step 5: 建立 `src/styles/base.css`**

```css
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { background: var(--bg); }
body { margin: 0; color: var(--text); font-family: var(--font-body); line-height: 1.7; }
a { color: var(--link); }
h1, h2, h3 { font-family: var(--font-pixel); font-weight: 400; line-height: 1.3; }
h1 { font-size: 2rem; text-shadow: 2px 2px 0 #000; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

button, .button {
  font: inherit; background: var(--surface-2); color: var(--text); border: 2px solid var(--border);
  border-radius: var(--radius); padding: 4px 10px; cursor: pointer; text-decoration: none;
}
button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
input[type="search"] {
  font: inherit; padding: 6px 10px; background: var(--bg); color: var(--text);
  border: 2px solid var(--border); border-radius: var(--radius);
}
input[type="search"]:focus, button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.lang-text { display: inline-flex; flex-direction: column; }
.lang-text .alt { color: var(--muted); font-size: 0.85em; font-weight: 400; font-family: var(--font-body); }
h1.lang-text .alt { font-size: 0.5em; text-shadow: none; }
[data-compare="off"] .lang-text .alt { display: none; }

.ui-icon { width: 1.15em; height: 1.15em; object-fit: contain; image-rendering: pixelated; vertical-align: -0.2em; flex-shrink: 0; }

.panel { background: var(--surface); border: 2px solid var(--border); }
.panel-bar {
  background: var(--surface-2); border-bottom: 2px solid var(--border); font-family: var(--font-label);
  letter-spacing: 2px; text-align: center; padding: 4px 8px; font-size: 0.8rem; color: #cfd6d8;
}
.kicker { font-family: var(--font-label); font-size: 0.75rem; letter-spacing: 1px; color: var(--muted); margin: 0; }
.section-title {
  display: flex; align-items: baseline; gap: 10px; font-size: 1.15rem;
  border-bottom: 1px solid var(--border); padding-bottom: 4px; margin: 24px 0 10px;
}
.section-en { font-family: var(--font-label); font-size: 0.7rem; letter-spacing: 2px; color: var(--muted); }

.tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.tag { display: inline-flex; align-items: center; gap: 4px; background: var(--surface-2); border: 1px solid var(--border); padding: 0 8px; font-size: 0.8rem; }
.tag.warn { background: var(--danger); color: #fff; }
.count { color: var(--muted); font-family: var(--font-label); font-size: 0.6em; font-weight: 400; }
.note { color: var(--muted); font-size: 0.9rem; }
.emphasis { color: var(--accent); font-style: normal; font-weight: 700; }
.placeholder { color: var(--accent); font-family: ui-monospace, monospace; }
```

- [ ] **Step 6: 建立 `src/styles/frames.css`**

（自 `global.css` 搬移，只有 `.placeholder-icon` 改用 `--radius`。）

```css
.entry-icon { object-fit: contain; }
.icon-frame { position: relative; display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; background: var(--frame) center / 100% 100% no-repeat; }
.icon-frame > .entry-icon { width: 78%; height: 78%; }
/* Inventory slot, drawn after the in-game inventory. Layers from the edge inward (in --px, the slot's
   own pixels at 103px): 1 black, 2 rarity border, 1 #353535 inner frame, 1 #0D0D0D, 1 inner glow. */
.icon-frame.frame-inventory {
  --slot-border: #897a6d; --slot-glow: #0d0d0d;
  background: #161616;
  box-shadow:
    0 0 0 max(1px, var(--px)) #000,
    inset 0 0 0 max(1px, calc(var(--px) * 2)) var(--slot-border),
    inset 0 0 0 calc(var(--px) * 3) #353535,
    inset 0 0 0 calc(var(--px) * 4) #0d0d0d,
    inset 0 0 0 calc(var(--px) * 5) var(--slot-glow);
}
.icon-frame.frame-inventory.is-unique {
  --slot-border: #ff7e2f; --slot-glow: #ab6f2e;
  background: linear-gradient(135deg, #7d421e 0%, #2d2018 38%, #271b15 100%);
}
.icon-frame.frame-inventory > .entry-icon { width: 82%; height: 82%; object-fit: contain; image-rendering: pixelated; }
/* Unique rarity mark: a small orange × of five pixel squares in the top-left corner. */
.slot-mark {
  --sq: max(1px, calc(var(--px) * 3));
  position: absolute; left: calc(var(--px) * 9); top: calc(var(--px) * 9); z-index: 1;
  width: var(--sq); height: var(--sq); background: #ff7e2f;
  box-shadow:
    calc(var(--sq) * 2) 0 0 #ff7e2f,
    var(--sq) var(--sq) 0 #ff7e2f,
    0 calc(var(--sq) * 2) 0 #ff7e2f,
    calc(var(--sq) * 2) calc(var(--sq) * 2) 0 #ff7e2f;
}
/* Hotbar artifact slot (T_UI_ArtifactSlot_Default): interior spans x 34–186, y 22–174 of 220px. */
.icon-frame.frame-artifact > .entry-icon { position: absolute; left: 15.5%; top: 10%; width: 69%; height: 69%; }
.icon-frame.frame-artifact > img.entry-icon { box-sizing: border-box; padding: 6%; object-fit: contain; }
/* The book slot art has a transparent diamond window (x 39–217, y 13–195 of 256px): the icon sits behind it and the frame is drawn on top. */
.icon-frame.frame-enchantment { background: none; }
.icon-frame.frame-enchantment::after { content: ""; position: absolute; inset: 0; background: var(--frame) center / 100% 100% no-repeat; image-rendering: pixelated; pointer-events: none; }
.icon-frame.frame-enchantment > .entry-icon { position: absolute; left: 15.2%; top: 5%; width: 69.6%; height: 71.5%; image-rendering: pixelated; }
.framed-placeholder { display: inline-flex; align-items: center; justify-content: center; color: var(--muted); font-size: 1.5rem; }
.placeholder-icon { display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); border-radius: var(--radius); color: var(--muted); font-size: 1.5rem; }
```

- [ ] **Step 7: 建立 `src/styles/legacy.css`（過渡用，Task 7 刪除）**

```css
/* Pre-redesign layout rules. Each later task adds a newer stylesheet after this one; Task 7 deletes this file. */
.site-header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
.brand { font-weight: 700; color: var(--accent); text-decoration: none; }
.site-nav { display: flex; flex-wrap: wrap; gap: 4px 12px; flex: 1; }
.site-nav a { display: inline-flex; align-items: center; gap: 4px; color: var(--text); text-decoration: none; font-size: 0.95rem; }
.site-nav a:hover { color: var(--accent); }
.site-tools { display: flex; gap: 8px; }
.lang-switch { font: inherit; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); padding: 4px 10px; text-decoration: none; }
.site-main { max-width: var(--max); margin: 0 auto; padding: 24px 16px 48px; }
.site-footer { border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; padding: 16px; text-align: center; }

.category-name { display: inline-flex; align-items: center; gap: 8px; }
.home-search { display: flex; gap: 8px; margin: 16px 0 24px; }
.home-search input, .filter-text { flex: 1 1 220px; }
.category-grid { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.category-grid a { display: flex; justify-content: space-between; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); color: var(--text); text-decoration: none; }

.list-filter { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.filter-variant { display: flex; gap: 6px; }
.filter-variant button { display: inline-flex; align-items: center; gap: 4px; }
.entry-grid { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.entry-card a { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; height: 100%; background: var(--surface); border: 1px solid var(--border); color: var(--text); text-decoration: none; text-align: center; }
.entry-card a:hover { border-color: var(--accent); }

.entry-table { width: 100%; border-collapse: collapse; }
.entry-table th, .entry-table td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid var(--border); }
.entry-table tr:has(:target) { background: var(--surface-2); }
.row-name { margin: 0; font-size: 1rem; }
.row-head { display: flex; gap: 8px; align-items: center; }

.book-source ul { list-style: none; padding: 0; display: grid; gap: 8px; }
.book-source .book { display: flex; gap: 10px; align-items: flex-start; }
.book-source .book p { margin: 4px 0 0; }
.entry-head { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.description { font-size: 1.05rem; }
.unlock { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.related ul, .set-pieces { list-style: none; padding: 0; display: grid; gap: 8px; }
.related li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.related-label { color: var(--muted); font-size: 0.85rem; }
.set-pieces { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.set-piece { background: var(--surface); border: 1px solid var(--border); padding: 12px; }
.set-piece a { display: flex; gap: 10px; align-items: center; color: var(--text); text-decoration: none; }
.piece-label { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 0.8rem; }
```

- [ ] **Step 8: 更新 `src/layouts/Base.astro` 的樣式匯入，刪除 `global.css`**

把 frontmatter 第一行 `import "../styles/global.css";` 換成：

```astro
import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/frames.css";
import "../styles/legacy.css";
```

並把 `<a class="lang-switch" …>` 加上 `button` class（`class="lang-switch button"`）。然後：

```bash
git rm -q src/styles/global.css
```

- [ ] **Step 9: 建置並執行完整測試**

Run: `npm run build && npx vitest run && npx playwright test --reporter=line`
Expected: 單元全過；E2E 全過（含新測試）。

- [ ] **Step 10: Commit**

```bash
git add .gitignore package.json package-lock.json src/assets src/styles src/layouts/Base.astro public/licenses tests/e2e/wiki.spec.ts
git commit -m "feat: switch to the game palette and self-hosted pixel fonts"
```

---

### Task 2: 純函式與 UI 字串

**Files:**
- Create: `src/lib/tabs.ts`, `src/lib/lang-switch.ts`, `src/lib/kicker.ts`
- Modify: `src/lib/i18n.ts`
- Test: `tests/unit/site/tabs.test.ts`, `tests/unit/site/lang-switch.test.ts`, `tests/unit/site/kicker.test.ts`, `tests/unit/site/i18n.test.ts`

**Interfaces:**
- Produces:
  - `tabs.ts`：`TAB_ORDER: readonly Category[]`、`adjacentCategory(order, current: Category | undefined, step: 1 | -1): Category`、`interface KeyContext { tagName?: string; isContentEditable?: boolean; modifier: boolean }`、`keyStep(key: string, context: KeyContext): 1 | -1 | null`
  - `lang-switch.ts`：`withCurrentLocation(href: string, search: string, hash: string): string`
  - `kicker.ts`：`itemKicker(category: Category, variant: "normal" | "unique"): string`、`setKicker(variant): string`
  - `i18n.ts` 新 UI 鍵：`searchPlaceholder categories fontLicense viewEntry view close itemDetails tooltipHint category rarity armorPiece translation details pieces setPieces`

- [ ] **Step 1: 寫失敗測試 `tests/unit/site/tabs.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { TAB_ORDER, adjacentCategory, keyStep } from "../../../src/lib/tabs";

describe("adjacentCategory", () => {
  const order = ["melee", "ranged", "armor"] as const;

  it("moves forward and backward", () => {
    expect(adjacentCategory(order, "melee", 1)).toBe("ranged");
    expect(adjacentCategory(order, "ranged", -1)).toBe("melee");
  });

  it("wraps around both ends", () => {
    expect(adjacentCategory(order, "armor", 1)).toBe("melee");
    expect(adjacentCategory(order, "melee", -1)).toBe("armor");
  });

  it("starts at the first or last tab when there is no current category", () => {
    expect(adjacentCategory(order, undefined, 1)).toBe("melee");
    expect(adjacentCategory(order, undefined, -1)).toBe("armor");
    expect(adjacentCategory(order, "effect", 1)).toBe("melee");
  });

  it("rejects an empty order", () => {
    expect(() => adjacentCategory([], undefined, 1)).toThrow();
  });
});

describe("keyStep", () => {
  const free = { tagName: "BODY", modifier: false };

  it("maps Q and E in either case", () => {
    expect(keyStep("e", free)).toBe(1);
    expect(keyStep("E", free)).toBe(1);
    expect(keyStep("q", free)).toBe(-1);
    expect(keyStep("Q", free)).toBe(-1);
    expect(keyStep("w", free)).toBeNull();
  });

  it("ignores keys typed into form fields or editable content", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(keyStep("e", { tagName, modifier: false })).toBeNull();
    }
    expect(keyStep("e", { tagName: "DIV", isContentEditable: true, modifier: false })).toBeNull();
  });

  it("ignores shortcuts with modifier keys", () => {
    expect(keyStep("e", { tagName: "BODY", modifier: true })).toBeNull();
  });
});

describe("TAB_ORDER", () => {
  it("lists the seven published categories in navigation order", () => {
    expect(TAB_ORDER).toEqual(["melee", "ranged", "armor", "artifact", "talisman", "enchantment", "effect"]);
  });
});
```

- [ ] **Step 2: 寫失敗測試 `tests/unit/site/lang-switch.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { withCurrentLocation } from "../../../src/lib/lang-switch";

describe("withCurrentLocation", () => {
  it("appends the current query and anchor", () => {
    expect(withCurrentLocation("/en/search/", "?q=%E5%8A%8D", "")).toBe("/en/search/?q=%E5%8A%8D");
    expect(withCurrentLocation("/en/effect/", "", "#critical-edge")).toBe("/en/effect/#critical-edge");
  });

  it("replaces any query or anchor already on the link", () => {
    expect(withCurrentLocation("/en/search/?q=old#x", "?q=new", "#y")).toBe("/en/search/?q=new#y");
  });

  it("leaves the link unchanged when there is nothing to carry over", () => {
    expect(withCurrentLocation("/en/melee/", "", "")).toBe("/en/melee/");
  });
});
```

- [ ] **Step 3: 寫失敗測試 `tests/unit/site/kicker.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { itemKicker, setKicker } from "../../../src/lib/kicker";

describe("kickers", () => {
  it("names each published category in singular English", () => {
    expect(itemKicker("melee", "normal")).toBe("MELEE WEAPON");
    expect(itemKicker("ranged", "normal")).toBe("RANGED WEAPON");
    expect(itemKicker("armor", "normal")).toBe("ARMOR");
    expect(itemKicker("artifact", "normal")).toBe("ARTIFACT");
    expect(itemKicker("talisman", "normal")).toBe("TALISMAN");
    expect(itemKicker("enchantment", "normal")).toBe("ENCHANTMENT");
    expect(itemKicker("effect", "normal")).toBe("EFFECT");
  });

  it("prefixes unique items", () => {
    expect(itemKicker("melee", "unique")).toBe("UNIQUE MELEE WEAPON");
  });

  it("labels armor sets", () => {
    expect(setKicker("normal")).toBe("ARMOR SET");
    expect(setKicker("unique")).toBe("UNIQUE ARMOR SET");
  });
});
```

- [ ] **Step 4: 在 `tests/unit/site/i18n.test.ts` 的 `describe("i18n", …)` 內加上一個測試**

```ts
  it("defines every UI string in both languages", async () => {
    const zh = Object.keys((await import("../../../src/lib/i18n")).UI_STRINGS.zh).sort();
    const en = Object.keys((await import("../../../src/lib/i18n")).UI_STRINGS.en).sort();
    expect(en).toEqual(zh);
    for (const key of ["searchPlaceholder", "viewEntry", "tooltipHint", "rarity", "setPieces"]) expect(zh).toContain(key);
  });
```

- [ ] **Step 5: 執行測試確認失敗**

Run: `npx vitest run tests/unit/site`
Expected: FAIL（找不到 `src/lib/tabs` 等模組；`UI_STRINGS` 未匯出）。

- [ ] **Step 6: 建立 `src/lib/tabs.ts`**

```ts
import type { Category } from "../../scripts/extract/config";
import { NAV_GROUPS } from "./i18n";

/** The category tab strip, in navigation order. */
export const TAB_ORDER: readonly Category[] = NAV_GROUPS.flatMap((group) => group.categories);

/** The tab Q (step -1) or E (step 1) leads to; wraps around, and starts at an end when there is no current tab. */
export function adjacentCategory(order: readonly Category[], current: Category | undefined, step: 1 | -1): Category {
  if (order.length === 0) throw new Error("adjacentCategory needs at least one category");
  const index = current === undefined ? -1 : order.indexOf(current);
  if (index === -1) return step === 1 ? order[0] : order[order.length - 1];
  return order[(index + step + order.length) % order.length];
}

export interface KeyContext {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
  readonly modifier: boolean;
}

const FORM_FIELDS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Which way a key press moves through the tabs, or null when it is not a tab shortcut here. */
export function keyStep(key: string, context: KeyContext): 1 | -1 | null {
  if (context.modifier || context.isContentEditable) return null;
  if (FORM_FIELDS.has((context.tagName ?? "").toUpperCase())) return null;
  const lower = key.toLowerCase();
  if (lower === "e") return 1;
  if (lower === "q") return -1;
  return null;
}
```

- [ ] **Step 7: 建立 `src/lib/lang-switch.ts`**

```ts
/** The language switch link with the current page's query and anchor carried over. */
export function withCurrentLocation(href: string, search: string, hash: string): string {
  return `${href.replace(/[?#].*$/, "")}${search}${hash}`;
}
```

- [ ] **Step 8: 建立 `src/lib/kicker.ts`**

```ts
import type { Category } from "../../scripts/extract/config";
import type { Entry } from "../../scripts/extract/schemas";

const SINGULAR: Readonly<Record<Category, string>> = {
  melee: "MELEE WEAPON",
  ranged: "RANGED WEAPON",
  armor: "ARMOR",
  artifact: "ARTIFACT",
  talisman: "TALISMAN",
  enchantment: "ENCHANTMENT",
  "enchantment-book": "ENCHANTMENT BOOK",
  effect: "EFFECT",
  status: "STATUS",
  cape: "CAPE",
  pet: "PET",
  skin: "SKIN",
};

/** The small game-style label above an item name, e.g. "UNIQUE MELEE WEAPON". */
export const itemKicker = (category: Category, variant: Entry["variant"]): string =>
  `${variant === "unique" ? "UNIQUE " : ""}${SINGULAR[category]}`;

export const setKicker = (variant: Entry["variant"]): string =>
  variant === "unique" ? "UNIQUE ARMOR SET" : "ARMOR SET";
```

- [ ] **Step 9: 修改 `src/lib/i18n.ts`**

把 `const UI = {` 改成 `export const UI_STRINGS = {`，並把檔內其他 `UI[` 與 `typeof UI` 的引用改成 `UI_STRINGS`（`t()` 與 `UiKey`）。在 `zh` 物件的 `unlock: "解鎖",` 後加入：

```ts
    searchPlaceholder: "搜尋物品、附魔、效果…",
    categories: "分類",
    fontLicense: "字型授權",
    viewEntry: "查看完整條目",
    view: "查看",
    close: "關閉",
    itemDetails: "物品說明",
    tooltipHint: "將游標移到物品上即可查看說明。",
    category: "分類",
    rarity: "稀有度",
    armorPiece: "部位",
    translation: "翻譯",
    details: "詳細說明",
    pieces: "部位數",
    setPieces: "套裝部位",
```

在 `en` 物件的 `unlock: "Unlock",` 後加入：

```ts
    searchPlaceholder: "Search items, enchantments, effects…",
    categories: "Categories",
    fontLicense: "Font license",
    viewEntry: "View full entry",
    view: "View",
    close: "Close",
    itemDetails: "Item details",
    tooltipHint: "Hover over an item to see its details.",
    category: "Category",
    rarity: "Rarity",
    armorPiece: "Slot",
    translation: "Translation",
    details: "Details",
    pieces: "Pieces",
    setPieces: "Set pieces",
```

- [ ] **Step 10: 執行測試確認通過**

Run: `npx vitest run`
Expected: PASS（全部）。

- [ ] **Step 11: Commit**

```bash
git add src/lib tests/unit/site
git commit -m "feat: add tab, language switch and kicker helpers with new UI strings"
```

---

### Task 3: 標題列、分類分頁與語言切換保留查詢

**Files:**
- Create: `src/components/SiteHeader.astro`, `src/components/CategoryTabs.astro`, `src/styles/layout.css`
- Modify: `src/layouts/Base.astro`, `src/pages/[lang]/[category]/index.astro`, `src/pages/[lang]/[category]/[slug].astro`, `src/pages/[lang]/armor/index.astro`, `src/pages/[lang]/armor/[set].astro`, `src/pages/[lang]/armor/piece/[slug].astro`
- Test: `tests/e2e/wiki.spec.ts`

**Interfaces:**
- Consumes: `TAB_ORDER`、`adjacentCategory`、`keyStep`、`withCurrentLocation`、UI 鍵 `searchPlaceholder categories fontLicense`
- Produces: `Base` 新屬性 `current?: Category`；DOM：`header.site-header`、`form.header-search`、`nav.site-nav.category-tabs[data-current]`、`a[data-category][aria-current]`、`.tab-label`、`.tab-key`

- [ ] **Step 1: 寫失敗 E2E 測試（附加到結尾）**

```ts
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
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npx playwright test --project=chromium --reporter=line -g "category tabs|Q and E|search boxes|header search|keeps the search"`
Expected: FAIL（沒有 `.category-tabs`、`.header-search`）。

- [ ] **Step 3: 建立 `src/components/SiteHeader.astro`**

```astro
---
import { HTML_LANG, otherLang, t, type Lang } from "../lib/i18n";
import { href, swapLangPath } from "../lib/url";

interface Props {
  lang: Lang;
}

const { lang } = Astro.props;
const alt = otherLang(lang);
const switchHref = swapLangPath(Astro.url.pathname, import.meta.env.BASE_URL, alt);
---
<header class="site-header">
  <a class="brand" href={href(lang)}>{t(lang, "siteTitle")}</a>
  <form class="header-search" action={href(lang, "search")} method="get" role="search">
    <input type="search" name="q" placeholder={t(lang, "searchPlaceholder")} aria-label={t(lang, "search")} />
  </form>
  <div class="site-tools">
    <button type="button" class="compare-toggle" aria-pressed="true" data-testid="compare-toggle">
      {t(lang, "compare")}
    </button>
    <a class="lang-switch button" href={switchHref} hreflang={HTML_LANG[alt]} data-testid="lang-switch">
      {t(lang, "switchLang")}
    </a>
  </div>
</header>
<script>
  import { withCurrentLocation } from "../lib/lang-switch";

  const STORAGE_KEY = "mcd2-compare";
  const root = document.documentElement;
  const button = document.querySelector<HTMLButtonElement>(".compare-toggle");
  const syncCompare = () => button?.setAttribute("aria-pressed", String(root.dataset.compare !== "off"));
  syncCompare();
  button?.addEventListener("click", () => {
    const next = root.dataset.compare === "off" ? "on" : "off";
    root.dataset.compare = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this page view only.
    }
    syncCompare();
  });

  const langLink = document.querySelector<HTMLAnchorElement>("[data-testid='lang-switch']");
  const langBase = langLink?.getAttribute("href") ?? "";
  const syncLang = () => langLink?.setAttribute("href", withCurrentLocation(langBase, location.search, location.hash));
  syncLang();
  window.addEventListener("hashchange", syncLang);
</script>
```

- [ ] **Step 4: 建立 `src/components/CategoryTabs.astro`**

```astro
---
import type { Category } from "../../scripts/extract/config";
import { CATEGORY_LABEL, t, type Lang } from "../lib/i18n";
import { TAB_ORDER } from "../lib/tabs";
import { categoryIcon } from "../lib/ui-icons";
import { href } from "../lib/url";
import UiIcon from "./UiIcon.astro";

interface Props {
  lang: Lang;
  current?: Category;
}

const { lang, current } = Astro.props;
---
<nav class="site-nav category-tabs" aria-label={t(lang, "categories")} data-current={current}>
  <span class="tab-key" aria-hidden="true">Q</span>
  <ul class="tab-list">
    {TAB_ORDER.map((category) => (
      <li>
        <a href={href(lang, category)} data-category={category} aria-current={category === current ? "page" : undefined}>
          <UiIcon src={categoryIcon(category)} />
          <span class="tab-label">{CATEGORY_LABEL[category][lang]}</span>
        </a>
      </li>
    ))}
  </ul>
  <span class="tab-key" aria-hidden="true">E</span>
</nav>
<script>
  import type { Category } from "../../scripts/extract/config";
  import { adjacentCategory, keyStep } from "../lib/tabs";

  const nav = document.querySelector<HTMLElement>(".category-tabs");
  const links = [...(nav?.querySelectorAll<HTMLAnchorElement>("a[data-category]") ?? [])];
  const order = links.map((link) => link.dataset.category as Category);
  nav?.querySelector("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "center" });

  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    const step = keyStep(event.key, {
      tagName: target?.tagName,
      isContentEditable: target?.isContentEditable ?? false,
      modifier: event.ctrlKey || event.metaKey || event.altKey,
    });
    if (step === null || order.length === 0) return;
    const next = adjacentCategory(order, nav?.dataset.current as Category | undefined, step);
    const link = links.find((candidate) => candidate.dataset.category === next);
    if (link) window.location.assign(link.href);
  });
</script>
```

- [ ] **Step 5: 建立 `src/styles/layout.css`**

```css
.site-header {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 10px 16px;
  background: var(--surface-2); border-bottom: 2px solid var(--border);
}
.brand { font-family: var(--font-pixel); font-size: 1.15rem; color: var(--accent); text-decoration: none; text-shadow: 2px 2px 0 #000; }
.header-search { flex: 1 1 240px; display: flex; justify-content: center; }
.header-search input { width: 100%; max-width: 420px; }
.site-tools { display: flex; gap: 8px; }

.category-tabs {
  display: flex; align-items: center; justify-content: center; gap: 14px; padding: 8px 16px;
  background: var(--surface); border-bottom: 2px solid var(--border);
}
.tab-key { font-family: var(--font-label); font-size: 0.75rem; background: var(--text); color: var(--bg); padding: 0 6px; line-height: 1.6; }
.tab-list { list-style: none; display: flex; gap: 6px; margin: 0; padding: 0; }
.tab-list a {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 44px; height: 40px; border-bottom: 3px solid transparent;
}
.tab-list .ui-icon { width: 26px; height: 26px; vertical-align: 0; opacity: 0.55; }
.tab-list a:hover .ui-icon, .tab-list a:focus-visible .ui-icon { opacity: 0.9; }
.tab-list a[aria-current="page"] { border-bottom-color: var(--accent); }
.tab-list a[aria-current="page"] .ui-icon { opacity: 1; filter: drop-shadow(0 0 3px var(--accent)); }
.tab-label {
  position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); z-index: 5;
  white-space: nowrap; background: var(--surface-2); border: 2px solid var(--border); padding: 0 8px;
  font-family: var(--font-pixel); font-size: 0.85rem; color: var(--text); pointer-events: none; opacity: 0;
}
.tab-list a:hover .tab-label, .tab-list a:focus-visible .tab-label { opacity: 1; }

.site-main { max-width: var(--max); margin: 0 auto; padding: 24px 16px 48px; }
.site-footer {
  border-top: 2px solid var(--border); background: var(--surface); color: var(--muted);
  font-size: 0.85rem; padding: 16px; text-align: center;
}

@media (max-width: 699px) {
  .header-search { order: 3; flex-basis: 100%; }
  .category-tabs { justify-content: flex-start; overflow-x: auto; scrollbar-width: none; }
  .tab-key, .tab-label { display: none; }
}
@media (hover: none) {
  .tab-key { display: none; }
}
```

- [ ] **Step 6: 改寫 `src/layouts/Base.astro`**

```astro
---
import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/frames.css";
import "../styles/legacy.css";
import "../styles/layout.css";
import type { Category } from "../../scripts/extract/config";
import CategoryTabs from "../components/CategoryTabs.astro";
import SiteHeader from "../components/SiteHeader.astro";
import { HTML_LANG, t, type Lang } from "../lib/i18n";
import { assetUrl } from "../lib/url";

interface Props {
  lang: Lang;
  title: string;
  /** The category this page belongs to; highlights its tab. */
  current?: Category;
}

const { lang, title, current } = Astro.props;
---
<!doctype html>
<html lang={HTML_LANG[lang]} data-compare="on">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{`${title} | ${t(lang, "siteTitle")}`}</title>
    <script is:inline>
      (function () {
        try {
          if (localStorage.getItem("mcd2-compare") === "off") document.documentElement.dataset.compare = "off";
        } catch (error) {
          // Storage unavailable (private mode or blocked): keep the default "on".
        }
      })();
    </script>
  </head>
  <body>
    <SiteHeader lang={lang} />
    <CategoryTabs lang={lang} current={current} />
    <main class="site-main"><slot /></main>
    <footer class="site-footer">
      <p>{t(lang, "disclaimer")}</p>
      <p>{t(lang, "source")}</p>
      <p><a href={assetUrl("licenses/Cubic-11-OFL.txt")}>{t(lang, "fontLicense")}</a></p>
    </footer>
  </body>
</html>
```

- [ ] **Step 7: 頁面傳入 `current`**

- `src/pages/[lang]/[category]/index.astro`：`<Base lang={lang} title={CATEGORY_LABEL[category][lang]}>` → `<Base lang={lang} title={CATEGORY_LABEL[category][lang]} current={category}>`
- `src/pages/[lang]/[category]/[slug].astro`：`<Base lang={lang} title={entry.name[lang]}>` → `<Base lang={lang} title={entry.name[lang]} current={entry.category}>`
- `src/pages/[lang]/armor/index.astro`：`<Base lang={lang} title={CATEGORY_LABEL.armor[lang]}>` → 加上 `current="armor"`
- `src/pages/[lang]/armor/[set].astro`：`<Base lang={lang} title={set.name[lang]}>` → 加上 `current="armor"`
- `src/pages/[lang]/armor/piece/[slug].astro`：`<Base lang={lang} title={entry.name[lang]}>` → 加上 `current="armor"`

- [ ] **Step 8: 建置並執行完整測試**

Run: `npm run build && npx vitest run && npx playwright test --reporter=line`
Expected: 全過。既有的 `.site-nav a` 測試仍成立（分頁 `nav` 保留 `site-nav` class，標籤文字仍在 DOM 中）。

- [ ] **Step 9: Commit**

```bash
git add src/components/SiteHeader.astro src/components/CategoryTabs.astro src/styles/layout.css src/layouts/Base.astro src/pages tests/e2e/wiki.spec.ts
git commit -m "feat: add the game-style header and category tab strip with Q/E switching"
```

---

### Task 4: 首頁標題橫幅與分類格

**Files:**
- Create: `src/components/HomeHero.astro`, `src/styles/home.css`
- Modify: `src/pages/[lang]/index.astro`, `src/layouts/Base.astro`
- Test: `tests/e2e/wiki.spec.ts`

**Interfaces:**
- Consumes: `TAB_ORDER`、`categoryIcon`、`entriesIn`、`allArmorSets`、UI 鍵 `searchPlaceholder`
- Produces: DOM `section.home-hero`、`.home-title`、`form.home-search`、`ul.category-grid > li > a`（含 `.category-slot`、`.category-name`、`.count`）

- [ ] **Step 1: 寫失敗 E2E 測試（附加到結尾）**

```ts
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
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npx playwright test --project=chromium --reporter=line -g "title banner"`
Expected: FAIL（沒有 `.home-hero`）。

- [ ] **Step 3: 建立 `src/components/HomeHero.astro`**

```astro
---
import type { Category } from "../../scripts/extract/config";
import { allArmorSets, entriesIn } from "../lib/data";
import { CATEGORY_LABEL, t, type Lang } from "../lib/i18n";
import { TAB_ORDER } from "../lib/tabs";
import { categoryIcon } from "../lib/ui-icons";
import { href } from "../lib/url";
import UiIcon from "./UiIcon.astro";

interface Props {
  lang: Lang;
}

const { lang } = Astro.props;
const countOf = (category: Category): number =>
  category === "armor" ? allArmorSets.length : entriesIn(category).length;
---
<section class="home-hero">
  <p class="kicker">UNOFFICIAL FAN WIKI</p>
  <h1 class="home-title">{t(lang, "siteTitle")}</h1>
  <form class="home-search" action={href(lang, "search")} method="get" role="search">
    <input type="search" name="q" placeholder={t(lang, "searchPlaceholder")} aria-label={t(lang, "search")} />
    <button type="submit">{t(lang, "search")}</button>
  </form>
  <ul class="category-grid">
    {TAB_ORDER.map((category) => (
      <li>
        <a href={href(lang, category)}>
          <span class="category-slot"><UiIcon src={categoryIcon(category)} /></span>
          <span class="category-name">{CATEGORY_LABEL[category][lang]}</span>
          <span class="count">{countOf(category)}</span>
        </a>
      </li>
    ))}
  </ul>
</section>
```

- [ ] **Step 4: 建立 `src/styles/home.css`**

```css
.home-hero {
  text-align: center; padding: 40px 16px 32px; border: 2px solid var(--border);
  background: radial-gradient(ellipse at 50% 20%, #1f3a44 0%, var(--bg) 70%);
}
.home-title { font-size: clamp(1.8rem, 5vw, 3rem); color: var(--accent); margin: 8px 0 20px; }
.home-search { display: flex; gap: 8px; max-width: 520px; margin: 0 auto 28px; }
.home-search input { flex: 1; }
.category-grid {
  list-style: none; padding: 0; margin: 0 auto; max-width: 760px;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 14px;
}
.category-grid a {
  display: flex; flex-direction: column; align-items: center; gap: 4px; width: 88px;
  padding: 0; background: none; border: 0; color: var(--text); text-decoration: none;
}
.category-slot {
  width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; background: #161616;
  box-shadow: 0 0 0 1px #000, inset 0 0 0 2px #897a6d, inset 0 0 0 3px #353535, inset 0 0 0 4px #0d0d0d;
}
.category-slot .ui-icon { width: 32px; height: 32px; vertical-align: 0; }
.category-grid a:hover .category-slot, .category-grid a:focus-visible .category-slot {
  box-shadow: 0 0 0 1px #000, inset 0 0 0 2px var(--accent), inset 0 0 0 3px #353535, inset 0 0 0 4px #0d0d0d;
}
.category-grid .category-name { font-family: var(--font-pixel); }
.category-grid .count { font-size: 0.7rem; }
```

- [ ] **Step 5: 改寫 `src/pages/[lang]/index.astro`**

```astro
---
import { LANGS } from "../../../scripts/extract/config";
import HomeHero from "../../components/HomeHero.astro";
import Base from "../../layouts/Base.astro";
import { t, type Lang } from "../../lib/i18n";

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

const lang = Astro.params.lang as Lang;
---
<Base lang={lang} title={t(lang, "home")}>
  <HomeHero lang={lang} />
</Base>
```

- [ ] **Step 6: 在 `Base.astro` 匯入 `home.css`**

在 `import "../styles/layout.css";` 下一行加 `import "../styles/home.css";`。

- [ ] **Step 7: 建置並執行完整測試**

Run: `npm run build && npx vitest run && npx playwright test --reporter=line`
Expected: 全過（既有「home lists categories」「navigation, home cards…」測試仍用 `.category-grid a`）。

- [ ] **Step 8: Commit**

```bash
git add src/components/HomeHero.astro src/styles/home.css "src/pages/[lang]/index.astro" src/layouts/Base.astro tests/e2e/wiki.spec.ts
git commit -m "feat: turn the home page into a title banner with category slots"
```

---

### Task 5: 物品欄列表、說明面板與手機底部面板

**Files:**
- Create: `src/components/TooltipPanel.astro`, `src/components/ItemCard.astro`, `src/components/ItemBrowser.astro`, `src/styles/items.css`
- Modify: `src/pages/[lang]/[category]/index.astro`, `src/pages/[lang]/armor/index.astro`, `src/layouts/Base.astro`, `tests/e2e/wiki.spec.ts`
- Delete: `src/components/EntryCard.astro`

**Interfaces:**
- Consumes: `itemKicker`、`setKicker`、`entryHref`、`EntryIcon`、`LangText`、UI 鍵 `viewEntry view close itemDetails tooltipHint`
- Produces:
  - `<TooltipPanel lang kicker name description? href unique?>`（具名預設插槽放額外內容）
  - `<ItemCard lang href name icon? category variant kicker description?>`（插槽轉給 TooltipPanel）
  - `<ItemBrowser lang>`（插槽為多個 ItemCard）
  - DOM：`.item-browser`、`ul.entry-grid.item-grid > li.entry-card[data-variant][data-names]`、`a.item-link`、`.item-name.primary`、`template.item-tip`、`aside.item-tooltip[data-testid=item-tooltip]`、`.item-sheet[data-testid=item-sheet][hidden]`、`.sheet-body`、`a.sheet-view`、`button.sheet-close`、`.tooltip-panel .kicker`、`.tooltip-name`、`.tooltip-desc`、`a.tooltip-link`

- [ ] **Step 1: 更新既有 E2E 中「從列表點進條目」的寫法**

在 `tests/e2e/wiki.spec.ts` 第一行 import 改為 `import { expect, test, type Locator, type Page } from "@playwright/test";`，並在 import 下方加入：

```ts
/** Opens an entry from a category list; on touch devices the first tap opens the details sheet. */
async function openFromList(page: Page, card: Locator): Promise<void> {
  await card.locator("a.item-link").click();
  const sheet = page.getByTestId("item-sheet");
  if (await sheet.isVisible()) await sheet.locator(".sheet-view").click();
}
```

把「entry page shows bilingual name and icon」中的

```ts
  await page.locator(".entry-card a", { has: page.locator(".primary", { hasText: /^劍$/ }) }).click();
```

改成

```ts
  await openFromList(page, page.locator(".entry-card", { has: page.locator(".primary", { hasText: /^劍$/ }) }));
```

把「artifacts sit in the hotbar artifact slot」中的 `await page.locator(".entry-card a").first().click();` 改成 `await openFromList(page, page.locator(".entry-card").first());`。

- [ ] **Step 2: 寫失敗 E2E 測試（附加到結尾）**

```ts
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
  await expect(page.getByTestId("item-tooltip").locator(".tooltip-name .alt")).toBeHidden();
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
```

- [ ] **Step 3: 執行確認失敗**

Run: `npm run build && npx playwright test --reporter=line -g "under the slots|beside the grid|compare mode is off|details sheet|without JavaScript|sets with their pieces"`
Expected: FAIL（沒有 `.item-name`、`item-tooltip`、`item-sheet`）。

- [ ] **Step 4: 建立 `src/components/TooltipPanel.astro`**

```astro
---
import type { Localized } from "../../scripts/extract/schemas";
import { t, type Lang } from "../lib/i18n";
import LangText from "./LangText.astro";

interface Props {
  lang: Lang;
  kicker: string;
  name: Localized;
  description?: Localized;
  href: string;
  unique?: boolean;
}

const { lang, kicker, name, description, href, unique = false } = Astro.props;
---
<div class="tooltip-panel">
  <p class="kicker">{kicker}</p>
  <LangText as="p" lang={lang} value={name} class={unique ? "tooltip-name is-unique" : "tooltip-name"} />
  {description && <LangText as="p" class="tooltip-desc" lang={lang} value={description} html />}
  <slot />
  <a class="tooltip-link" href={href}>{t(lang, "viewEntry")} ›</a>
</div>
```

- [ ] **Step 5: 建立 `src/components/ItemCard.astro`**

```astro
---
import type { Category } from "../../scripts/extract/config";
import type { Entry, Localized } from "../../scripts/extract/schemas";
import type { Lang } from "../lib/i18n";
import EntryIcon from "./EntryIcon.astro";
import TooltipPanel from "./TooltipPanel.astro";

interface Props {
  lang: Lang;
  href: string;
  name: Localized;
  icon?: string;
  category: Category;
  variant: Entry["variant"];
  kicker: string;
  description?: Localized;
}

const { lang, href, name, icon, category, variant, kicker, description } = Astro.props;
const unique = variant === "unique";
---
<li class="entry-card" data-variant={variant} data-names={`${name.zh} ${name.en}`.toLowerCase()}>
  <a class="item-link" href={href}>
    <EntryIcon icon={icon} alt={name[lang]} category={category} variant={variant} />
    <span class:list={["primary", "item-name", { "is-unique": unique }]}>{name[lang]}</span>
  </a>
  <template class="item-tip">
    <TooltipPanel lang={lang} kicker={kicker} name={name} description={description} href={href} unique={unique}>
      <slot />
    </TooltipPanel>
  </template>
</li>
```

- [ ] **Step 6: 建立 `src/components/ItemBrowser.astro`**

```astro
---
import { t, type Lang } from "../lib/i18n";

interface Props {
  lang: Lang;
}

const { lang } = Astro.props;
---
<div class="item-browser">
  <ul class="entry-grid item-grid"><slot /></ul>
  <aside class="item-tooltip panel" data-testid="item-tooltip" aria-live="polite">
    <p class="tooltip-hint">{t(lang, "tooltipHint")}</p>
  </aside>
</div>
<div class="item-sheet panel" data-testid="item-sheet" role="dialog" aria-label={t(lang, "itemDetails")} hidden>
  <button type="button" class="sheet-close" aria-label={t(lang, "close")}>×</button>
  <div class="sheet-body"></div>
  <a class="sheet-view button" href="#">{t(lang, "view")} ›</a>
</div>
<script>
  const browser = document.querySelector<HTMLElement>(".item-browser");
  const tooltip = browser?.querySelector<HTMLElement>(".item-tooltip");
  const sheet = document.querySelector<HTMLElement>(".item-sheet");
  const sheetBody = sheet?.querySelector<HTMLElement>(".sheet-body");
  const sheetView = sheet?.querySelector<HTMLAnchorElement>(".sheet-view");
  const cards = [...(browser?.querySelectorAll<HTMLElement>(".entry-card") ?? [])];
  const canHover = window.matchMedia("(hover: hover)").matches;
  let openCard: HTMLElement | null = null;

  const contentOf = (card: HTMLElement): DocumentFragment | null => {
    const template = card.querySelector<HTMLTemplateElement>("template.item-tip");
    return template ? (template.content.cloneNode(true) as DocumentFragment) : null;
  };

  const showTooltip = (card: HTMLElement) => {
    const content = contentOf(card);
    if (!tooltip || !content) return;
    tooltip.replaceChildren(content);
    for (const other of cards) other.classList.toggle("is-active", other === card);
  };

  const closeSheet = () => {
    if (sheet) sheet.hidden = true;
    openCard = null;
  };

  const openSheet = (card: HTMLElement, href: string) => {
    const content = contentOf(card);
    if (!sheet || !sheetBody || !sheetView || !content) return;
    sheetBody.replaceChildren(content);
    sheetView.href = href;
    sheet.hidden = false;
    openCard = card;
  };

  for (const card of cards) {
    const link = card.querySelector<HTMLAnchorElement>("a.item-link");
    if (!link) continue;
    if (canHover) {
      card.addEventListener("mouseenter", () => showTooltip(card));
      card.addEventListener("focusin", () => showTooltip(card));
      continue;
    }
    link.addEventListener("click", (event) => {
      if (openCard === card) return;
      event.preventDefault();
      openSheet(card, link.href);
    });
  }

  sheet?.querySelector(".sheet-close")?.addEventListener("click", closeSheet);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSheet();
  });
</script>
```

- [ ] **Step 7: 建立 `src/styles/items.css`**

```css
.list-filter { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.filter-text { flex: 1 1 220px; }
.filter-variant { display: flex; gap: 6px; }
.filter-variant button { display: inline-flex; align-items: center; gap: 4px; }

.item-browser { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
.item-grid {
  list-style: none; margin: 0; padding: 0; display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 14px 10px;
}
.item-grid .entry-card a {
  display: flex; flex-direction: column; align-items: center; gap: 6px; height: auto;
  padding: 0; background: none; border: 0; color: var(--text); text-decoration: none; text-align: center;
}
.item-grid .entry-card.is-active .icon-frame,
.item-grid .entry-card a:hover .icon-frame,
.item-grid .entry-card a:focus-visible .icon-frame { outline: 2px solid #fff; outline-offset: 2px; }
.item-name { font-family: var(--font-pixel); font-size: 0.85rem; line-height: 1.25; }
.item-name.is-unique, .tooltip-name.is-unique .primary { color: var(--accent); }

.item-tooltip { padding: 12px 14px; min-height: 160px; }
.tooltip-hint { color: var(--muted); margin: 0; }
.tooltip-name { font-family: var(--font-pixel); font-size: 1.3rem; margin: 2px 0 6px; }
.tooltip-desc { margin: 0 0 8px; }
.tooltip-link { font-size: 0.85rem; }
.tooltip-pieces { list-style: none; padding: 0; margin: 0 0 8px; }

.item-sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; max-height: 60vh; overflow: auto;
  padding: 14px 16px 18px; border-top: 3px solid var(--accent); box-shadow: 0 -8px 24px rgb(0 0 0 / 60%);
}
.item-sheet .tooltip-link { display: none; }
.sheet-close { position: absolute; top: 8px; right: 8px; }
.sheet-view {
  display: inline-block; margin-top: 8px; background: var(--accent); color: #1a0e05;
  border-color: #000; font-family: var(--font-label);
}

@media (min-width: 900px) {
  .item-browser { grid-template-columns: 1fr 300px; }
  .item-tooltip { position: sticky; top: 16px; }
}
@media (max-width: 899px) {
  .item-tooltip { display: none; }
}
```

- [ ] **Step 8: 改寫 `src/pages/[lang]/[category]/index.astro`**

```astro
---
import { LANGS, type Category } from "../../../../scripts/extract/config";
import EntryTable from "../../../components/EntryTable.astro";
import ItemBrowser from "../../../components/ItemBrowser.astro";
import ItemCard from "../../../components/ItemCard.astro";
import ListFilter from "../../../components/ListFilter.astro";
import UiIcon from "../../../components/UiIcon.astro";
import Base from "../../../layouts/Base.astro";
import { entriesIn } from "../../../lib/data";
import { CATEGORY_LABEL, GRID_CATEGORIES, TABLE_CATEGORIES, t, type Lang } from "../../../lib/i18n";
import { itemKicker } from "../../../lib/kicker";
import { categoryIcon } from "../../../lib/ui-icons";
import { entryHref } from "../../../lib/url";

export function getStaticPaths() {
  return LANGS.flatMap((lang) =>
    [...GRID_CATEGORIES, ...TABLE_CATEGORIES].map((category) => ({ params: { lang, category } })),
  );
}

const lang = Astro.params.lang as Lang;
const category = Astro.params.category as Category;
const entries = entriesIn(category);
const isTable = (TABLE_CATEGORIES as readonly Category[]).includes(category);
const hasUnique = entries.some((entry) => entry.variant === "unique");
---
<Base lang={lang} title={CATEGORY_LABEL[category][lang]} current={category}>
  <h1><UiIcon src={categoryIcon(category)} /> <span data-pagefind-meta="title">{CATEGORY_LABEL[category][lang]}</span> <span class="count">({entries.length})</span></h1>
  <ListFilter lang={lang} showVariant={!isTable && hasUnique} />
  {isTable ? (
    <>
      <p class="note">{t(lang, "placeholderNote")}</p>
      <EntryTable lang={lang} entries={entries} />
    </>
  ) : (
    <ItemBrowser lang={lang}>
      {entries.map((entry) => (
        <ItemCard
          lang={lang}
          href={entryHref(lang, entry)}
          name={entry.name}
          icon={entry.icon}
          category={entry.category}
          variant={entry.variant}
          kicker={itemKicker(entry.category, entry.variant)}
          description={entry.description}
        />
      ))}
    </ItemBrowser>
  )}
</Base>
```

- [ ] **Step 9: 改寫 `src/pages/[lang]/armor/index.astro`**

```astro
---
import { LANGS } from "../../../../scripts/extract/config";
import { ARMOR_PIECES } from "../../../../scripts/extract/schemas";
import ItemBrowser from "../../../components/ItemBrowser.astro";
import ItemCard from "../../../components/ItemCard.astro";
import ListFilter from "../../../components/ListFilter.astro";
import UiIcon from "../../../components/UiIcon.astro";
import Base from "../../../layouts/Base.astro";
import { allArmorSets, findEntry } from "../../../lib/data";
import { CATEGORY_LABEL, PIECE_LABEL, type Lang } from "../../../lib/i18n";
import { setKicker } from "../../../lib/kicker";
import { categoryIcon } from "../../../lib/ui-icons";
import { href } from "../../../lib/url";

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

const lang = Astro.params.lang as Lang;
const cards = allArmorSets.map((set) => {
  const pieces = ARMOR_PIECES.flatMap((piece) => {
    const slug = set.pieces[piece];
    const entry = slug ? findEntry("armor", slug) : undefined;
    return entry ? [{ piece, entry }] : [];
  });
  return { set, pieces, icon: pieces[0]?.entry.icon };
});
---
<Base lang={lang} title={CATEGORY_LABEL.armor[lang]} current="armor">
  <h1><UiIcon src={categoryIcon("armor")} /> {CATEGORY_LABEL.armor[lang]} <span class="count">({cards.length})</span></h1>
  <ListFilter lang={lang} showVariant={true} />
  <ItemBrowser lang={lang}>
    {cards.map(({ set, pieces, icon }) => (
      <ItemCard
        lang={lang}
        href={href(lang, "armor", set.slug)}
        name={set.name}
        icon={icon}
        category="armor"
        variant={set.variant}
        kicker={setKicker(set.variant)}
      >
        <ul class="tooltip-pieces">
          {pieces.map(({ piece, entry }) => <li>{PIECE_LABEL[piece][lang]}：{entry.name[lang]}</li>)}
        </ul>
      </ItemCard>
    ))}
  </ItemBrowser>
</Base>
```

- [ ] **Step 10: 匯入 `items.css`、刪除 `EntryCard.astro`**

在 `Base.astro` 的 `import "../styles/home.css";` 下一行加 `import "../styles/items.css";`，然後：

```bash
git rm -q src/components/EntryCard.astro
grep -rn "EntryCard" src || echo "no references"
```
Expected: `no references`。

- [ ] **Step 11: 建置並執行完整測試**

Run: `npm run build && npx vitest run && npx playwright test --reporter=line`
Expected: 全過（含 mobile 專案；「list filter narrows…」仍用 `.entry-card` 與 `data-names`）。

- [ ] **Step 12: Commit**

```bash
git add src/components src/styles/items.css src/pages src/layouts/Base.astro tests/e2e/wiki.spec.ts
git commit -m "feat: show lists as an inventory grid with a details panel and mobile sheet"
```

---

### Task 6: 條目頁資訊欄版面與套裝頁

**Files:**
- Create: `src/components/InfoBox.astro`, `src/components/EntrySection.astro`, `src/styles/entry.css`
- Modify: `src/components/EntryDetail.astro`, `src/components/BookSource.astro`, `src/components/EntryIcon.astro`, `src/lib/related.ts`, `src/pages/[lang]/armor/[set].astro`, `src/layouts/Base.astro`
- Test: `tests/unit/site/related.test.ts`, `tests/e2e/wiki.spec.ts`

**Interfaces:**
- Consumes: `itemKicker`、`setKicker`、`findArmorSet`、`findEntry`、UI 鍵 `category rarity armorPiece translation details pieces setPieces`
- Produces:
  - `EntryIcon` 新屬性 `loading?: "lazy" | "eager"`（預設 `lazy`）
  - `RelatedLink` 新欄位 `icon?: string; category: Category; variant: "normal" | "unique"`
  - `<EntrySection title en testid?>`、`<InfoBox lang entry>`
  - DOM：`.entry-kicker`、`.entry-layout`、`aside.info-box[data-testid=info-box]`（內含 `.entry-head`、`dl.facts`）、`.entry-content`、`section.entry-section`、`ul.related`

- [ ] **Step 1: 修改 `tests/unit/site/related.test.ts`，加入圖示欄位的期望**

把第一個測試的期望改成：

```ts
    expect(relatedLinks("zh", sword!)).toContainEqual({
      labelKey: "relatedVariant",
      href: "/zh/melee/sword-unique1/",
      name: { zh: "燃燒之刃", en: "The Burning Blade" },
      icon: "icons/melee/sword-unique1.png",
      category: "melee",
      variant: "unique",
    });
```

並把第二個測試的 `expect.objectContaining({ labelKey: "armorSet", href: "/en/armor/disciple/" })` 改成 `expect.objectContaining({ labelKey: "armorSet", href: "/en/armor/disciple/", category: "armor" })`。

- [ ] **Step 2: 寫失敗 E2E 測試（附加到結尾）**

```ts
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
```

- [ ] **Step 3: 執行確認失敗**

Run: `npx vitest run tests/unit/site/related.test.ts; npm run build && npx playwright test --project=chromium --reporter=line -g "info box|unique kicker|slot icon|same info box"`
Expected: FAIL（`relatedLinks` 沒有 `icon`；沒有 `.entry-kicker`、`info-box`）。

- [ ] **Step 4: 修改 `src/lib/related.ts`**

```ts
import type { Category, Lang } from "../../scripts/extract/config";
import type { Entry, Localized } from "../../scripts/extract/schemas";
import { findArmorSet, findEntry } from "./data";
import type { UiKey } from "./i18n";
import { entryHref, href } from "./url";

export interface RelatedLink {
  readonly labelKey: UiKey;
  readonly href: string;
  readonly name: Localized;
  readonly icon?: string;
  readonly category: Category;
  readonly variant: Entry["variant"];
}

const toLink = (lang: Lang, labelKey: UiKey, target: Entry | undefined): RelatedLink[] =>
  target
    ? [{
        labelKey,
        href: entryHref(lang, target),
        name: target.name,
        ...(target.icon ? { icon: target.icon } : {}),
        category: target.category,
        variant: target.variant,
      }]
    : [];

export function relatedLinks(lang: Lang, entry: Entry): RelatedLink[] {
  const { variants = [], armorSet } = entry.links;
  const set = armorSet ? findArmorSet(armorSet) : undefined;
  return [
    ...variants.flatMap((slug) => toLink(lang, "relatedVariant", findEntry(entry.category, slug))),
    ...(set
      ? [{ labelKey: "armorSet" as const, href: href(lang, "armor", set.slug), name: set.name, category: "armor" as const, variant: set.variant }]
      : []),
  ];
}
```

- [ ] **Step 5: 執行 related 單元測試確認通過**

Run: `npx vitest run tests/unit/site/related.test.ts`
Expected: PASS。

- [ ] **Step 6: 改寫 `src/components/EntryIcon.astro`，加入 `loading` 屬性**

```astro
---
import type { Category } from "../../scripts/extract/config";
import type { Entry } from "../../scripts/extract/schemas";
import { frameFor } from "../lib/frames";
import { assetUrl } from "../lib/url";

interface Props {
  icon?: string;
  alt: string;
  size?: number;
  /** Draws the game's slot frame for this category behind the icon. */
  category?: Category;
  /** Unique gear gets the orange inventory slot with the corner rarity mark. */
  variant?: Entry["variant"];
  /** Above-the-fold icons load eagerly. */
  loading?: "lazy" | "eager";
}

// The in-game inventory slot is about 103px wide; its borders are measured in those pixels.
const INVENTORY_SLOT_PX = 103;

const { icon, alt, size = 64, category, variant = "normal", loading = "lazy" } = Astro.props;
const frame = category ? frameFor(category) : undefined;
const box = `width:${size}px;height:${size}px`;
const unique = frame?.name === "inventory" && variant === "unique";
const frameStyle = frame?.path
  ? `${box};--frame:url("${assetUrl(frame.path)}")`
  : `${box};--px:${(size / INVENTORY_SLOT_PX).toFixed(3)}px`;
---
{frame ? (
  <span class:list={["icon-frame", `frame-${frame.name}`, { "is-unique": unique }]} style={frameStyle}>
    {icon ? (
      <img class="entry-icon" src={assetUrl(icon)} alt={alt} width={size} height={size} loading={loading} decoding="async" />
    ) : (
      <span class="entry-icon framed-placeholder" role="img" aria-label={alt}>?</span>
    )}
    {unique && <span class="slot-mark" aria-hidden="true" />}
  </span>
) : icon ? (
  <img class="entry-icon" src={assetUrl(icon)} alt={alt} width={size} height={size} loading={loading} decoding="async" />
) : (
  <span class="entry-icon placeholder-icon" style={box} role="img" aria-label={alt}>?</span>
)}
```

- [ ] **Step 7: 建立 `src/components/EntrySection.astro`**

```astro
---
interface Props {
  title: string;
  /** Uppercase English label shown in the game's label font. */
  en: string;
  testid?: string;
}

const { title, en, testid } = Astro.props;
---
<section class="entry-section" data-testid={testid}>
  <h2 class="section-title"><span class="section-en">{en}</span><span>{title}</span></h2>
  <slot />
</section>
```

- [ ] **Step 8: 建立 `src/components/InfoBox.astro`**

```astro
---
import type { Entry } from "../../scripts/extract/schemas";
import { findArmorSet } from "../lib/data";
import { CATEGORY_LABEL, PIECE_LABEL, t, type Lang } from "../lib/i18n";
import { categoryIcon, pieceIcon } from "../lib/ui-icons";
import { href } from "../lib/url";
import EntryIcon from "./EntryIcon.astro";
import UiIcon from "./UiIcon.astro";

interface Props {
  lang: Lang;
  entry: Entry;
}

const { lang, entry } = Astro.props;
const set = entry.links.armorSet ? findArmorSet(entry.links.armorSet) : undefined;
const listCategory = entry.category === "enchantment-book" ? "enchantment" : entry.category;
---
<aside class="info-box panel" data-testid="info-box">
  <div class="entry-head">
    <EntryIcon icon={entry.icon} alt={entry.name[lang]} size={160} category={entry.category} variant={entry.variant} loading="eager" />
  </div>
  <dl class="facts">
    <div>
      <dt>{t(lang, "category")}</dt>
      <dd><a href={href(lang, listCategory)}><UiIcon src={categoryIcon(entry.category)} />{CATEGORY_LABEL[entry.category][lang]}</a></dd>
    </div>
    <div>
      <dt>{t(lang, "rarity")}</dt>
      <dd class:list={{ "is-unique": entry.variant === "unique" }}>{t(lang, entry.variant)}</dd>
    </div>
    {entry.armorPiece && (
      <div>
        <dt>{t(lang, "armorPiece")}</dt>
        <dd><UiIcon src={pieceIcon(entry.armorPiece)} />{PIECE_LABEL[entry.armorPiece][lang]}</dd>
      </div>
    )}
    {set && (
      <div>
        <dt>{t(lang, "armorSet")}</dt>
        <dd><a href={href(lang, "armor", set.slug)}>{set.name[lang]}</a></dd>
      </div>
    )}
    {entry.untranslated?.includes(lang) && (
      <div>
        <dt>{t(lang, "translation")}</dt>
        <dd><span class="tag warn">{t(lang, "untranslated")}</span></dd>
      </div>
    )}
  </dl>
</aside>
```

- [ ] **Step 9: 改寫 `src/components/EntryDetail.astro`**

```astro
---
import type { Entry } from "../../scripts/extract/schemas";
import { t, type Lang } from "../lib/i18n";
import { itemKicker } from "../lib/kicker";
import { relatedLinks } from "../lib/related";
import BookSource from "./BookSource.astro";
import EntryIcon from "./EntryIcon.astro";
import EntrySection from "./EntrySection.astro";
import InfoBox from "./InfoBox.astro";
import LangText from "./LangText.astro";

interface Props {
  lang: Lang;
  entry: Entry;
}

const { lang, entry } = Astro.props;
const related = relatedLinks(lang, entry);
---
<article class="entry-detail" data-pagefind-body>
  <p class="kicker entry-kicker">{itemKicker(entry.category, entry.variant)}</p>
  <div class="entry-layout">
    <InfoBox lang={lang} entry={entry} />
    <div class="entry-content">
      <LangText as="h1" lang={lang} value={entry.name} searchTitle class={entry.variant === "unique" ? "is-unique" : undefined} />
      {entry.description && (
        <EntrySection title={t(lang, "description")} en="DESCRIPTION">
          <LangText as="p" class="description" lang={lang} value={entry.description} html />
        </EntrySection>
      )}
      {entry.descriptionLong && (
        <EntrySection title={t(lang, "details")} en="DETAILS">
          <LangText as="p" class="description-long" lang={lang} value={entry.descriptionLong} html />
        </EntrySection>
      )}
      {entry.unlock && (
        <EntrySection title={t(lang, "unlock")} en="UNLOCK" testid="unlock">
          <LangText as="p" lang={lang} value={entry.unlock} html />
        </EntrySection>
      )}
      {entry.category === "enchantment" && <BookSource lang={lang} enchantment={entry} />}
      {related.length > 0 && (
        <EntrySection title={t(lang, "related")} en="RELATED">
          <ul class="related">
            {related.map((link) => (
              <li>
                <span class="related-label">{t(lang, link.labelKey)}</span>
                <a href={link.href}>
                  {link.icon && <EntryIcon icon={link.icon} alt="" size={40} category={link.category} variant={link.variant} />}
                  <LangText lang={lang} value={link.name} />
                </a>
              </li>
            ))}
          </ul>
        </EntrySection>
      )}
    </div>
  </div>
</article>
```

- [ ] **Step 10: 改寫 `src/components/BookSource.astro`**

```astro
---
import type { Entry } from "../../scripts/extract/schemas";
import { booksFor } from "../lib/data";
import { t, type Lang } from "../lib/i18n";
import EntryIcon from "./EntryIcon.astro";
import EntrySection from "./EntrySection.astro";
import LangText from "./LangText.astro";

interface Props {
  lang: Lang;
  enchantment: Entry;
}

const { lang, enchantment } = Astro.props;
const books = booksFor(enchantment.slug);
// A book usually repeats the enchantment's own text; only show its description when it adds something.
const shownTexts = new Set([enchantment.description?.[lang], enchantment.descriptionLong?.[lang]]);
---
{books.length > 0 && (
  <EntrySection title={t(lang, "enchantmentBook")} en="ENCHANTMENT BOOK" testid="book-source">
    <div class="book-source">
      <p class="note">{t(lang, "obtainedFromBook")}</p>
      <ul>
        {books.map((book) => (
          <li class="book">
            <EntryIcon icon={book.icon} alt={book.name[lang]} size={40} category={book.category} variant={book.variant} />
            <div>
              <LangText lang={lang} value={book.name} />
              {book.description && !shownTexts.has(book.description[lang]) && (
                <LangText as="p" lang={lang} value={book.description} html />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  </EntrySection>
)}
```

- [ ] **Step 11: 改寫 `src/pages/[lang]/armor/[set].astro`**

```astro
---
import { LANGS } from "../../../../scripts/extract/config";
import { ARMOR_PIECES, type ArmorSet } from "../../../../scripts/extract/schemas";
import EntryIcon from "../../../components/EntryIcon.astro";
import EntrySection from "../../../components/EntrySection.astro";
import LangText from "../../../components/LangText.astro";
import UiIcon from "../../../components/UiIcon.astro";
import Base from "../../../layouts/Base.astro";
import { allArmorSets, findEntry } from "../../../lib/data";
import { PIECE_LABEL, t, type Lang } from "../../../lib/i18n";
import { setKicker } from "../../../lib/kicker";
import { pieceIcon } from "../../../lib/ui-icons";
import { entryHref } from "../../../lib/url";

export function getStaticPaths() {
  return LANGS.flatMap((lang) => allArmorSets.map((set) => ({ params: { lang, set: set.slug }, props: { set } })));
}

const lang = Astro.params.lang as Lang;
const { set } = Astro.props as { set: ArmorSet };
const pieces = ARMOR_PIECES.flatMap((piece) => {
  const slug = set.pieces[piece];
  const entry = slug ? findEntry("armor", slug) : undefined;
  return entry ? [{ piece, entry }] : [];
});
---
<Base lang={lang} title={set.name[lang]} current="armor">
  <article class="entry-detail armor-set" data-pagefind-body>
    <p class="kicker entry-kicker">{setKicker(set.variant)}</p>
    <div class="entry-layout">
      <aside class="info-box panel" data-testid="info-box">
        <div class="set-preview">
          {pieces.map(({ entry }) => (
            <EntryIcon icon={entry.icon} alt={entry.name[lang]} size={72} category={entry.category} variant={entry.variant} loading="eager" />
          ))}
        </div>
        <dl class="facts">
          <div>
            <dt>{t(lang, "rarity")}</dt>
            <dd class:list={{ "is-unique": set.variant === "unique" }}>{t(lang, set.variant)}</dd>
          </div>
          <div>
            <dt>{t(lang, "pieces")}</dt>
            <dd>{pieces.length}</dd>
          </div>
        </dl>
      </aside>
      <div class="entry-content">
        <LangText as="h1" lang={lang} value={set.name} searchTitle class={set.variant === "unique" ? "is-unique" : undefined} />
        <EntrySection title={t(lang, "setPieces")} en="PIECES">
          <ul class="set-pieces">
            {pieces.map(({ piece, entry }) => (
              <li class="set-piece" data-testid="set-piece">
                <a href={entryHref(lang, entry)}>
                  <EntryIcon icon={entry.icon} alt={entry.name[lang]} category={entry.category} variant={entry.variant} />
                  <span>
                    <span class="piece-label"><UiIcon src={pieceIcon(piece)} />{PIECE_LABEL[piece][lang]}</span>{" "}
                    <LangText lang={lang} value={entry.name} />
                  </span>
                </a>
                {entry.description && <LangText as="p" lang={lang} value={entry.description} html />}
              </li>
            ))}
          </ul>
        </EntrySection>
      </div>
    </div>
  </article>
</Base>
```

- [ ] **Step 12: 建立 `src/styles/entry.css`**

```css
.entry-kicker { margin-bottom: 8px; }
.entry-layout { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
.info-box { padding: 16px; }
.info-box .entry-head { display: flex; justify-content: center; margin-bottom: 14px; }
.facts { margin: 0; }
.facts > div { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--border); }
.facts dt { color: var(--muted); font-size: 0.85rem; }
.facts dd { margin: 0; text-align: right; font-family: var(--font-pixel); display: inline-flex; align-items: center; gap: 4px; }
.facts dd a { display: inline-flex; align-items: center; gap: 4px; }
.facts dd.is-unique { color: var(--accent); }
.entry-content h1 { margin: 0 0 8px; font-size: clamp(1.6rem, 4vw, 2.4rem); }
.entry-content h1.is-unique .primary { color: var(--accent); }
.description { font-size: 1.05rem; }

.related { list-style: none; padding: 0; display: grid; gap: 10px; }
.related li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.related-label { color: var(--muted); font-size: 0.8rem; min-width: 5em; }
.related a { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; }

.set-preview { display: grid; grid-template-columns: repeat(2, 72px); gap: 10px; justify-content: center; margin-bottom: 14px; }
.set-pieces { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.set-piece { background: var(--surface); border: 2px solid var(--border); padding: 12px; }
.set-piece a { display: flex; gap: 10px; align-items: center; color: var(--text); text-decoration: none; }
.piece-label { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 0.8rem; }

.book-source ul { list-style: none; padding: 0; display: grid; gap: 8px; }
.book-source .book { display: flex; gap: 10px; align-items: flex-start; }
.book-source .book p { margin: 4px 0 0; }

@media (min-width: 900px) {
  .entry-layout { grid-template-columns: 260px 1fr; }
  .info-box { position: sticky; top: 16px; }
}
```

- [ ] **Step 13: 匯入 `entry.css`**

在 `Base.astro` 的 `import "../styles/items.css";` 下一行加 `import "../styles/entry.css";`。

- [ ] **Step 14: 建置並執行完整測試**

Run: `npm run build && npx vitest run && npx playwright test --reporter=line`
Expected: 全過。既有的 `.entry-head img.entry-icon`、`.entry-head .icon-frame…`、`.related a[href='/zh/armor/disciple/']`、`set-piece`、`.piece-label img.ui-icon`、`book-source`、附魔書框幾何測試仍成立。

- [ ] **Step 15: Commit**

```bash
git add src/components src/lib/related.ts src/styles/entry.css src/pages src/layouts/Base.astro tests
git commit -m "feat: lay out entry and armor set pages with a game-style info box"
```

---

### Task 7: 效果表格、搜尋頁、移除舊樣式與最終檢查

**Files:**
- Create: `src/styles/search.css`
- Modify: `src/components/EntryTable.astro`, `src/styles/items.css`, `src/layouts/Base.astro`, `README.md`, `tests/e2e/wiki.spec.ts`
- Delete: `src/styles/legacy.css`

**Interfaces:**
- Consumes: 前述所有樣式檔
- Produces: 最終樣式匯入順序 `tokens → base → frames → layout → home → items → entry → search`

- [ ] **Step 1: 寫失敗 E2E 測試（附加到結尾）**

```ts
test("the effects table and search results use the game palette", async ({ page }) => {
  await page.goto("/zh/effect/");
  const head = await page.locator(".entry-table thead th").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(head).toBe("rgb(28, 43, 49)");
  await page.goto("/zh/search/?q=sword");
  await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
  const primary = await page.locator("#search .pagefind-ui").evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--pagefind-ui-primary").trim().toLowerCase(),
  );
  expect(primary).toBe("#ff7e2f");
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
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npx playwright test --project=chromium --reporter=line -g "effects table and search|no purple"`
Expected:「effects table and search」FAIL（表頭與 Pagefind 仍為舊樣式）；「no purple」此時已通過（Task 1 已換掉配色），它作為移除 `legacy.css` 後的回歸防護。

- [ ] **Step 3: 在 `src/styles/items.css` 結尾加入效果表格樣式**

```css
.entry-table { width: 100%; border-collapse: collapse; background: var(--surface); border: 2px solid var(--border); }
.entry-table thead th {
  background: var(--surface-2); font-family: var(--font-label); font-size: 0.75rem;
  letter-spacing: 1px; color: var(--muted);
}
.entry-table th, .entry-table td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.entry-table tr:has(:target) { background: var(--surface-2); }
.row-name { margin: 0; font-size: 1.05rem; }
.row-head { display: flex; gap: 8px; align-items: center; }
```

- [ ] **Step 4: 建立 `src/styles/search.css`**

```css
/* Pagefind sets its defaults on .pagefind-ui, so override on that element with higher specificity. */
#search .pagefind-ui {
  --pagefind-ui-primary: #ff7e2f;
  --pagefind-ui-text: var(--text);
  --pagefind-ui-background: var(--surface);
  --pagefind-ui-border: var(--border);
  --pagefind-ui-tag: var(--surface-2);
  --pagefind-ui-border-width: 2px;
  --pagefind-ui-border-radius: 0;
  --pagefind-ui-font: var(--font-body);
}
#search .pagefind-ui__result-title { font-family: var(--font-pixel); }
```

- [ ] **Step 5: 更新 `Base.astro` 的樣式匯入並刪除 `legacy.css`**

把 `import "../styles/legacy.css";` 這行刪掉，並在 `import "../styles/entry.css";` 下一行加 `import "../styles/search.css";`。然後：

```bash
git rm -q src/styles/legacy.css
grep -rn "legacy.css\|global.css" src || echo "no references"
```
Expected: `no references`。

- [ ] **Step 6: 建置並執行完整測試**

Run: `npm run build && npx vitest run && npx playwright test --reporter=line`
Expected: 全過。若有版面規則遺失（例如某個元素失去樣式），把對應規則從 git 歷史中的 `legacy.css`（`git show HEAD~1:src/styles/legacy.css`）搬到適當的新樣式檔並以當前配色調整，再重跑。

- [ ] **Step 7: 子路徑建置驗證字型與授權連結**

Run（Git Bash）：
```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/mcd2-wiki/ npm run build
grep -o 'href="/mcd2-wiki/licenses/Cubic-11-OFL.txt"' dist/zh/index.html | head -1
grep -ho '/mcd2-wiki/_astro/Cubic_11[^")]*\.woff2' dist/_astro/*.css | head -1
npm run build
```
Expected: 兩個 grep 都有輸出；最後還原預設建置。

- [ ] **Step 8: 截圖目視檢查**

Run: `npm run preview`（背景執行）後：
```bash
for p in zh/ zh/melee/ zh/melee/sword-unique1/ zh/armor/disciple/ zh/effect/ zh/search/?q=sword; do
  npx playwright screenshot --wait-for-timeout=2500 --viewport-size=1200,800 "http://localhost:4329/$p" "shot-$(echo $p | tr '/?=' '___').png"
  npx playwright screenshot --wait-for-timeout=2500 --device="Pixel 7" "http://localhost:4329/$p" "shot-m-$(echo $p | tr '/?=' '___').png"
done
```
Expected: 逐張檢視：無紫色、像素字標題、分類分頁、說明面板（桌機）、資訊欄兩欄（桌機）／堆疊（手機）。發現問題則修正並重跑 Step 6。檢查完刪除截圖檔（`rm shot-*.png`）。

- [ ] **Step 9: 更新 `README.md`**

在「## 開發」區塊後加入：

````markdown
## 字型

- 俐方體 11 號（Cubic 11，`src/assets/fonts/cubic-11/`）與 Silkscreen（`@fontsource/silkscreen`）皆為 SIL Open Font License 1.1。
- 授權全文：`public/licenses/Cubic-11-OFL.txt`（網站頁尾有連結）；Silkscreen 授權隨 npm 套件提供。
````

- [ ] **Step 10: Commit**

```bash
git add src README.md tests/e2e/wiki.spec.ts
git commit -m "feat: restyle effects and search, and drop the pre-redesign stylesheet"
```

# 多語言網站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Minecraft Dungeons II Wiki 從繁中＋英文擴成 16 種語言的完整網站，每種語言一套頁面，對照英文（英文對照繁中），標題列改為語言下拉選單。

**Architecture:** 先在不改變語言數量的前提下，把「剛好兩種語言」的寫法收斂到幾個輔助函式與 JSON 語言檔（Task 1–3），讓之後只要把 `LANGS` 擴成 16 個，就能讓 TypeScript 一次標出所有剩下的缺口（Task 4）。遊戲內容來自 16 個語系檔；介面字串先用遊戲字串，其餘機器翻譯（Task 5）。最後補上語言選單、根目錄導向、字型與驗證（Task 6–9）。

**Tech Stack:** Astro 7、TypeScript、zod 4、Vitest 5、Playwright 1.64、Pagefind 1.5、Leaflet 1.9、`@fontsource/noto-serif{,-sc,-jp,-kr,-tc}`。

**Spec:** `docs/superpowers/specs/2026-10-11-multilingual-design.md`

## Global Constraints

- 分支 `feat/multilingual`，worktree `D:\Project\mcd2-wiki\.claude\worktrees\multilingual`。`source-data` 是指向主 checkout 的 junction，只能讀。worktree 第一次使用前要跑 `npm ci` 與 `npx astro sync`。PR #12（`fix/map-zoom`）合併後，先 `git rebase origin/master` 再開始，或在 Task 9 前 rebase。
- 語言代碼與順序（逐字）：`zh, zh-hans, en, ja, ko, de, fr, es, it, pt, ru, pl, nl, sv, tr, uk`；對應的語系檔資料夾、htmlLang、OG locale、自稱見 spec §1.1。
- 對照規則：`compareLang("en") = "zh"`，其他語言一律 `"en"`。
- 缺字補位：英文缺字時整筆沒有文字；其他語言缺字時用英文，並把該語言記進 `untranslated`。
- `localStorage` 鍵：`mcd2-compare`（沿用）、`mcd2-lang`（新增）。讀寫都包 try/catch。
- 網址 slug 不變，只換第一段的語言代碼。
- 數字格式不在地化（維持 `20%`、`1.5`）；卡片上的英文 kicker 維持英文。
- 新增套件只有：`@fontsource/noto-serif`、`@fontsource/noto-serif-sc`、`@fontsource/noto-serif-jp`、`@fontsource/noto-serif-kr`（700 字重）。
- 換行符號依各檔案現況（repo 多數是 CRLF；改檔前用 `git show HEAD:<file> | grep -c $'\r$'` 確認）。不可變資料（回傳新物件）；函式少於 50 行、檔案不超過 400 行。Commit 訊息用 conventional commits，不加 attribution 行。
- 預覽與 E2E 用 port 4329；開始前確認沒有其他 preview 佔用（PowerShell：`Get-NetTCPConnection -LocalPort 4329 -State Listen`）。

## Review Focus

1. **中文、日文的雙佔位符句子**，例如 `SW_Effect_HealthyStrike`、`SW_Effect_SpeedIncrement`，在 zh-Hant 與 ja 中 `{1}` 出現在 `{0}` 前面 → 數值要依編號填入，不能依出現順序。（Task 2 測試）
2. **俄文複數語法** `{1}|plural(one=…,few=…,many=…,other=…)` → 依數值選詞形，不能把語法原樣顯示在頁面上。（Task 2 測試）
3. **土耳其文的大小寫**：`İ`／`I` 在篩選與地圖搜尋中要比對得到 → 用 `toLocaleLowerCase(htmlLang)`。（Task 4 測試）
4. **瀏覽器語言是 `zh-HK`、`zh-SG`、`pt-PT`、`en-GB`、`es-MX`** → 分別導到 `zh`、`zh-hans`、`pt`、`en`、`es`。（Task 7 測試）
5. **韓文、日文、簡中、俄文頁面的標題字型**能顯示該語言的文字，不出現豆腐方塊。（Task 8 E2E）

---

### Task 1: 語言清單與兩語輔助函式（語言數量暫不變）

**Files:**
- Modify: `scripts/extract/config.ts`（新增 `ALL_LANGS`、`LANG_META`；`LANGS` 暫時維持 `["zh","en"]`）
- Create: `src/lib/lang.ts`
- Modify: `src/lib/i18n.ts`（`HTML_LANG`、`otherLang` 改用 `src/lib/lang.ts`）、`src/layouts/Base.astro`（`OG_LOCALE` 改用 `LANG_META`）
- Modify: 所有直接寫 `.zh`／`.en` 讀取或組裝 `{ zh, en }` 的網站端程式（盤點見 spec 附的 findings §2、§4），改用 `pick`／`mapLocalized`
- Test: `tests/unit/site/lang.test.ts`

**Interfaces:**
- Produces（`scripts/extract/config.ts`）：
  ```ts
  export const ALL_LANGS = ["zh", "zh-hans", "en", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"] as const;
  export type AnyLang = (typeof ALL_LANGS)[number];
  export type FontScript = "tc" | "sc" | "jp" | "kr" | "latin" | "cyrillic";
  export interface LangMeta { readonly culture: string; readonly htmlLang: string; readonly ogLocale: string; readonly nativeName: string; readonly fontScript: FontScript }
  export const LANG_META: Readonly<Record<AnyLang, LangMeta>>;
  export const LANGS = ["zh", "en"] as const;          // Task 4 改成 ALL_LANGS
  export type Lang = (typeof LANGS)[number];
  export const CULTURE: Readonly<Record<Lang, string>>; // 由 LANG_META 衍生
  ```
- Produces（`src/lib/lang.ts`）：
  ```ts
  export const compareLang = (lang: Lang): Lang;            // en → zh，其他 → en
  export const pick = (value: Localized, lang: Lang): string;
  export const mapLocalized = (value: Localized, fn: (text: string, lang: Lang) => string): Localized;
  export const htmlLang = (lang: Lang): string;              // LANG_META[lang].htmlLang
  export const lowerFor = (text: string, lang: Lang): string; // text.toLocaleLowerCase(htmlLang(lang))
  ```

- [ ] **Step 1: 寫失敗的測試** `tests/unit/site/lang.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ALL_LANGS, LANG_META } from "../../../scripts/extract/config";
import { compareLang, lowerFor, mapLocalized, pick } from "../../../src/lib/lang";

describe("language registry", () => {
  it("lists the 16 site languages in menu order with their metadata", () => {
    expect(ALL_LANGS).toEqual(["zh", "zh-hans", "en", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"]);
    expect(LANG_META.zh).toEqual({ culture: "zh-Hant", htmlLang: "zh-TW", ogLocale: "zh_TW", nativeName: "繁體中文", fontScript: "tc" });
    expect(LANG_META["zh-hans"].culture).toBe("zh-Hans");
    expect(LANG_META.pt).toMatchObject({ culture: "pt-BR", htmlLang: "pt-BR" });
    expect(LANG_META.ru.fontScript).toBe("cyrillic");
    for (const lang of ALL_LANGS) expect(LANG_META[lang].nativeName).not.toBe("");
  });
});

describe("language helpers", () => {
  it("compares English with Traditional Chinese and every other language with English", () => {
    expect(compareLang("en")).toBe("zh");
    expect(compareLang("zh")).toBe("en");
  });

  it("picks and maps localized text without changing the input", () => {
    const value = { zh: "劍", en: "Sword" };
    expect(pick(value, "zh")).toBe("劍");
    expect(mapLocalized(value, (text, lang) => `${lang}:${text}`)).toEqual({ zh: "zh:劍", en: "en:Sword" });
    expect(value).toEqual({ zh: "劍", en: "Sword" });
  });

  it("lowercases with the language's own rules", () => {
    expect(lowerFor("SWORD", "en")).toBe("sword");
  });
});
```

（`LANG_META` 的完整內容照 spec §1.1 的表填。土耳其文的 `lowerFor` 測試在 Task 4 語言擴充後再加。）

- [ ] **Step 2: 跑測試確認失敗**：`npx vitest run tests/unit/site/lang.test.ts`，預期因找不到模組而失敗。
- [ ] **Step 3: 實作** `config.ts` 新增的內容與 `src/lib/lang.ts`。`mapLocalized` 用 `Object.fromEntries(LANGS.map(lang => [lang, fn(value[lang], lang)])) as Localized`。
- [ ] **Step 4: 收斂兩語寫法（網站端）**：
  - `otherLang` 的所有使用處改成 `compareLang`（findings §1 列出的 5 個元件）。`i18n.ts` 暫時保留 `export const otherLang = compareLang;`，讓既有測試還能過；Task 4 再刪掉。
  - `HTML_LANG[x]` 改成 `htmlLang(x)`。
  - `Base.astro` 的 `OG_LOCALE` 改用 `LANG_META[lang].ogLocale`。
  - `gear-values.ts` 的 `fill` 改用 `mapLocalized`；`isFullyDescribed` 改成檢查所有 `LANGS`。
  - `WeaponEffects.astro` 的 `{ zh: fillPlaceholders(text.zh…), en: … }` 改用 `mapLocalized`；`${fixedText.zh}${fixedText.en}` 改成 `LANGS.map(l => fixedText[l]).join("")`。
  - `ItemCard.astro`、`EntryTable.astro` 的 `data-names` 改成 `[lang, compareLang(lang)].map(l => lowerFor(name[l], lang)).join(" ")`。
  - `src/lib/map/markers.ts` 的搜尋文字改收 `[lang, compareLang(lang)]` 兩種語言：`searchMarkers` 新增 `lang` 參數，viewer 傳入 `root.dataset.lang`；用 `lowerFor` 比對。同步更新 `tests/unit/site/map-markers.test.ts`。
- [ ] **Step 5: 驗證**：`npx tsc --noEmit -p .`、`npm test`、`npm run test:e2e`，全部通過，且網站行為不變。
- [ ] **Step 6: Commit**：`refactor: route language-specific code through language helpers`

---

### Task 2: 佔位符依編號填入與俄文複數（修正既有錯誤）

**Files:**
- Modify: `scripts/extract/render-markup.ts`、`src/lib/gear-values.ts`（`fillPlaceholders`、`PLACEHOLDER`、`UNFILLED`）、`src/components/WeaponEffects.astro`（若直接呼叫）
- Test: `tests/unit/extract/render-markup.test.ts`、`tests/unit/site/gear-values.test.ts`、`tests/integration/pipeline.test.ts`（佔位符的斷言）

**Interfaces:**
- Produces：`renderMarkup(text, lang)` 輸出 `<span class="placeholder" data-slot="N">{標籤}</span>`；遇到 `{N}|plural(k=v,…)` 時輸出 `<span class="plural" data-slot="N" data-forms="{&quot;one&quot;:…}"></span>`（JSON 經 HTML escape）。
- Produces：`fillPlaceholders(html: string, values: readonly string[], lang: Lang): string`，依 `data-slot` 填入；複數依 `new Intl.PluralRules(htmlLang(lang)).select(Number(value))` 選詞形，數值不是數字時用 `other`；找不到該詞形時依序退回 `other`、第一個詞形。

- [ ] **Step 1: 寫失敗的測試**

`render-markup.test.ts` 新增：

```ts
it("keeps each placeholder's slot number", () => {
  expect(renderMarkup("移動超過 {1} 秒後，移動速度提高 {0}。", "zh").html).toBe(
    '移動超過 <span class="placeholder" data-slot="1">{數值}</span> 秒後，移動速度提高 <span class="placeholder" data-slot="0">{數值}</span>。',
  );
});

it("turns the game's plural syntax into a plural slot", () => {
  const { html, warnings } = renderMarkup("дольше {1} {1}|plural(one=секунды,few=секунд,many=секунд,other=секунды).", "en");
  expect(warnings).toEqual([]);
  expect(html).toContain('<span class="placeholder" data-slot="1">');
  expect(html).toContain('<span class="plural" data-slot="1" data-forms="{&quot;one&quot;:&quot;секунды&quot;,&quot;few&quot;:&quot;секунд&quot;,&quot;many&quot;:&quot;секунд&quot;,&quot;other&quot;:&quot;секунды&quot;}"></span>');
  expect(html).not.toContain("|plural(");
});
```

`gear-values.test.ts` 新增：

```ts
it("fills placeholders by slot, not by order of appearance", () => {
  const html = '移動超過 <span class="placeholder" data-slot="1">{數值}</span> 秒後，提高 <span class="placeholder" data-slot="0">{數值}</span>。';
  expect(fillPlaceholders(html, ["20%", "3"], "zh")).toBe('移動超過 <span class="value">3</span> 秒後，提高 <span class="value">20%</span>。');
});

it("picks the plural form for the value", () => {
  const forms = JSON.stringify({ one: "секунду", few: "секунды", many: "секунд", other: "секунды" }).replace(/"/g, "&quot;");
  const html = `<span class="placeholder" data-slot="0">{x}</span> <span class="plural" data-slot="0" data-forms="${forms}"></span>`;
  expect(fillPlaceholders(html, ["5"], "en")).toBe('<span class="value">5</span> <span class="plural">секунд</span>');
});
```

（第二個測試在 Task 4 擴成 16 語後，把 `lang` 改成 `"ru"`。現在先用 `"en"` 的複數規則，`5` 在英文是 `other`，所以期望值要對應改成 `секунды`。Task 4 擴充後改成 `"ru"` 並期望 `секунд`。實作者照這個時序寫測試。）

- [ ] **Step 2: 跑測試確認失敗。**
- [ ] **Step 3: 實作**：
  - TOKEN 加入一個分支 `\{(\d+)\}\|plural\(([^)]*)\)`，**排在 `\{(\w+)\}` 之前**。
  - 解析 `k=v`（以逗號分隔），組成 forms，輸出複數 span。
  - 一般佔位符的 `data-slot` 用 `{}` 內的名稱；非數字的名稱（例如 `{armor}`）也照用，填入時找不到對應值就保持原樣。
  - `PLACEHOLDER`、`UNFILLED` 的 regex 改成比對 `class="placeholder" data-slot="…"`。
- [ ] **Step 4: 修正呼叫端**：所有 `fillPlaceholders(…)` 呼叫都傳入 `lang`。`npm run extract` 重產資料後，`src/data/entries.json` 只應該多出 `data-slot` 屬性；拿 `git diff --stat` 與抽樣比對確認。
- [ ] **Step 5: 驗證並 Commit**：`fix: fill game text values by placeholder slot and support plural forms`

---

### Task 3: 介面字串搬到 JSON 語言檔，並接上遊戲字串

**Files:**
- Create: `src/i18n/zh.json`、`src/i18n/en.json`（內容來自現在的 `UI_STRINGS`，以及下面列出的散落字串）
- Create: `src/lib/ui-strings.ts`（載入、zod 驗證、`t()`）
- Modify: `src/lib/i18n.ts`（保留 `CATEGORY_LABEL`／`PIECE_LABEL`／`MARKER_LABEL` 的 API，但值改從語言檔與遊戲字串取）
- Modify: `src/lib/gear-values.ts`、`src/lib/weapon-stats.ts`（標籤、單位、第 N 擊、跳躍攻擊、清單分隔符、連擊表欄名、職業、重量）、`scripts/extract/render-markup.ts`（佔位符標籤）、`src/components/InfoBox.astro` 與 `src/pages/[lang]/armor/[set].astro`（「No.」）、`src/pages/[lang]/armor/index.astro`（全形冒號）
- Create: `scripts/extract/ui-game-keys.json`、`scripts/extract/ui-game-strings.ts`；Modify: `scripts/extract/pipeline.ts`（輸出 `src/data/ui-game-strings.json`）
- Test: `tests/unit/site/i18n.test.ts`（鍵集合一致、`_machine` 鍵存在）、`tests/unit/extract/ui-game-strings.test.ts`

**Interfaces:**
- 語言檔格式：`{ "_machine"?: string[], "<key>": string | { "one"?: string, "few"?: string, "many"?: string, "other": string } }`。只有單位類的鍵用複數物件。
- Produces（`src/lib/ui-strings.ts`）：
  ```ts
  export type UiKey;                                         // zh.json 的鍵（不含 _machine）
  export const t: (lang: Lang, key: UiKey) => string;          // 複數物件時回傳 other
  export const tCount: (lang: Lang, key: UiKey, count: number) => string; // 依 Intl.PluralRules 選詞形，{n} 換成數值
  export const machineKeys: (lang: Lang) => readonly UiKey[];
  ```
- 遊戲字串：`ui-game-keys.json` 是 `{ "<網站鍵>": { "namespace": "Text/Release/InventoryLabels.csv", "key": "header_armor" } }`。抽取時對每個 `LANGS` 用 `localize()` 取出，寫進 `src/data/ui-game-strings.json`（`Record<網站鍵, Localized>`）。查值順序：
  - zh、en：語言檔有就用語言檔，沒有才用遊戲字串。
  - 其他語言：遊戲字串優先，沒有才用語言檔。
- 至少要對應的網站鍵：12 個分類標籤（`CATEGORY_LABEL`）、4 個部位（`PIECE_LABEL`）、`rarityCommon/Rare/Special/unique`、`map`（TabLabels::tab_ingame_map）、`markerRift`、`markerMinecart`、`markerPortal`（SettingsLabels::Input_TownPortal）。對應的遊戲鍵見 spec 附的 findings §7.5。
- 把 `CATEGORY_LABEL[c][lang]` 改成 `categoryLabel(c, lang)` 這類函式，`PIECE_LABEL`、`MARKER_LABEL` 同理。所有使用處一起改。

- [ ] **Step 1: 寫失敗的測試**：
  - `i18n.test.ts`：每個 `LANGS` 的語言檔鍵集合（不含 `_machine`）等於 `zh.json`；`_machine` 列出的鍵都存在；`tCount("en","unitBlocks",1)` 為 `1 block`、`tCount("en","unitBlocks",3)` 為 `3 blocks`、`tCount("zh","unitBlocks",3)` 為 `3 格`。
  - `ui-game-strings.test.ts`：用 `makeLocales` 建立假資料，驗證對應與「沒有對應時回傳 undefined」。
- [ ] **Step 2: 實作語言檔與 `ui-strings.ts`**。`zh.json`、`en.json` 的內容與現在畫面上的文字**逐字相同**，網站外觀不能改變。散落字串用新鍵，例如 `unitSeconds`、`unitBlocks`、`swingN`（含 `{n}`）、`jumpAttack`、`listSeparator`、`comboHead1…6`、`archetype*`、`weight*`、`statLabel*`、`placeholderLabel`、`catalogNo`、`labelColon`、`rootRedirectTitle`、`goToLanguage`。
- [ ] **Step 3: 遊戲字串抽取並接進管線**；`npm run extract` 後確認 `src/data/ui-game-strings.json` 有內容，而且網站的繁中與英文畫面不變（zh、en 以語言檔為準）。
- [ ] **Step 4: 驗證**：`npx tsc --noEmit -p .`、`npm test`、`npm run test:e2e`，全部通過，畫面文字不變。
- [ ] **Step 5: Commit**：`refactor: move UI strings to per-language JSON and take labels from the game`

---

### Task 4: 擴成 16 種語言（抽取、資料、網站）

**Files:**
- Modify: `scripts/extract/config.ts`（`LANGS = ALL_LANGS`）、`schemas.ts`（`LocalizedSchema` 由 `LANGS` 產生 16 個必填鍵）、`parse-locale.ts`、`group-entries.ts`（`resolveText`、`isPlaceholderOnly`、`readTable`）、`assemble.ts`、`loc-table.ts`、`map.ts`（世界名的 fallback）、`link-entries.ts`（暫時：非 zh、en 語言的套裝名稱直接用英文並記進 `untranslated`；Task 5 再改）
- Create: `src/i18n/<14 個新語言>.json`（暫時複製 `en.json` 的值，把所有鍵列進 `_machine`；Task 6 翻譯）
- Modify: TypeScript 標出的所有剩餘錯誤處；`tests/helpers/locales.ts`（`makeLocales` 改成接受 `Record<namespace, Record<key, Partial<Record<Lang,string>>>>`，或用一個新 helper，避免 16 元素的 tuple）；各測試的 `{ zh, en }` fixture 改用 helper `loc({ zh, en })`，其餘語言自動補英文
- Modify: `src/components/WorldMap.astro`（內嵌資料只保留 `[lang, compareLang(lang)]`）
- Test: `tests/unit/extract/group-entries.test.ts`、`tests/integration/pipeline.test.ts`、`tests/unit/site/map-payload.test.ts`（新增）

**Interfaces:**
- Produces（`group-entries.ts`）：
  ```ts
  export function resolveText(key: string, texts: Partial<Record<Lang, string>>): { text?: Localized; untranslated: Lang[] };
  // 英文缺字 → {untranslated: []}；其他語言缺字 → 用英文，並把該語言放進 untranslated
  ```
- Produces（`src/lib/map/payload.ts`）：`trimWorld(world: WorldMap, langs: readonly Lang[]): WorldMap`，只保留指定語言的 `name`、`area`、`note`（型別上用 `Partial<Localized>`，viewer 只讀 `lang` 與對照語言）。
- 測試 helper：`tests/helpers/localized.ts` 匯出 `loc(partial: Partial<Localized> & { en: string }): Localized`，缺的語言補英文。

- [ ] **Step 1: 寫失敗的測試**：
  - `resolveText` 的新簽名：ja 缺字 → 用英文，`untranslated` 為 `["ja"]`；英文缺字 → 沒有文字。
  - 整合測試：fixture 寫入 `en`、`zh-Hant`、`ja-JP` 的語系檔，其他 13 種寫空物件 `{}`；斷言 Sword 的 `name.ja` 為日文、`name.de` 為英文、`untranslated` 含 `de`。
  - `trimWorld` 只留兩種語言。
  - `lowerFor("İSTANBUL","tr")` 為 `"istanbul"`；`lowerFor("I","tr")` 為 `"ı"`。
  - 把 Task 2 的複數測試改成 `"ru"`，期望 `секунд`。
- [ ] **Step 2: 把 `LANGS` 改成 `ALL_LANGS`**，用 `npx tsc --noEmit -p .` 列出所有錯誤，逐一改用 Task 1 的 helper 修正。不可以用 `as` 強制轉型或 `// @ts-ignore` 跳過檢查。
- [ ] **Step 3: 測試資料**：`makeLocales` 改為以語言為鍵；所有 `{ zh, en }` fixture 改用 `loc()`。
- [ ] **Step 4: 用真實資料抽取**：`npm run extract`。
  - 檢查 `entries.json` 的 Sword 有 16 語；各語言的 `untranslated` 數量列表（寫進報告）。
  - 確認 `extract-report.md` 沒有新的錯誤類型。
- [ ] **Step 5: 建置並抽樣**：`npm run build`，確認 `dist/ja/melee/sword/index.html` 存在，`<h1>` 是日文、對照是英文；`dist/en/…` 的對照是繁中。記錄建置時間。
- [ ] **Step 6: 移除 `otherLang` 別名**，驗證 `npm test`、`npm run test:e2e`，然後 Commit：`feat: build the site in 16 languages from the game's locale files`

---

### Task 5: 各語言的護甲套裝名稱

**Files:**
- Modify: `scripts/extract/link-entries.ts`（`setNameFor`）
- Test: `tests/unit/extract/link-entries.test.ts`

- [ ] **Step 1: 先查**：在 16 個語系檔中搜尋是否有套裝名稱鍵。
  - 例如 `InventoryLabels` 或 `DT_ItemDefinitionArmor.csv` 裡含 `Set` 的鍵；或用英文套裝名稱（`entries.json` 的 armor-sets）反查同一個值所在的鍵。
  - 把查找結果寫進報告。有可用的鍵就用它，並略過 Step 2 的規則。
- [ ] **Step 2: 依書寫系統定規則**（沒有可用的鍵時）：
  - `fontScript` 為 `latin`、`cyrillic` 的語言：共同前綴切在字詞邊界（現在的 `trimToWordBoundary`）。德文另外允許「沒有空格的複合字前綴」，條件是前綴至少 4 個字元，且每個部位名稱在前綴之後都以大寫或小寫字母接續（例如 `Jünger|helm`）。
  - `tc`、`sc`、`jp`、`kr`：去掉結尾的連接字 `之`、`の`、`의`，以及結尾空白。
  - 結果少於 2 個字元，或和任一部位名稱完全相同時：用英文名稱，並把該語言記進 `untranslated`。
- [ ] **Step 3: 測試**：每種書寫系統一例，用真實的 Disciple／修行者部位名稱組合：en「Disciple」、zh「修行者」、de 複合字、ja「の」、ru 退回英文。
- [ ] **Step 4: 抽取並列表**：`npm run extract`，在報告中列出「套裝 × 語言」的結果表（只列有退回英文的組合，以及 5 個抽樣），並寫進 PR 說明給使用者驗收。
- [ ] **Step 5: Commit**：`feat: name armor sets in every language`

---

### Task 6: 14 種新語言的介面翻譯

**Files:**
- Modify: `src/i18n/{zh-hans,ja,ko,de,fr,es,it,pt,ru,pl,nl,sv,tr,uk}.json`

- [ ] **Step 1: 逐語言翻譯**：
  - Task 3 的遊戲字串會覆蓋的鍵（`ui-game-keys.json` 列出的）不用翻，但檔內仍要有值（填英文或譯文都可以），不列進 `_machine`。
  - 其餘鍵依照 `en.json`（語氣）與 `zh.json`（意思）翻成該語言。`_machine` 改為列出實際機器翻譯的鍵。
  - 保留 `{n}` 等佔位符原樣。
  - 單位類鍵依該語言的複數類別提供 `one`、`few`、`many`、`other`（例如 ru、uk、pl 要有 `few`、`many`）。
- [ ] **Step 2: 特別檢查**：
  - `tagline`、`source`、`compare` 用語言中立的「對照英文」說法（spec §3.1）。
  - `siteTitle` 依 spec §3.1；`HomeHero` 的標題拆解要能處理沒有括號限定詞的標題。
  - `placeholderLabel` 要包在 `{}` 裡。
- [ ] **Step 3: 驗證**：`npm test`（鍵集合一致、`_machine` 鍵存在、複數鍵包含該語言需要的類別：用 `new Intl.PluralRules(htmlLang).resolvedOptions().pluralCategories` 檢查）。抽樣建置 ja、de、ru 的首頁，看介面文字是否正常。
- [ ] **Step 4: Commit**：`feat: translate the site's interface into 14 more languages`

---

### Task 7: 語言選單、根目錄導向、404、hreflang

**Files:**
- Create: `src/components/LangPicker.astro`、`src/lib/lang-detect.ts`
- Modify: `src/components/SiteHeader.astro`（換成 `LangPicker`）、`src/pages/index.astro`、`src/pages/404.astro`、`src/layouts/Base.astro`（hreflang、`og:locale:alternate`）、`src/styles/layout.css`
- Test: `tests/unit/site/lang-detect.test.ts`、`tests/e2e/i18n.spec.ts`（新增）、`tests/e2e/wiki.spec.ts`（舊的 lang-switch 測試）

**Interfaces:**
- Produces（`src/lib/lang-detect.ts`，純函式）：
  ```ts
  export function detectLang(stored: string | null, browser: readonly string[]): Lang;
  // stored 是合法代碼 → 直接用；否則逐一對照 browser：
  //   zh-TW/zh-HK/zh-MO/zh-Hant* → zh；zh-CN/zh-SG/zh-Hans*/zh → zh-hans；pt-* → pt；
  //   其他取「-」前的部分，比對代碼，比對不到再比對 htmlLang；都沒有 → zh
  ```
- `LangPicker` 的 DOM：`<details class="lang-picker"><summary data-testid="lang-switch">{nativeName} ▾</summary><ul><li><a href=… hreflang=… data-lang=… aria-current="true"?>…</a></li>…</ul></details>`。

- [ ] **Step 1: 寫失敗的測試**：
  - `detectLang`：Review Focus 4 的五個瀏覽器語言；`stored = "ja"` 時優先；`stored = "xx"` 時忽略；`browser = []` 時回傳 `zh`。
  - E2E `i18n.spec.ts`：
    1. 在 `/zh/melee/sword/` 展開選單、點「日本語」→ 網址變成 `/ja/melee/sword/`，`<h1>` 是日文。
    2. 在地圖頁 `/zh/map/?world=sift#3/3000/5000` 切到 Deutsch → 網址保留 `?world=sift#3/…`。
    3. 選過語言後打開 `/` → 導到上次選的語言。
    4. `test.use({ locale: "ja-JP" })` 的新 context 打開 `/` → 導到 `/ja/`。
    5. `<link rel="alternate" hreflang>` 共 17 條（16 種語言加 `x-default`）。
    6. 沒有 JavaScript 時，選單用 `<details>` 展開，連結可以點。
    7. 手機寬度 360px 時，選單展開後不超出畫面寬度。
  - 把 `wiki.spec.ts` 舊的「language switch keeps the same entry」改成用選單操作。
- [ ] **Step 2: 實作**：
  - `LangPicker`：每個連結的 `href` 在 build 時由 `swapLangPath` 產生。`SiteHeader` 現有的 `withCurrentLocation` 同步邏輯改成套用到所有 `.lang-picker a`。點擊時寫入 `mcd2-lang`。Esc 收合並把 focus 還給 summary；點選單外收合。
  - `index.astro`：inline script 呼叫 `detectLang`（由 Astro 打包，或寫成 is:inline 版本並和純函式共用測試資料），再加上 `<noscript>` 與 meta refresh。
  - `404.astro`：script 判斷路徑第一段，改寫「回到首頁」與搜尋表單的 action。
  - `Base.astro`：加 hreflang 與 `og:locale:alternate`。
- [ ] **Step 3: 驗證並 Commit**：`feat: add a language menu, browser-language redirect and hreflang links`

---

### Task 8: 各語言字型與搜尋

**Files:**
- Modify: `package.json`（新增 4 個 `@fontsource` 套件）、`src/layouts/Base.astro`（匯入 700 字重的 CSS）、`src/styles/tokens.css`（依 `:lang()` 設定 `--font-display`、`--font-body`）、`src/styles/base.css`（`.lang-text .alt` 的大寫樣式只套在拉丁字母語言）、`src/lib/ui-strings.ts`／語言檔（`fontCredit`）
- Modify: `src/pages/[lang]/search.astro`（PagefindUI 依頁面語言使用內建翻譯）
- Test: `tests/e2e/i18n.spec.ts`

- [ ] **Step 1: 確認 Geist 的字元涵蓋**：檢查 `node_modules/@fontsource-variable/geist` 是否有 cyrillic 子集，結果寫進報告。沒有的話，西里爾字母語言的 `--font-body` 改用 `system-ui`。
- [ ] **Step 2: 寫 E2E**：在 `/ko/`、`/ja/`、`/zh-hans/`、`/ru/` 取 `h1` 的 computed `font-family`，第一個字型分別是 Noto Serif KR、JP、SC、Noto Serif；並用 `document.fonts.check("700 32px 'Noto Serif KR'", "한국어")` 確認字型已載入。
- [ ] **Step 3: 實作字型**：用 `:lang(ko) { --font-display: "Noto Serif KR", …fallback }` 的寫法依語言設定。
- [ ] **Step 4: 搜尋**：`npm run build` 後，看 Pagefind 的輸出列出幾種語言的索引，寫進報告。E2E：`/ja/search/?q=Sword` 有結果（英文對照文字在頁面內）。
- [ ] **Step 5: 驗證並 Commit**：`feat: load display fonts per script and index search per language`

---

### Task 9: 全站驗證、規模量測、截圖

**Files:**
- Modify: `tests/e2e/wiki.spec.ts`（全站連結爬梳的起點加上 `/ja/`、`/ru/`、`/zh-hans/`）

- [ ] **Step 1**：`npx tsc --noEmit -p .`、`npm run test:coverage`（四項 ≥ 80%）、`npm run test:e2e`（chromium 與 mobile 全過）。
- [ ] **Step 2: 量測**：
  - 乾淨建置時間：`Measure-Command { npm run build }`。
  - 大小：`du -sh dist dist/pagefind`；HTML 頁數：`find dist -name "*.html" | wc -l`。
  - 超過 500MB 時停下來回報。
  - 確認 CI（`.github/workflows/deploy.yml`）沒有設定會被超過的逾時。
- [ ] **Step 3: 子路徑建置**：在 Git Bash 執行 `MSYS_NO_PATHCONV=1 BASE_PATH=/mcd2-wiki/ npx astro build`，確認 `dist/ja/index.html` 的 hreflang 連結和語言選單連結都帶 `/mcd2-wiki/`；之後跑 `npm run build` 恢復。
- [ ] **Step 4: 截圖**：用 Playwright 拍 `/ja/`、`/de/melee/sword/`、`/ko/map/`、`/ru/enchantment/` 的桌機截圖，以及 `/ar` 不存在時的 404 頁，加上語言選單展開時的手機截圖。存到 job tmp 或 `%TEMP%`，用 Read 工具逐張檢查並寫進報告。
- [ ] **Step 5: 推送並開 PR**（等最終審查完成後才做）：PR 說明附上語言清單、機器翻譯的範圍（`_machine` 統計）、套裝名稱表、`untranslated` 統計、建置時間與大小、截圖觀察。

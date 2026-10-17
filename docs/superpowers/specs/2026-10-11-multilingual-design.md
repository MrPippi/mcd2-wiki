# Minecraft Dungeons II Wiki — 多語言網站設計規格

- 日期：2026-10-11
- 狀態：已核准（使用者選擇「依照建議」，各段採推薦方案）
- 基準：`master`（`1e9a5e0`）；分支 `feat/multilingual`（worktree `.claude/worktrees/multilingual`）。PR #12（`fix/map-zoom`）合併後先 rebase。
- 使用者選擇：完整多語網站；16 種語言（合併地區變體）；每種語言對照英文（英文頁對照繁中）；標題列改下拉選單；介面字串先用遊戲字串、缺的機器翻譯並標註；`/` 依瀏覽器語言導向並記住選擇；資料方案 A（文字擴成 16 語、單一資料檔）

## 1. 目標

網站從「繁中＋英文」擴成 16 種語言的完整網站：每種語言一套頁面、介面與遊戲內容都以該語言顯示，並保留「對照」功能。

### 1.1 語言

| 網址代碼 | 遊戲語系檔資料夾 | `<html lang>` | OG locale | 自稱 |
|---|---|---|---|---|
| `zh` | zh-Hant | zh-TW | zh_TW | 繁體中文 |
| `zh-hans` | zh-Hans | zh-CN | zh_CN | 简体中文 |
| `en` | en | en | en_US | English |
| `ja` | ja-JP | ja | ja_JP | 日本語 |
| `ko` | ko-KR | ko | ko_KR | 한국어 |
| `de` | de-DE | de | de_DE | Deutsch |
| `fr` | fr-FR | fr | fr_FR | Français |
| `es` | es-ES | es | es_ES | Español |
| `it` | it-IT | it | it_IT | Italiano |
| `pt` | pt-BR | pt-BR | pt_BR | Português (Brasil) |
| `ru` | ru-RU | ru | ru_RU | Русский |
| `pl` | pl-PL | pl | pl_PL | Polski |
| `nl` | nl-NL | nl | nl_NL | Nederlands |
| `sv` | sv-SE | sv | sv_SE | Svenska |
| `tr` | tr-TR | tr | tr_TR | Türkçe |
| `uk` | uk-UA | uk | uk_UA | Українська |

不採用 en-GB、es-MX、fr-CA。選單順序即上表順序。

### 1.2 成功標準

1. 16 種語言的每個頁面（首頁、分類、條目、護甲套裝與部位、搜尋、地圖）都能建置，網址為 `/<代碼>/…`，slug 不變。
2. 遊戲內容（名稱、說明、解鎖說明、套裝名稱、地圖標記與世界名）以該語言顯示；該語言缺字時以英文顯示並加「未翻譯」標記。
3. 對照：非英文頁的對照語言是英文，英文頁的對照語言是繁中；「對照」開關沿用現有的 `data-compare` 與 `mcd2-compare` 儲存鍵。
4. 標題列的語言切換是下拉選單，列出 16 種語言的自稱，目前語言有勾選標記。選擇後停留在同一頁（保留 query 與 hash），並把選擇存進 `localStorage`（`mcd2-lang`）。沒有 JavaScript 時，選單是一般連結清單（`<details>` 展開）。
5. `/` 依序看 `mcd2-lang`、`navigator.languages`，導到對應語言；都對不上就去 `/zh/`。沒有 JavaScript 時用 meta refresh 導到 `/zh/`。
6. 每頁 `<head>` 有 16 種語言的 `hreflang` alternate，外加 `x-default` 指向 `/`。
7. 介面字串每種語言齊全（單元測試檢查鍵集合一致）。能從遊戲語系檔取得的字串用遊戲官方翻譯；其餘繁中、英文沿用現有人工字串，另 14 種為機器翻譯，並在語言檔內標註哪些鍵是機器翻譯。
8. 數值說明填入正確位置：佔位符依編號（`{0}`、`{1}`）填，不依出現順序填；俄文的複數語法依數值選對的詞形。
9. 每種語言的標題字型能顯示該語言的文字：簡中、日文、韓文有對應的 Noto Serif；拉丁與西里爾字母有適當字型。不出現豆腐方塊。
10. 搜尋：每種語言一份 Pagefind 索引；在任何語言頁用英文名稱也搜得到（英文對照文字在頁面內）。
11. 地圖頁內嵌的資料只含當前語言與對照語言的文字。
12. `npx tsc --noEmit` 0 錯誤；單元、整合、E2E 全過；`BASE_PATH=/mcd2-wiki/` 建置的網址正確；記錄建置時間與 `dist` 大小。

### 1.3 非目標

- 數字格式在地化（小數點、百分比空格）：沿用遊戲風格的 `20%`、`1.5`。
- 從右到左的語言（這版遊戲沒有）。
- 機器翻譯的人工校對（之後依標註修正）。
- 任務、對話等網站目前沒有發布的遊戲文字命名空間。
- 卡片的英文 kicker（`MELEE WEAPON` 等）：這是設計上的英文樣式，維持英文。

## 2. 資料與抽取

### 2.1 語言清單（單一來源）

`scripts/extract/config.ts` 的 `LANGS` 改為 16 個代碼，另有 `LANG_META`：`Record<Lang, { culture; htmlLang; ogLocale; nativeName; fontScript }>`。`fontScript` 為 `"tc" | "sc" | "jp" | "kr" | "latin" | "cyrillic"`，供字型使用（§3.6）。`CULTURE` 改由 `LANG_META` 衍生。

### 2.2 `Localized`

- `LocalizedSchema` 改為 16 個必填鍵的物件（由 `LANGS` 產生），型別 `Localized = Record<Lang, string>`。這樣漏改的地方 TypeScript 會在編譯時抓出來。
- 新增 `src/lib/lang.ts`（或在 `i18n.ts`）：`compareLang(lang)` 取代 `otherLang`（英文對照繁中，其他對照英文）；`pick(value, lang)` 取出單一語言文字。
- `entries.json`、`armor-sets.json`、`map.json` 的文字欄位全部變成 16 語。估計 `entries.json` 約 2.5MB，只在建置時讀取，不會送到瀏覽器。

### 2.3 讀取語系檔

- `loadLocales` 依 `LANGS` 讀 16 個 `All.json`，回傳 `Record<Lang, LocaleFile>`（不再用 `[zh, en]` 解構）。
- 主鍵集合仍以英文表為準（現行做法）。
- `resolveText(key, texts)`：
  - 英文缺字：整筆沒有文字（同現行）。
  - 其他語言缺字：用英文，該語言記進 `untranslated`。
- 「只有佔位符」與開發用暫留文字的判斷改為只看英文：英文只有佔位符就視為只有佔位符。
- `localize()`（地圖等用）同樣改為英文必填、其他語言缺字補英文。

### 2.4 Markup 與佔位符（修正既有錯誤）

- `renderMarkup` 輸出佔位符時保留編號：`<span class="placeholder" data-slot="1">{…}</span>`。每種語言有自己的佔位符標籤，都要包在 `{}` 裡，存在語言檔裡。
- 俄文複數語法 `{1}|plural(one=…,few=…,many=…,other=…)` 渲染成 `<span class="plural" data-slot="1" data-forms='{"one":"…",…}'></span>`，不再當成字面文字顯示。
- `fillPlaceholders(html, values, lang)`：
  - 依 `data-slot` 填入 `values[slot]`。
  - 複數用 `Intl.PluralRules(htmlLang)` 依數值選詞形；數值不是數字時用 `other`。
  - 這同時修正現在的錯誤：中、日文 `{1}` 在 `{0}` 前面時會填錯位置。

### 2.5 護甲套裝名稱

- 現行做法是取各部位名稱的共同前綴：英文切在字詞邊界，中文去掉結尾的「之」。這對德文複合字、日文「の」、俄文與土耳其文的詞形變化不一定成立。
- 實作第一步：先查遊戲語系檔有沒有套裝名稱的鍵。
  - 有：直接用。
  - 沒有：每種語言依書寫系統選規則。空格分詞的語言切在字詞邊界，CJK 去掉結尾的連接字（`之`、`の`、`의`）。前綴少於 2 個字元、或結果不是完整詞時，退回英文套裝名稱並記進 `untranslated`。
- 把各語言的結果列成表給使用者看，作為驗收依據。

### 2.6 地圖

- `map.json` 的世界名、標記名、區域名、說明都是 16 語。
- 地圖頁內嵌資料時，只保留 `[lang, compareLang(lang)]` 兩種語言（§1.2 第 11 條）。

## 3. 網站

### 3.1 介面字串

- `src/i18n/<代碼>.json`，每種語言一個檔，由 zod 驗證。
- `t(lang, key)` 的鍵集合以 `zh.json` 為準，型別仍由鍵推導。
- 檔內可以有 `"_machine": ["key", …]`，標示哪些鍵是機器翻譯。
- 會跟著搬進語言檔的：
  - `i18n.ts` 現有的 78 個鍵。
  - `gear-values.ts`、`weapon-stats.ts` 的標籤與單位：秒、格與英文複數、第 N 擊、跳躍攻擊、清單分隔符、連擊表欄名、職業、重量。
  - `render-markup.ts` 的佔位符標籤。
  - 頁面上寫死的「No.」、全形冒號「：」、根目錄與 404 的文字。
- 單位需要複數形的（格、秒）用 `Intl.PluralRules` 選詞形，語言檔存成 `{ one, few, many, other }`。
- **遊戲字串**：`npm run extract` 依 `scripts/extract/ui-game-keys.json`（網站鍵 → 遊戲 namespace 與 key）從 16 個語系檔取出，寫進 `src/data/ui-game-strings.json`。
  - 繁中、英文：網站的人工字串優先，遊戲字串只在網站沒寫時才用。
  - 其他 14 種語言：遊戲字串優先，沒有才用語言檔的機器翻譯。
  - 對應的鍵至少包含：分類名、護甲部位、稀有度、地圖世界名、礦車站、裂隙、地圖縮放（`InventoryLabels`、`WorldMapLabels`、`TabLabels`）。
- **措辭調整**：寫到「中英對照」的字串（tagline、source、compare）改成語言中立的說法，例如「遊戲內文字，可對照英文」。網站標題：
  - 繁中維持「Minecraft Dungeons II 中文 Wiki」。
  - 簡中為「Minecraft Dungeons II 中文 Wiki（简体）」。
  - 其他語言為「Minecraft Dungeons II Wiki」。
  - `HomeHero` 的標題拆解，要能處理沒有括號限定詞的標題。

### 3.2 對照

- `LangText`、`ItemCard`、`CatalogHead`、`HomeHero` 一律用 `compareLang(lang)`。
- 對照文字的 `lang` 屬性用 `LANG_META[alt].htmlLang`。
- `.lang-text .alt` 的大寫樣式只套在拉丁字母語言，避免影響其他文字。
- 列表篩選的 `data-names` 收當前語言與對照語言的名稱，比對時用 `toLocaleLowerCase(htmlLang)`（處理土耳其文的 İ/I）。
- 地圖標記搜尋同樣比對這兩種語言。

### 3.3 語言選單（`SiteHeader`）

- 新元件 `LangPicker.astro`：`<details class="lang-picker">`，`<summary>` 顯示目前語言自稱和 ▾。展開後是 16 個 `<a hreflang>` 連結，指向同一頁的對應語言網址。
- 已有的 `withCurrentLocation` 會在網址變動時同步改寫每個連結的 query 與 hash，涵蓋地圖頁的 `mcd2:locationchange` 事件。
- 點選語言時寫入 `localStorage.mcd2-lang`（包 try/catch）。
- 鍵盤操作：summary 可以 focus，Esc 收合，連結用 Tab 移動。手機上選單不能超出畫面寬度。
- `data-testid="lang-switch"` 留給 summary；每個連結加 `data-lang`。
- 404 頁傳入的 `langSwitchHref` 改成：每個語言連到該語言首頁。

### 3.4 根目錄與 404

- `src/pages/index.astro`：
  - 一段 inline script：先讀 `mcd2-lang`；沒有的話把 `navigator.languages` 逐一比對 `htmlLang` 與語言前綴（`zh-TW`、`zh-HK` → `zh`；`zh-CN`、`zh-SG`、`zh-Hans` → `zh-hans`；`pt-*` → `pt`；其餘取前兩個字母比對代碼）；最後 `location.replace` 到 `base + 代碼 + "/"`。
  - 另有 `<noscript>` 加 meta refresh 導到 `/zh/`，頁面上列出 16 種語言的連結。
- `404.astro`：維持靜態的繁中與英文內容，另外加一段 script，從路徑第一段判斷語言，把「回到首頁」連結改成該語言首頁。

### 3.5 `<head>`

`Base.astro` 加入 16 種語言的 `<link rel="alternate" hreflang>`，加上 `x-default` 指向 `/`；`og:locale` 用 `LANG_META`；`og:locale:alternate` 列出其他 15 種語言。

### 3.6 字型

- 標題字型 `--font-display` 依 `:lang()` 切換：
  - 繁中：Noto Serif TC（現有）。
  - 簡中：Noto Serif SC。
  - 日文：Noto Serif JP。
  - 韓文：Noto Serif KR。
  - 拉丁與西里爾字母：Noto Serif（`@fontsource/noto-serif`，內含 cyrillic 子集）。
- 字型都取 700 字重；fontsource 的 `unicode-range` 會讓瀏覽器只下載用得到的字型檔。
- 內文字型 Geist：先確認它有沒有 cyrillic 子集；沒有的話，在西里爾字母語言改用系統字型（`system-ui`）作為內文字型。
- 頁尾的字型致謝依實際使用的字型更新。

### 3.7 搜尋

- Pagefind 會依 `<html lang>` 自動分語言建索引。
- PagefindUI 介面文字用它內建的翻譯（依頁面語言），網站只覆寫 placeholder。
- 實作時要確認 16 種語言在 Pagefind CLI 輸出中都有索引；不支援斷詞的語言，記錄它的搜尋行為。

## 4. 錯誤處理與邊界

- 語系檔不存在：抽取失敗，並指出是哪一個語言（同現行對單一語系檔的處理）。
- 某語言整個 namespace 缺失：該語言的文字全部補英文，並在報告中列出。
- 語言檔缺鍵：單元測試失敗；執行時 `t()` 退回英文，不丟例外。
- `localStorage` 或 `navigator.languages` 不可用：直接導到 `/zh/`。
- 未知的複數類別：用 `other`。

## 5. 規模與效能

- 頁數約從 748 變成約 6,000；`dist` 預估 150–250MB，在 GitHub Pages 1GB 上限內。
- 建置時間預估是現在的 6–8 倍，CI 的逾時要確認。
- 實作的最後一個任務要量實際的建置時間、`dist` 大小與 Pagefind 索引大小，寫進 PR 說明。超過 500MB 時停下來回報。

## 6. 測試

- **單元測試**：
  - `LANG_META` 完整。
  - `compareLang`。
  - 語言檔鍵集合一致，`_machine` 列出的鍵確實存在。
  - `resolveText` 的英文補位與 `untranslated`。
  - 佔位符依編號填入（中文 `{1}` 在前的句子）。
  - 俄文複數。
  - 套裝名稱規則（每種書寫系統一例）。
  - 遊戲字串對應：沒有對應的鍵時退回語言檔。
  - 根目錄的語言對應函式（抽成純函式）。
  - 地圖內嵌資料只含兩種語言。
- **整合測試**：假資料語系檔放 16 種（可以只有少數鍵），驗證抽取輸出的 16 語與 `untranslated`。
- **E2E**：
  - 現有測試大多用 `/zh/`，維持。
  - 新增：日文首頁和條目頁以日文顯示並對照英文。
  - 新增：英文頁對照繁中。
  - 新增：語言選單切換後停在同一頁並保留 hash。
  - 新增：選擇被記住，`/` 會導到上次選的語言。
  - 新增：`navigator.languages = ["ja-JP"]` 時 `/` 導到 `/ja/`（Playwright 的 `locale` 設定）。
  - 新增：hreflang 有 16 條加 1 條 `x-default`。
  - 新增：韓文頁標題不出現豆腐方塊（檢查 computed font-family 落在 Noto Serif KR）。
  - 新增：地圖頁在俄文下運作。
  - 全站連結爬梳的起點加上幾個新語言。

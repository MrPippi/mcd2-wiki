# 配裝頁（Build Planner）設計

日期：2026-10-12　分支：`feat/build-planner`

## 1. 目的與範圍

讓玩家組一套配裝、用連結分享、或存成 PNG 圖片貼到社群。**只展示，不計算數值**（使用者 2026-10-12 決定；資料沒有護甲值與裝備強度公式，見 brainstorming findings）。

做：
- 頁面 `/<lang>/build/`，16 種語言。選單在「靈魂風暴」之後。
- 欄位：近戰 1、遠程 1、頭盔、胸甲、護腿、靴子、神器 ×4、護符 ×3，共 13 格（使用者 2026-10-12 決定不要外觀：披風、寵物）。
- 護甲區「選整套」：選一個套裝，填入它的 4 件。
- 點欄位 → 選擇面板（搜尋框＋該類別圖示格）；欄位可清除。
- 複製連結；下載 PNG 配置卡。
- 網址還原配置；語言切換保留配置（`lang-switch.ts` 已帶 query）。

不做：效果、附魔、數值、外觀（披風、寵物）、標題／說明文字、伺服器儲存、帳號。

## 2. 資料

- 來源：`publishedEntries`（已排除 upcoming、缺圖示、未確認數值的條目）。
- 類別對應：melee→近戰、ranged→遠程、armor（依 `armorPiece`）→四個護甲欄、artifact→神器、talisman→護符。
- 選項只帶當前語言：`{ slug, name, search, icon?(已加 base 的 URL), href, unique? }`。
- 套裝：`allArmorSets` 中 4 件都在已發布護甲裡的才列出；`{ slug, name, pieces: {helmet,chest,leggings,boots} }`。
- 以 `<script type="application/json">` 放進頁面（`<` 轉成 `<`），預估 < 60 KB／頁。

## 3. 網址格式

`?v=1&m=<slug>&r=<slug>&h=<slug>&c=<slug>&l=<slug>&b=<slug>&a=<s1>,<s2>,<s3>,<s4>&t=<s1>,<s2>,<s3>`

- 只寫有值的欄位；神器／護符空格以空字串保位（`a=x,,y`），尾端空格省略。
- `v` 不是 1 時：忽略整個配置，提示「連結版本不支援」。
- slug 不在該欄位的選項裡（遊戲更新改名、類別錯）：那格留空，提示「有 N 件物品已不存在」。
- 同一件神器／護符重複：保留第一個，其餘留空並計入「已不存在」的數量（遊戲不允許重複裝備）。
- 每次修改用 `history.replaceState` 更新網址，不新增歷史紀錄；網址中其他參數（例如 `ref`）保留。逗號不轉義，slug 以 `encodeURIComponent` 轉義。
- 開啟時有略過的項目或版本不符：立刻把網址改成讀得懂的部分，提示在下一次修改時消失。
- 純函式模組 `src/lib/build/code.ts`：`encodeBuild(build) → string`、`decodeBuild(search, options) → { build, dropped, unsupported }`。不 import 任何東西（型別除外），瀏覽器與測試共用。

## 4. 元件與檔案

| 檔案 | 職責 |
|---|---|
| `src/lib/build/slots.ts` | 13 個欄位定義（key、類別、護甲部位、URL 參數名、群組），純資料 |
| `src/lib/build/code.ts` | 網址編碼／解碼（純函式） |
| `src/lib/build/payload.ts` | 伺服器端：由 entries 與套裝產生當前語言的 payload |
| `src/lib/build/parse.ts` | payload 型別與瀏覽器端驗證 `parseBuildPayload`（不用 zod） |
| `src/lib/build/planner.ts`、`draw.ts` | 瀏覽器端互動與 canvas 繪圖 |
| `src/lib/build/card.ts` | 配置卡版面計算（純函式：各格位置、文字截斷），canvas 繪製只在元件 script |
| `src/components/BuildPlanner.astro` | 欄位格、選擇面板（`<dialog>`）、分享列、payload、client script |
| `src/pages/[lang]/build.astro` | 頁面殼、標題、說明、`<noscript>` |
| `src/styles/build.css` | 版面 |
| `src/lib/site-menu.ts` | 加 `{ key: "build", segment: "build" }` |
| `src/i18n/*.json` | 新 UI 鍵（16 種語言；zh、en 手寫，其他機器翻譯列入 `_machine`） |

元件一開始 `hidden`；script 讀 payload 成功才顯示。沒有 JS 時只看到 `<noscript>` 說明。

## 5. 互動細節

- 欄位按鈕：有值顯示圖示＋名稱，旁邊 ↗ 連到物品頁；空值顯示「選擇…」。旁邊「清除」按鈕（`aria-label` 含欄位名），清除後焦點回到該欄位。
- 群組標題用遊戲官方分類名稱（護甲、神器、護符），武器另用一個鍵。
- 選擇面板用 `<dialog>`（原生焦點管理、Esc 關閉）；搜尋框即時篩選（用 `searchFold` 同樣的折疊規則：小寫＋去重音，在 client 重做一份不 import 的版本）。手機寬度全螢幕。
- 神器／護符面板中，已裝在其他格的選項標為停用。
- 「選整套」：面板列出套裝，選了就填 4 件護甲。
- 分享列：「複製連結」→ `navigator.clipboard.writeText`，成功顯示「已複製」（`aria-live`）；失敗則顯示可選取的網址輸入框。「下載圖片」→ canvas 畫卡片，`toBlob` → 下載 `mcd2-build.png`。
- 「清空配置」按鈕。

## 6. PNG 配置卡

- 1200×630（社群預覽比例），背景用網站紙色，左上網站名稱，右下網址（不含 query 的頁面網址）。
- 13 格分四列（武器、護甲、神器、護符），每格 72px 圖示＋欄位名＋物品名（過長以 … 截斷，`card.ts` 用 `measureText` 回呼計算）。網址印在左下。
- 圖示是同源圖片，canvas 不會被污染；圖片載入失敗時該格只畫名稱。
- 字型用頁面已載入的字型（`document.fonts.ready` 後繪製）。

## 7. 錯誤處理

- payload 無法解析：`console.error`，元件保持隱藏，顯示 noscript 同款的錯誤說明。
- 網址無效：見 §3，總是能顯示剩下的部分。
- 剪貼簿／canvas 失敗：顯示錯誤訊息，不吞掉。

## 8. 測試

- 單元：`code.ts`（往返、空格保位、未知 slug、重複、版本、壞輸入）、`slots.ts`、`payload.ts`（類別對應、套裝完整性、無 upcoming、href 規則）、`card.ts`（版面與截斷）。
- 元件：Astro container 渲染頁面，檢查 13 格、payload 存在、noscript、選單項。
- i18n：新鍵在 16 個檔案、`_machine` 正確（既有測試會檢查）。
- E2E（Playwright，port 4329）：選近戰 → 網址更新；開啟帶 query 的網址 → 還原；未知 slug 提示；選整套填 4 格；複製連結（授權剪貼簿）；下載圖片產生 PNG；語言切換保留配置；412px 無橫向溢出；選單連結。
- 覆蓋率 ≥ 80%。

## 9. 驗收

tsc 0 錯誤、vitest 全過、覆蓋率 ≥ 80%、Playwright chromium + mobile 全過、子路徑建置（`BASE_PATH=/mcd2-wiki/`）圖示與連結正確、截圖檢查、開 PR 不合併。

## 10. 遊戲版本（2026-10-12 追加）

- 版本號手動維護於 `scripts/extract/game-version.json`（解包檔沒有版本；目前 1.1.2.0，取自安裝目錄 `MicrosoftGame.config`）。
- 分享連結多一個 `gv=<版本>`；打開版本不同的連結時提示「這套配裝建立於遊戲版本 X，目前資料為 Y」，下一次修改後改寫成目前版本。
- 配裝頁標出目前版本；PNG 右下角印出版本；兩份 README 開頭註明版本。

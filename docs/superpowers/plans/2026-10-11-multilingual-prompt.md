請實作 Minecraft Dungeons II Wiki 的「多語言網站」：從繁中＋英文擴成 16 種語言。

## 工作位置
- 專案：`D:\Project\mcd2-wiki`；在 worktree `D:\Project\mcd2-wiki\.claude\worktrees\multilingual` 裡工作。分支 `feat/multilingual` 已建立，含 spec 與 plan 的 commit。不要在 `master` 上工作。
- 規格（最高依據）：`docs/superpowers/specs/2026-10-11-multilingual-design.md`
- 實作計畫：`docs/superpowers/plans/2026-10-11-multilingual.md`（Task 1–9）
- 開始前：
  1. `git fetch origin`。如果 PR #12（`fix/map-zoom`）已合併，先 `git rebase origin/master`。
  2. 在 worktree 跑 `npm ci` 與 `npx astro sync`。這個 worktree 的 `node_modules` 要自己裝，不要接到主 checkout。
  3. `source-data` 是指向主 checkout 的 junction，只能讀，不能刪也不能改。

## 執行方式
- 使用 superpowers:subagent-driven-development：每個 Task 交給一個新的 implementer subagent，接著由 reviewer 檢查 spec 是否符合、程式碼品質如何，全部完成後做一次整個分支的最終審查（用最強的模型）。
- 全程遵守 TDD：先寫測試、親眼看它失敗，再實作、看它通過。
- 中途不要停下來問我。計畫和規格衝突、或計畫有錯時，以規格為準自行裁決，並寫進 ledger（`Ruling: … — 原因 — 若錯的代價`）。
- 只有這三種情況要停下來問我：
  - 建置後的 `dist` 超過 500MB。
  - 要做無法復原的操作。
  - 每條路都只能用猜的。
- 已知的風險與決定點，計畫裡都寫了：
  - Task 4 會讓 TypeScript 一次標出所有剩下的兩語寫法，要逐一修正，不能用 `as` 或 `@ts-ignore` 跳過。
  - Task 5 的套裝名稱要先查遊戲有沒有現成的鍵。
  - Task 6 是 14 種語言的介面翻譯，由你翻譯，並在語言檔的 `_machine` 標註哪些是機器翻譯。
  - Task 8 要確認 Geist 字型有沒有西里爾字母，以及 Pagefind 的語言索引。

## 環境注意事項
- 預覽與 E2E 用 port **4329**。開始前用 PowerShell `Get-NetTCPConnection -LocalPort 4329 -State Listen` 確認沒被佔用。如果被主 checkout 的舊 preview 佔著，確認是本專案的 `astro preview` 再關掉。**port 4321 是我另一個專案，不要碰。**
- 會用到 `npm run extract`（讀 `source-data`）；不需要 `npm run tiles`。
- 在 Git Bash 設 `BASE_PATH=/mcd2-wiki/` 時，要加 `MSYS_NO_PATHCONV=1`。
- 換行符號：repo 多數檔案是 CRLF，改檔前先確認該檔現況並保持一致。
- Commit 用 conventional commits，**不要加任何 attribution 行**。

## 完成條件
1. `npx tsc --noEmit -p .` 0 錯誤；`npm run test:coverage` 全過且四項覆蓋率 ≥ 80%；`npm run test:e2e`（chromium + mobile）全過。
2. 16 種語言都建置成功，抽樣頁面（ja、de、ko、ru、zh-hans）的介面與內容都是該語言，對照語言正確（英文頁對照繁中，其他頁對照英文）。
3. 語言選單、根目錄依瀏覽器語言導向、記住選擇、hreflang 都有 E2E 涵蓋。
4. 量好建置時間、`dist` 與 Pagefind 的大小、HTML 頁數；子路徑建置檢查和截圖目視檢查都完成。
5. 最終審查的 Critical／Important 已修正並有測試。
6. 推送 `feat/multilingual` 並建立 PR 到 `master`（**不要合併**）。PR 說明要包含：
   - 語言清單。
   - 機器翻譯的範圍（每種語言 `_machine` 的鍵數）。
   - 套裝名稱的結果表（列出退回英文的組合）。
   - 每種語言 `untranslated` 的條目數。
   - 建置時間與大小。
   - 截圖觀察、所有 Ruling，以及延後處理的 Minor 清單。

## 回報
用繁體中文回報：
- PR 連結和測試結果。
- 你做的所有裁決（附代價）。
- 需要我人工校對的機器翻譯：列出語言和鍵數。
- 需要我目視確認的頁面。
- 延後處理的項目。

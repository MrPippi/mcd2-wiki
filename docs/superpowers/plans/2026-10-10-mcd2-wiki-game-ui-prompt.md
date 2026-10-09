請實作 Minecraft Dungeons II 繁中 Wiki 的「遊戲風格改版」。

## 工作位置
- 專案：`D:\Project\mcd2-wiki`
- 分支：`feat/game-ui`（已建立，含 spec 與 plan 的 commit）。不要在 `master` 上工作。
- 規格（最高依據）：`docs/superpowers/specs/2026-10-10-mcd2-wiki-game-ui-design.md`
- 實作計畫：`docs/superpowers/plans/2026-10-10-mcd2-wiki-game-ui.md`（Task 1–7，每步都有完整程式碼與預期輸出）

## 執行方式
- 使用 superpowers:executing-plans 在本 session 依序執行 Task 1→7，全程遵守 superpowers:test-driven-development：先寫測試、親眼看它失敗，再實作、看它通過。
- 中途不要停下來問我；計畫與規格衝突或計畫有錯時，以規格為準自行裁決，並把裁決寫進 ledger（`Ruling: … — 原因 — 若錯的代價`）。
- 全部任務完成後，依 skill 指示派一個最強模型的 reviewer 做整個分支的最終審查；Critical／Important 問題修一輪（每項先寫會失敗的測試），Minor 只記錄。

## 環境注意事項
- 預覽與 E2E 用埠號 **4329**（`npm run preview`、`playwright.config.ts` 已設定）。**埠號 4321 是我另一個專案的預覽伺服器，不要關掉或佔用它。** 若 4329 已有舊的預覽在跑，先確認是本專案的再關掉，避免 E2E 打到舊建置。
- `source-data/` 是遊戲解包檔，不進 git，本次改版也不需要動它；不要執行 `npm run extract`。
- 在 Git Bash 設 `BASE_PATH=/mcd2-wiki/` 時要加 `MSYS_NO_PATHCONV=1`。
- 字型從 jsDelivr 下載（`raw.githubusercontent.com` 在這台機器連不到）。
- Commit 用 conventional commits，**不要加任何 attribution 行**。

## 完成條件
1. `npx vitest run` 與 `npx playwright test`（chromium + mobile）全部通過。
2. 子路徑建置檢查（Task 7 Step 7）與截圖目視檢查（Task 7 Step 8）完成。
3. 最終審查的 Critical／Important 已修正並有測試。
4. 推送 `feat/game-ui` 並建立 PR 到 `master`（**不要合併**）。PR 描述包含：改版摘要、測試計畫、所有 Ruling、延後處理的 Minor 清單。

## 回報
用繁體中文回報：PR 連結、測試結果、你做的裁決（含代價）、延後處理的項目，以及需要我目視確認的頁面。

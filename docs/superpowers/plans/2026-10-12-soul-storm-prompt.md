請實作 Minecraft Dungeons II Wiki 的「靈魂風暴」頁：16 種語言的 `/<lang>/soul-storm/`，含瀏覽器端的即時時程。

## 工作位置
- 專案：`D:\Project\mcd2-wiki`。**選定做法：新建 worktree**，不重用 `.claude/worktrees/soul-storm`（那個只放文件）。不要在 `master` 上工作。
- 規格（最高依據）：`docs/superpowers/specs/2026-10-12-soul-storm-design.md`
- 實作計畫：`docs/superpowers/plans/2026-10-12-soul-storm.md`（Task 1–7）
- 開始前（PowerShell，在 `D:\Project\mcd2-wiki`）：
  1. `git fetch origin`
  2. 建 worktree：`git worktree add .claude/worktrees/soul-storm-impl -b feat/soul-storm origin/master`
  3. 進入 worktree，把文件帶進來：
     - 先檢查：`git log origin/master --oneline -- docs/superpowers/specs/2026-10-12-soul-storm-design.md`；
     - 有結果，代表文件 commit 已經合併到 master，跳過這一步；
     - 沒有結果，就 `git cherry-pick origin/master..docs/soul-storm-plan`。`docs/soul-storm-plan` 是本機分支，只有一個 `docs:` commit。
  4. 建 `source-data` junction（只能讀，和 `D:\Project\mcd2-wiki\.claude\worktrees\multilingual\source-data` 一樣，指向主 checkout）：
     `cmd /c mklink /J source-data D:\Project\mcd2-wiki\source-data`，再用 `(Get-Item source-data).LinkType` 確認是 `Junction`。
  5. 在 worktree 跑 `npm ci` 與 `npx astro sync`。`node_modules` 要自己裝，不要接到主 checkout。
- `source-data` 永遠只能讀，不能刪、改、移動。`DataTables/UFS/OnlineConstants.json` 含遙測 API 金鑰，**絕不讀取、絕不發布**。

## 執行方式
- 使用 superpowers:subagent-driven-development：
  - 每個 Task 交給一個新的 implementer subagent；
  - 接著由 reviewer 檢查是否符合 spec，以及程式碼品質；
  - 全部完成後，用**最強的模型**對整個分支做一次最終審查。
- 全程遵守 TDD：先寫測試、親眼看它失敗，再實作、看它通過。
- 維護一份 ledger。每個裁決寫成 `Ruling: … — 原因 — 若錯的代價`。
- 中途不要停下來問我。計畫和規格衝突、或計畫有錯時，以規格為準自行裁決，並寫進 ledger。
- 計畫裡的數值都來自 `source-data`（spec §2 已逐項核對）。煙霧測試的結果與計畫不同時：
  - 先查明原因；
  - 只是圖鑑 slug 或格式不同 → 以資料為準修測試，並記進 ledger；
  - 資料本身與 spec 不同 → 依下一節判斷要不要停。

## 只有這些情況要停下來問我
1. 要做無法復原的操作，例如刪除分支、強制 push、刪除 worktree 以外的檔案、動到 `source-data`。
2. 每條路都只能用猜的：資料、spec、計畫都無法支持任何一個選項。
3. 三個未驗證的假設與資料矛盾，而且無法裁決：
   - U1：錨點時區是 UTC；
   - U2：區域 = `(floor((now − anchor) / cadence) + rotationOffset) mod 7`；
   - U3：線上值與匯出檔相同。

   例如時程表的欄位或格式和 spec §2.1 不同，或輪替表不是 7 區。只是「沒辦法在遊戲內確認」**不算**矛盾；維持 `verified: false` 繼續做。

## 環境注意事項
- **Port**：
  - 預覽與 E2E 只用 **4329**。
  - 開始前用 PowerShell `Get-NetTCPConnection -LocalPort 4329 -State Listen -ErrorAction SilentlyContinue` 確認。
  - 若被佔用：確認是本專案的 `astro preview` 才能關。它若服務的是舊 build，會讓 E2E 測到舊頁面，要先處理。
  - **port 4321 是我另一個專案，絕對不要碰。**
- **換行符號**：
  - 改任何既有檔案前，先用 node 數 CR（計畫的 Global Constraints 有指令），並保持原樣。
  - 本計畫會動到的既有檔案大多是 LF；`src/lib/map/viewer.ts`、`src/lib/map/marker-dom.ts`、`tests/e2e/map.spec.ts` 是 CRLF。
  - 新檔一律用 LF。
- **子路徑建置**：在 Git Bash 設 `BASE_PATH=/mcd2-wiki/` 時，要加 `MSYS_NO_PATHCONV=1`。驗證完用 `npm run build` 把 dist 還原。
- **抽取**：會用到 `npm run extract`（讀 `source-data`）；不需要 `npm run tiles`。重新抽取造成的無關 `src/data` 變動要還原（計畫 P16）。
- **Commit**：
  - conventional commits；
  - **不要加任何 attribution 行**（沒有 Co-Authored-By、沒有 session 連結）；
  - 每個 Task 至少一個 commit。
- **Push**：在最終審查通過之前不要 push。

## 完成條件
1. `npx tsc --noEmit -p .` 0 錯誤。
2. `npm run test:coverage` 全過，lines、functions、branches、statements 四項都 ≥ 80%。不足時補測試，不可降低門檻。
3. `npx playwright test` 的 chromium 與 mobile 兩個 project 全過，包含全站連結爬梳。
4. 子路徑建置檢查完成：連結、圖示、client payload 的 `href` 都帶 `/mcd2-wiki/`。
5. 截圖目視檢查完成：zh、en、ja、de、ru，桌面與 412px 手機；加上無 JS 版本、選單展開。截圖存 `.superpowers/screens/`，不提交。
6. 量好大小：
   - `src/data/soul-storm.json` < 50 KB；
   - `dist` 相對 `origin/master` 的 build 增加 < 2 MB；
   - 記下建置時間、HTML 頁數、Pagefind 大小。
7. 最終審查的 Critical 與 Important 都已修正並有測試。
8. 推送 `feat/soul-storm`，建立 PR 到 `master`，**不要合併**。PR 說明要包含：
   - 功能摘要與頁面清單；
   - 所有 Ruling（附代價）；
   - **未驗證事項**：U1–U3，以及資料缺口 U4–U6，各一句說明，並寫出確認後怎麼修（見下方「回報」第 6 點）；
   - 機器翻譯的範圍：每種語言 `_machine` 新增的鍵數，以及新增的 `_english` 鍵；
   - 測試與覆蓋率數字、建置時間與大小；
   - 截圖觀察；
   - 延後處理的 Minor 清單；
   - **不加 attribution 行**。

## 回報
用繁體中文回報：
1. PR 連結。
2. 測試結果：tsc；單元、整合的數量與四項覆蓋率；E2E 兩個 project 的數量；子路徑建置；`dist` 與資料檔大小。
3. 所有裁決，每一條附「若錯的代價」。
4. 需要我人工校對的機器翻譯：列出每種語言新增的 `_machine` 鍵數，以及改用英文的 `_english` 鍵。
5. 需要我目視確認的頁面：至少 `/zh/soul-storm/`、`/en/soul-storm/`、`/de/soul-storm/`（手機）、`/ru/soul-storm/`，以及選單。
6. 需要我在遊戲內確認的三件事，以及確認後的做法：
   - **U1 錨點時區**：在遊戲裡記下某一場風暴實際開始的時刻（含日期），和頁面「接下來的時段」對照。
     - 遊戲的風暴比頁面**早** N 小時開始 → 把 `scripts/extract/soul-storm-status.json` 的 `anchorOffsetMinutes` 改成 `N×60`。例如錨點其實是 UTC+8 的當地時間，就填 `480`。
     - 遊戲比頁面**晚** → 填負數。
     - 改完跑 `npm run extract`。
   - **U2 區域輪替**：同一時刻，遊戲地圖上的風暴區域和頁面寫的區域是否相同。
     - 時刻對、區域錯 → 改 `rotationOffset`（0–6），讓頁面往後挪到正確的區域。
   - **U3 線上覆寫**：連續觀察兩三場，確認長度是 20 分鐘、間隔是 40 分鐘、區域依頁面的順序出現。
     - 不符 → 代表伺服器覆寫了資料表。需要新的資料匯出，或另開工作處理。
   - **三點都確認後**：
     1. 把 `scripts/extract/soul-storm-status.json` 的 `"verified": false` 改成 `"verified": true`（就這一行）；
     2. 跑 `npm run extract`，讓 `src/data/soul-storm.json` 跟著更新；
     3. 跑 `npx vitest run tests/unit/extract/soul-storm-schema.test.ts`，確認兩個檔案一致；
     4. 兩個檔案一起 commit，例如 `chore: mark the Soul Storm schedule as confirmed in game`。

     之後頁面上的「推算時刻，尚未經遊戲內確認」會消失。
7. 延後處理的項目：
   - 地圖上標出目前的風暴區域；
   - 需要 FModel 匯出的圖示；
   - 資料缺口 U4–U6；
   - 最終審查的 Minor。

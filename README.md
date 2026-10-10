# Minecraft Dungeons II 繁體中文 Wiki（原型）

非官方粉絲網站，與 Mojang Studios／Microsoft 無關。遊戲文字與圖像版權歸原權利人所有。

## 更新資料（遊戲改版時）

1. 將遊戲解包檔放在 `source-data/`（不進 git）。
2. `npm run extract` → 更新 `src/data/*.json`、`public/icons/`，並產生 `extract-report.md`。
3. 檢查報告；缺圖示時編輯 `scripts/extract/icon-overrides.json` 後重跑。
4. Commit `src/data`、`public/icons`、`scripts/extract/icon-overrides.json`。

## 原始素材索引

`npm run assets` 掃描 `source-data/Assets/`，依分類／分項／細項整理所有素材，並以檔案內容比對 `public/icons/` 標出用途（網站已發布、網站介面、已抽取未發布、未使用）。

- 報告：`asset-index.md`（不進 git）——各分類統計、與上次比較、未分類資料夾、未使用的圖示、原始檔 → 網站路徑。
- 瀏覽頁：`source-data/asset-gallery.html`——用瀏覽器直接開，可依分類、用途、類型、變動篩選與搜尋。

遊戲改版加入新素材時：

1. 更新 `source-data/` 後先跑 `npm run extract`，再跑 `npm run assets`。
2. 報告「與上次比較」列出新增、變更、移除的檔案；瀏覽頁可用「變動 → 新增」只看新素材。
3. 報告「未分類資料夾」列出沒有規則的新資料夾：在 `scripts/assets/rules.json` 加一條規則（`prefix` → `group`，`sub` 固定分項或用下一層資料夾名當分項，`names` 可替資料夾取中文名），重跑即可。既有前綴下的新資料夾（例如新的場景）會自動成為分項，不必改規則。
4. 確認後 commit `scripts/assets/snapshot.json`（素材雜湊快照，作為下次比較的基準）。只想重看差異而不更新快照時用 `npm run assets -- --keep-snapshot`。

網站新增公開分類時（`src/lib/tabs.ts`），對應圖示會自動改判為「網站已發布」。

## 開發

```bash
npm install
npm run dev          # 開發伺服器（搜尋需 build 後才可用）
npm test             # 單元＋整合測試
npm run test:e2e     # build 後執行 Playwright（預覽伺服器使用 port 4329）
npm run build        # 產生 dist/ 與 Pagefind 索引
```

## 字型

- 俐方體 11 號（Cubic 11，`src/assets/fonts/cubic-11/`）與 Silkscreen（`@fontsource/silkscreen`）皆為 SIL Open Font License 1.1。
- 授權全文：`public/licenses/Cubic-11-OFL.txt`（網站頁尾有連結）；Silkscreen 授權隨 npm 套件提供。

## 部署

`.github/workflows/deploy.yml` 在推送到 `master` 時建置並發布到 GitHub Pages，`BASE_PATH` 自動設為 `/<repo>/`。
若 repo 是 `<user>.github.io`，請把 `BASE_PATH` 改成 `/`。

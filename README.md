# Minecraft Dungeons II 繁體中文 Wiki（原型）

非官方粉絲網站，與 Mojang Studios／Microsoft 無關。遊戲文字與圖像版權歸原權利人所有。

## 更新資料（遊戲改版時）

1. 將遊戲解包檔放在 `source-data/`（不進 git）。
2. `npm run extract` → 更新 `src/data/*.json`、`public/icons/`，並產生 `extract-report.md`。
3. 檢查報告；缺圖示時編輯 `scripts/extract/icon-overrides.json` 後重跑。
4. Commit `src/data`、`public/icons`、`scripts/extract/icon-overrides.json`。

## 開發

```bash
npm install
npm run dev          # 開發伺服器（搜尋需 build 後才可用）
npm test             # 單元＋整合測試
npm run test:e2e     # build 後執行 Playwright（預覽伺服器使用 port 4329）
npm run build        # 產生 dist/ 與 Pagefind 索引
```

## 部署

`.github/workflows/deploy.yml` 在推送到 `master` 時建置並發布到 GitHub Pages，`BASE_PATH` 自動設為 `/<repo>/`。
若 repo 是 `<user>.github.io`，請把 `BASE_PATH` 改成 `/`。

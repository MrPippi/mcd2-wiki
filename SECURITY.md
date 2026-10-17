# 安全性政策 / Security Policy

## 支援範圍

本專案是靜態網站（Astro 建置，部署在 GitHub Pages），沒有後端、資料庫或使用者帳號。只維護 `master` 分支與目前上線的網站，舊版不另行修補。

以下情況屬於安全性問題，請依下方方式私下回報：

- 網站頁面的 XSS 或 HTML 注入，例如透過網址參數（配裝頁的 `?m=`、`?e=` 等）、搜尋或語言切換。
- 建置或部署流程（`.github/workflows/`）可被利用來竄改網站內容。
- 相依套件的已知漏洞，且確實影響建置結果或網站。
- repo 中意外提交的金鑰、token 或個人資料。

以下不屬於安全性問題，請直接開 [issue](https://github.com/MrPippi/mcd2-wiki/issues)：

- 遊戲資料錯誤、翻譯錯誤、版面問題。
- GitHub Pages 本身的設定（例如 HTTP 標頭），本專案無法控制。

## 回報方式

請**不要**在公開 issue 或 PR 中揭露漏洞細節。

使用 GitHub 的私下回報功能：到本 repo 的 **Security** 分頁，點 **Report a vulnerability**。請附上：

- 受影響的頁面網址或檔案路徑；
- 重現步驟；
- 可能的影響。

維護者會盡量在 7 天內回覆，確認問題後修正並在修正上線後公開說明。本專案為個人維護的非官方粉絲站，沒有漏洞賞金。

---

## English

This is a static site (built with Astro, hosted on GitHub Pages) with no backend, database or user accounts. Only `master` and the live site are maintained.

To report a vulnerability (for example XSS through URL parameters, a way to tamper with the deploy workflow, or a secret committed to the repo), use **Security → Report a vulnerability** on this repository. Please do not disclose details in public issues or pull requests. Include the affected URL or file, steps to reproduce and the impact. Expect a reply within 7 days. There is no bug bounty.

Game data errors, translation errors and layout bugs are not security issues; please open a regular [issue](https://github.com/MrPippi/mcd2-wiki/issues).

# Minecraft Dungeons II 繁中 Wiki — 游標說明框設計規格

- 日期：2026-10-10
- 狀態：已核准（使用者指示依建議執行）
- 基準：`feat/redesign-audit`（PR #4）；分支 `feat/cursor-tooltip`
- 使用者選擇：取代右側面板、只做列表頁、即時跟隨游標、共用浮動框＋pointermove

## 1. 目標

分類列表頁（近戰、遠程、護甲、神器、護符、附魔）的物品說明，從右側固定面板改為顯示在使用者滑鼠游標旁，跟隨游標移動，接近遊戲內物品欄的體驗。

### 1.1 成功標準

1. 滑鼠裝置上，游標進入物品格時，游標旁出現說明框；游標在格內移動時說明框跟著移動；離開物品格時說明框隱藏。
2. 說明框永遠完整落在視窗內（四邊至少 8px 邊距）；預設在游標右下，右側放不下時翻到游標左側，下方放不下時翻到上方。
3. 鍵盤 Tab 聚焦物品時，說明框貼在該物品格旁；失焦時隱藏；聚焦物品的連結以 `aria-describedby` 指向說明框。
4. 右側固定面板移除，物品格網格占滿內容寬度。
5. 觸控螢幕（`hover: none`）行為不變：點物品滑出底部面板，按「查看」進條目頁。
6. 無 JavaScript 時物品仍是一般連結，說明框不出現。
7. 說明框內容與原面板相同（kicker、名稱、英文對照、描述；護甲套裝另列部位），中英對照關閉時隱藏英文。
8. 單元測試與 E2E 全部通過。

### 1.2 非目標

- 條目頁「相關條目」、套裝頁部位列表、內文連結的游標說明框（之後再做）。
- 說明框內可點擊的連結（說明框不攔截滑鼠）。
- 新增前端框架或依賴。

## 2. 行為

### 2.1 滑鼠（`(hover: hover) and (pointer: fine)`）

| 事件 | 動作 |
|---|---|
| 游標進入物品格（`pointerover` 委派判斷） | 以該物品的 `<template class="item-tip">` 內容填入說明框，依游標位置定位後顯示 |
| `pointermove`（在物品格內） | 以 `requestAnimationFrame` 節流，每格畫面最多更新一次位置；只改 `transform` |
| 游標離開物品格（`pointerout`，`relatedTarget` 仍在同一格內時忽略） | 隱藏說明框 |
| `click` | 照常進入條目頁 |
| 捲動／視窗縮放 | 隱藏說明框（下次移動游標再出現），避免停在過期位置 |

- 位置：說明框左上角在游標右下方 16px（`OFFSET`）。右側放不下（`x + 16 + 寬 > 視窗寬 − 8`）時，說明框右緣改在游標左方 16px；下方放不下時，底緣改在游標上方 16px；最後兩軸都限制在 `[8, 視窗 − 尺寸 − 8]`。
- 顯示／隱藏以 opacity 淡入淡出約 120ms；`prefers-reduced-motion: reduce` 時直接切換。
- 說明框 `pointer-events: none`，不會擋住游標下方的物品格，也不會造成閃爍。

### 2.2 鍵盤

- `focusin` 物品連結且該連結符合 `:focus-visible`（滑鼠點擊造成的聚焦不算，避免點擊瞬間說明框跳到格旁）：填入內容，用 `besideElement` 定位在該物品格右側 12px（`GAP`）；右側放不下時放左側；垂直方向對齊物品格頂端，並限制在視窗內。
- `focusout`：隱藏。
- 滑鼠與鍵盤同時操作時，以最後一個事件為準。

### 2.3 觸控與無 JavaScript

- `hover: none` 或 `pointer: coarse` 時不綁定說明框事件，沿用現有底部面板邏輯（`openSheet`／`closeSheet`、Esc、外部點擊、篩選隱藏時關閉）。
- 說明框元素預設 `hidden`；無 JavaScript 時永不顯示。

### 2.4 無障礙

- 說明框 `role="tooltip"`、`id="item-tooltip"`；聚焦或滑過時，該物品連結設 `aria-describedby="item-tooltip"`，隱藏時移除。
- 說明框不可聚焦、不含互動元素。

## 3. 架構

### 3.1 `src/lib/tooltip-position.ts`（新檔，純函式）

```ts
interface Point { x: number; y: number }
interface Size { width: number; height: number }
interface Rect { left: number; top: number; right: number; bottom: number }
interface Placement { left: number; top: number }

export const OFFSET = 16; // 游標到說明框的距離
export const GAP = 12;    // 物品格到說明框的距離（鍵盤）
export const MARGIN = 8;  // 說明框到視窗邊緣的最小距離

export function followCursor(cursor: Point, size: Size, viewport: Size): Placement;
export function besideElement(rect: Rect, size: Size, viewport: Size): Placement;
```

- 不讀寫 DOM；說明框比視窗還大時，貼齊左上邊距（`MARGIN`）。

### 3.2 `src/components/ItemBrowser.astro`

- 移除 `<aside class="item-tooltip">` 與 `.item-browser` 兩欄版面；新增全頁共用的 `<div class="cursor-tooltip panel" id="item-tooltip" role="tooltip" data-testid="item-tooltip" hidden>`。
- 事件掛在 `.item-grid` 上統一處理（`pointerover`／`pointerout` 判斷 `relatedTarget` 取代每格的 enter／leave，`pointermove`、`focusin`、`focusout`），每格不各自綁事件。
- 量測說明框尺寸（`offsetWidth`／`offsetHeight`）只在填入內容時做一次；移動時沿用快取尺寸。
- 觸控分支（底部面板）程式碼保留不變。

### 3.3 `src/components/TooltipPanel.astro`

- 移除「查看完整條目 ›」連結與 `href` 屬性；呼叫端（`ItemCard`）一併移除傳入值。

### 3.4 樣式 `src/styles/items.css`

- 刪除 `.item-tooltip`、`.tooltip-empty`、`.empty-slot`、`.tooltip-hint`、`.tooltip-keys` 與兩欄網格規則。
- 新增 `.cursor-tooltip`：`position: fixed; left: 0; top: 0; z-index: var(--z-tooltip)`、`max-width: 320px`、`pointer-events: none`、遊戲面板外觀（`--surface` 底、2px `--border`），位置以 `transform: translate3d()` 設定。
- `tokens.css` 新增 `--z-tooltip: 30`（介於底部面板 20 與雜訊疊層 40 之間）。

### 3.5 `src/lib/i18n.ts`

- 刪除不再使用的 `tooltipHint`、`tooltipKeys`。

## 4. 錯誤處理與邊界

- 物品格缺少 template：不顯示說明框（與現行行為一致）。
- 篩選把滑鼠下方的物品隱藏：`pointerout` 不會觸發，因此篩選變更（現有 MutationObserver）時一併隱藏說明框。
- 說明框尺寸大於視窗：貼齊左上邊距，不產生捲軸。
- 頁面捲動、視窗縮放：隱藏說明框；游標仍在物品格內時，下一次 `pointermove` 重新顯示。
- 游標在同一格內從連結移到圖示等子元素：`pointerout` 的 `relatedTarget` 仍屬同一 `.entry-card`，不隱藏。

## 5. 測試

### 5.1 單元（`tests/unit/site/tooltip-position.test.ts`）

- `followCursor`：預設右下；右緣翻轉到左側；下緣翻轉到上方；右下角兩軸同時翻轉；說明框大於視窗時貼齊邊距。
- `besideElement`：預設右側並對齊頂端；右側放不下改左側；靠近下緣時往上限制。

### 5.2 E2E（`tests/e2e/wiki.spec.ts`，chromium 桌機專案）

- 滑過物品：說明框出現在游標右下方附近（與游標距離約 16px）、移動游標後跟著移動、離開物品格後隱藏。
- 靠近視窗右緣的物品：說明框位於游標左側，且完整在視窗內。
- 鍵盤聚焦物品：說明框出現在該物品格旁，連結的 `aria-describedby` 為 `item-tooltip`。
- 沿用：中英對照關閉時說明框不顯示英文、護甲列表說明框列出 4 個部位、觸控寬螢幕不顯示說明框、手機底部面板相關測試全部不變。

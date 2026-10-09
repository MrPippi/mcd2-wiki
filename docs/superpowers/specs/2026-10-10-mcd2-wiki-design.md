# Minecraft Dungeons II 繁體中文 Wiki — 設計規格（原型 v1）

- 日期：2026-10-10
- 狀態：待審閱
- 範圍：原型第一版

## 1. 目標與背景

### 1.1 目標
建立一個 **Minecraft Dungeons II** 的繁體中文 Wiki 原型，資料來自遊戲原版語系檔，提供**繁中／英文雙語**版本，讓玩家能對照遊戲內的中英文名稱與描述。

### 1.2 使用者需求（使用者原話整理）
- 製作 Minecraft Dungeons II 繁體中文 Wiki。
- 先做原型看看，之後再決定方向。
- 內容來源：使用者持有的遊戲原版訊息文件。
- 需要英文版本，方便對照遊戲中的內容。
- 技術方案：靜態網站產生器（Astro）。
- 原型範圍：裝備（武器／護甲／神器）、附魔與效果。

### 1.3 成功標準
1. 執行 `npm run extract` 可從 `source-data/` 產出原型範圍內的全部條目資料。
2. 執行 `npm run build` 產出可離線瀏覽的靜態網站，含 `/zh/` 與 `/en/` 兩個語言版本。
3. 範圍內每個已上線（`release: "base"`）條目都有獨立頁面，顯示中英名稱與描述；有對應圖示者顯示圖示。
4. 語言切換可跳到同一條目的另一語言頁；對照模式可開關且記憶於瀏覽器。
5. 全站搜尋可用中文或英文找到條目（例：「劍」、「sword」）。
6. 抽取管線單元測試覆蓋率 ≥ 80%；E2E 主要流程通過。

### 1.4 非目標（本版不做）
- 數值資料（傷害、防禦、掉落率等，原始資料不含）。
- 掉落地點、攻略文章頁（目錄預留，不實作內容）。
- 生物／Boss、區域、NPC、任務、對話。
- 留言、帳號、線上多人編輯。
- 公開部署（原型階段僅本機預覽；建立 GitHub repo 與上線需另行確認）。

## 2. 來源資料

### 2.1 位置與處理原則
- 位置：`source-data/`（使用者放置之遊戲解包檔，約 115 MB、2,580 檔）。
- **不納入 git**（`.gitignore` 已排除）：屬版權素材且體積大。只提交抽取後的 JSON 與實際使用的圖示。

### 2.2 語系檔
- 路徑：`source-data/Localization/All/<culture>/All.json`
- 使用 culture：`en`（英文）、`zh-Hant`（繁體中文）。兩者 key 集合完全一致（108 namespace、5,290 key）。
- 結構：
  ```json
  { "Text/Release/<Table>.csv": { "<Key>": "<Text>" } }
  ```
- Key 格式：`SW_<Kind>_<Id>_SW_TextEntry_<Field>`
  - `Kind`：`Item`、`Enchantment`、`Effect`、`Status`
  - `Id`：如 `Sword`、`Sword_Unique1`、`Artifact_FireBracelet`、`DiscipleBoots_Unique`
  - `Field`：`Name`、`Description`、`Description_Long`、`Description_EffectTotal`、`Description_EffectTotalAdjusted`、`Name_Tiered`
- 文字內嵌標記：
  - `<emphasis>…</>`
  - `<SWDecorator Color="#RRGGBBAA">…</>`
  - 數值佔位符 `{0}`、`{1}`…
  - 換行 `\n`

### 2.3 原型範圍使用的 namespace

| 分類 (category) | Namespace（`Text/Release/` 下） | release |
|---|---|---|
| `melee` | `DT_ItemDefinitionMelee.csv` | base |
| `melee` | `DT_R3ItemDefinitionMelee.csv`、`DT_R4ItemDefinitionMelee.csv` | upcoming |
| `ranged` | `DT_ItemDefinitionRanged.csv` | base |
| `ranged` | `DT_R4ItemDefinitionRanged.csv` | upcoming |
| `armor` | `DT_ItemDefinitionArmor.csv` | base |
| `armor` | `DT_R3ItemDefinitionArmor.csv`、`DT_R4ItemDefinitionArmor.csv` | upcoming |
| `artifact` | `DT_ItemDefinitionArtifact.csv` | base |
| `artifact` | `DT_R3ItemDefinitionArtifact.csv`、`DT_R4ItemDefinitionArtifact.csv` | upcoming |
| `enchantment` | `DT_EnchantmentDefinition.csv` | base |
| `enchantment` | `DT_R4EnchantmentDefinition.csv` | upcoming |
| `enchantment-book` | `DT_ItemDefinitionEnchantmentBook.csv` | base |
| `enchantment-book` | `DT_R4ItemDefinitionEnchantmentBook.csv` | upcoming |
| `effect` | `DT_EffectDefinition.csv` | base |
| `effect` | `DT_R3EffectDefinition.csv` | upcoming |
| `status` | `DT_StatusDefinition.csv` | base |
| `status` | `DT_R3StatusEffectDefinition.csv`、`DT_R4StatusEffectDefinition.csv` | upcoming |

`R3`／`R4` 表推測為未上線內容（無對應圖示），標記 `release: "upcoming"`，**原型不產生頁面**，但保留於資料中。

### 2.4 圖示
- 各分類的圖示來源目錄（皆在 `source-data/` 下，只收 `T_UI_*.png`）：
  - 裝備（近戰／遠程／護甲／神器）：`Assets/Art/Characters/Player/Equipment/`（約 262 張）
  - 附魔與附魔書：`Assets/UI/Icons/Enchantments/`（`T_UI_Icon_Enchantment_<Id>.png`；附魔書沿用對應附魔的圖示）
  - 狀態：`Assets/UI/Icons/Statuses/`（`T_UI_Icon_Status_<Id>.png`）
  - 效果：無圖示
- 圖示外框（複製到 `public/icons/frames/`，清單寫入 `src/data/frames.json`；缺檔時列入報告、網站改為無框）：
  - `artifact`：`Assets/UI/HUD/Player/Hotbar/Artifacts/Slot/T_UI_ArtifactSlot_Default.png`（快捷列神器欄），用於神器；缺檔時退回物品欄格
  - **物品欄格**（武器、護甲、狀態）：遊戲中由 `M_SlotFrame` 著色器繪製、沒有對應貼圖，網站以 CSS 重現，色值取自遊戲物品欄截圖：由外而內 1px 黑邊、2px 稀有度框（一般 `#897A6D`、獨特 `#FF7E2F`）、1px `#353535`、1px `#0D0D0D`、1px 內光（獨特 `#AB6F2E`）；底色一般 `#161616`，獨特為左上橘色漸層至 `#271B15`，並在左上角加上由 5 個橘色方塊組成的「×」稀有度標記（遊戲截圖中的金色星章是「新物品／收藏」標記，與稀有度無關，不呈現）。「稀有（藍框）」是掉落時的稀有度而非物品屬性，網站不呈現
  - `enchantment`：`Assets/UI/Icons/Enchantments/T_UI_Enchantment_Book_Slot.png`，用於附魔與附魔書
- 附魔與狀態允許「退回基底 Id」比對（`Burning_Infinite`→`Burning`、`FireAspect_II`→`FireAspect`）；裝備不退回，避免獨特版誤用一般版圖示。
- 檔名與 Id 不一致，例：
  - `Sword_Unique1` ↔ `T_UI_Sword_Unique_Icon`
  - `DiscipleBoots` ↔ `T_UI_Boots_Disciple_Icon`
  - `Artifact_FireBracelet` ↔ `T_UI_BraceletFire_Icon`
  - `MoonSword` ↔ `T_UI_Moonsword_Icon`

## 3. 架構

### 3.1 目錄結構

```
mcd2-wiki/
├─ source-data/                 # 原始遊戲檔（gitignored）
├─ scripts/extract/
│   ├─ index.ts                 # CLI 入口：npm run extract
│   ├─ config.ts                # 分類 ↔ namespace 對照、路徑常數
│   ├─ schemas.ts               # zod：輸入語系檔 schema、輸出條目 schema
│   ├─ parse-locale.ts          # 讀取並驗證 en / zh-Hant All.json
│   ├─ group-entries.ts         # key → 條目（合併欄位、判斷 variant）
│   ├─ match-icons.ts           # Id ↔ 圖示：token 比對 + overrides
│   ├─ icon-overrides.json      # 手動圖示對照
│   ├─ link-entries.ts          # 一般↔獨特、附魔↔附魔書、護甲套裝分組
│   ├─ render-markup.ts         # 遊戲標記 → 安全 HTML
│   ├─ copy-icons.ts            # 複製用到的圖示到 public/icons
│   └─ report.ts                # 產出 extract-report.md
├─ src/
│   ├─ data/                    # 抽取結果（進 git）
│   │   ├─ entries.json         # 全部分類的條目
│   │   └─ armor-sets.json
│   ├─ i18n/                    # 介面文字 zh / en
│   ├─ content/guides/          # 預留：手寫攻略 Markdown
│   ├─ components/
│   ├─ layouts/
│   └─ pages/[lang]/...
├─ public/icons/<category>/<slug>.png
├─ tests/
│   ├─ unit/                    # Vitest
│   ├─ fixtures/mini-source/    # 迷你版 source-data
│   └─ e2e/                     # Playwright
└─ docs/superpowers/specs/
```

### 3.2 資料流

```
source-data/ ──npm run extract──▶ src/data/*.json + public/icons/ + extract-report.md
                                        │
                                  astro build + pagefind
                                        ▼
                                      dist/
```

### 3.3 技術選型
- Node.js（LTS）+ TypeScript
- Astro（靜態輸出，內建 i18n routing）
- zod（schema 驗證）
- Pagefind（靜態全文搜尋，支援中文）
- Vitest（單元／整合測試）、Playwright（E2E）

## 4. 資料模型

### 4.1 條目（Entry）

```ts
type Lang = "zh" | "en";
type Localized = Record<Lang, string>;

interface Entry {
  id: string;                 // 原始 Id，如 "Sword_Unique1"
  slug: string;               // "sword-unique1"
  category: Category;         // melee | ranged | armor | artifact | enchantment | enchantment-book | effect | status
  variant: "normal" | "unique";
  release: "base" | "upcoming";
  name: Localized;            // 純文字
  description?: Localized;    // 已渲染的安全 HTML
  descriptionLong?: Localized;
  icon?: string;              // "icons/melee/sword-unique1.png"（頁面再加 base）
  armorPiece?: "helmet" | "chest" | "leggings" | "boots";
  untranslated?: Lang[];      // 缺翻譯而回退的語言
  links: {
    variants?: string[];      // 一般 / 獨特 互連 slug
    enchantmentBook?: string; // 附魔 → 附魔書
    enchantment?: string;     // 附魔書 → 附魔
    armorSet?: string;        // 護甲部位 → 套裝 slug
  };
}
```

### 4.2 護甲套裝（ArmorSet）

```ts
interface ArmorSet {
  slug: string;               // "disciple"、"disciple-unique"
  name: Localized;            // 由部位名稱推導或以套裝 Id 呈現
  variant: "normal" | "unique";
  pieces: Partial<Record<"helmet" | "chest" | "leggings" | "boots", string>>; // entry slug
}
```

### 4.3 規則
- **variant**：Id 含 `_Unique` 或 `_Unique<n>` 為 `unique`，否則為 `normal`。
- **基底 Id**：去除 `_Unique\d*` 後綴；同基底的 normal/unique 互連。
- **slug**：Id 轉小寫，`_` 與大小寫邊界轉 `-`；`Artifact_`、`EnchantmentBook_` 前綴移除。**同一分類內**唯一（網址含分類），衝突時建置失敗。
- **護甲部位**：Id 中出現 `Helmet`／`Chest`／`Leggings`／`Boots` 決定部位，其餘部分為套裝 Id。
- **附魔 ↔ 附魔書**：先以 Id 比對（附魔書 Id 去掉 `EnchantmentBook_` 等於附魔 Id），再以正規化英文名稱比對。比對不到不連結，列入報告。
- **連結只指向 base 條目**；upcoming 條目不建立任何連結。

## 5. 抽取管線細節

### 5.1 parse-locale
- 讀取 `en`、`zh-Hant` 兩檔，以 zod 驗證為 `Record<string, Record<string, string>>`。
- 檔案不存在或格式錯誤：拋出錯誤並指出檔案路徑與失敗位置，**中止**。

### 5.2 group-entries
- 只處理 §2.3 列出的 namespace。
- 以 regex `^SW_(Item|Enchantment|Effect|Status)_(.+?)_SW_TextEntry_(.+)$`（不分大小寫，實際資料有 `Sw_Effect_…`）拆解 key；不符者（如無 Id 的 `SW_Enchantment_SW_TextEntry_Name_Tiered`）列入報告並略過。
- 只使用 `Name`、`Description`、`Description_Long` 欄位。`Description_EffectTotal(Adjusted)`、`Name_Tiered` 在實際資料中只有佔位符，捨棄（報告只計數）。
- 整段只有佔位符（如 `{0}`）的描述欄位捨棄。
- 同 Id 的欄位合併為單一條目。
- 缺 `Name` 的條目：列入報告並略過。

### 5.3 match-icons
- 先查 `icon-overrides.json`（`{ "<Id>": "<相對於 source-data 的路徑>" | null }`，`null` 表示明確無圖示）。
- 否則自動比對（候選為圖示根目錄下所有 `T_UI_*.png`，不要求 `_Icon` 尾碼）：
  - 依 `_` 與小寫→大寫邊界拆詞並轉小寫；丟掉 `t`、`ui`、`icon`、`png`；`chestplate→chest`、`gauntlets→gauntlet`；`unique\d*→unique`；Id 去除 `Artifact_`；
  - 圖示以「詞的所有排列串接」建索引，Id 以「詞依序串接」查詢，相等即配對（可處理詞序差異與 `Moonsword`／`MoonSword` 這類拆詞差異）。
- 已知無法自動配對的 7 個神器預先寫入 `icon-overrides.json`。
- 多於一個候選：視為未配對並列入報告。
- 未配對：`icon` 留空，列入報告。

### 5.4 render-markup
- 先對全文做 HTML escape，再以白名單轉換：
  - `<emphasis>X</>` → `<em class="emphasis">X</em>`
  - `<SWDecorator Color="#RRGGBB(AA)">X</>`：顏色符合 `^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$` 才轉為 `<span style="color:#RRGGBB">X</span>`，否則只保留文字
  - `{n}` → `<span class="placeholder">{數值}</span>`（en 顯示 `{value}`）
  - `\n` → `<br>`
- 未知標籤：保留為跳脫後的純文字，並列入報告。
- `name` 欄位只去除標記，輸出純文字。

### 5.5 缺翻譯處理
- `zh` 為空或與 key 相同時，回退為 `en` 文字，並在 `untranslated` 記錄 `"zh"`；反之亦然。

### 5.6 輸出
- 寫入前以 zod 驗證輸出 schema；驗證失敗則中止。
- 輸出採穩定排序（依 category、slug），讓 git diff 可讀。
- 只複製 `release: "base"` 且有圖示的條目圖示到 `public/icons/<category>/<slug>.png`。
- `extract-report.md`：各分類條目數、缺翻譯、缺圖示、未知標記、未比對的附魔書、略過的 key。

## 6. 網站

### 6.1 路由

| 路徑 | 頁面 |
|---|---|
| `/` | 導向 `/zh/` |
| `/[lang]/` | 首頁 |
| `/[lang]/[category]/` | 分類列表（melee、ranged、artifact、enchantment）。附魔書不另建頁面，併入其對應的附魔頁（「附魔書」區塊列出書名，書的描述與附魔不同時一併顯示） |
| `/[lang]/[category]/[slug]/` | 條目頁 |
| `/[lang]/armor/` | 護甲套裝列表 |
| `/[lang]/armor/[setSlug]/` | 護甲套裝頁（含四部位） |
| `/[lang]/armor/piece/[slug]/` | 護甲單件頁 |
| `/[lang]/effect/`、`/[lang]/status/` | 效果／狀態表格頁（不另建單頁；每列以 `#slug` 錨點連結） |
| `/[lang]/search/` | 搜尋頁（支援 `?q=` 預填） |

`lang` ∈ `zh`、`en`。只為 `release: "base"` 條目建頁。

### 6.2 雙語與對照模式
- 介面文字放在 `src/i18n/{zh,en}.json`。
- 語言切換：同路徑替換 `lang` 段。
- 對照模式：在主要語言內容下方以次要樣式顯示另一語言的名稱與描述。預設開啟；開關狀態存於 `localStorage`（讀寫包 try/catch，失敗時用預設值）。

### 6.3 分類列表
- 圖示網格：圖示、主要語言名稱、對照語言名稱。
- 篩選：全部／一般／獨特。
- 頁內即時篩選：輸入文字比對中英名稱（純前端，不依賴 Pagefind）。

### 6.4 條目頁
- 圖示（無則顯示佔位圖）、中英名稱、分類標籤、variant 標籤。
- 描述、長描述。
- 相關連結：另一 variant、附魔書／附魔、所屬護甲套裝。
- 未翻譯欄位顯示「未翻譯」標記。

### 6.5 搜尋
- 建置後執行 Pagefind 建立索引；每語言各自索引。
- 搜尋頁使用 Pagefind UI。

### 6.6 版面與共通元素
- 深色主題，參考 Minecraft Dungeons 色系。
- 響應式：手機（≥ 360px）至桌機。
- 頁尾：「非官方粉絲網站，與 Mojang Studios／Microsoft 無關。遊戲文字與圖像版權歸原權利人所有。」及資料來源說明（遊戲版本語系檔）。

## 7. 錯誤處理總覽

| 情境 | 行為 |
|---|---|
| 語系檔不存在／格式錯誤 | 中止，訊息含檔案路徑 |
| namespace 缺失 | 報告警告，該分類為空 |
| key 格式不符 | 略過，列入報告 |
| 缺 Name | 略過，列入報告 |
| 缺翻譯 | 回退另一語言，標記 untranslated |
| 缺圖示／多重候選 | 不設圖示，列入報告 |
| 未知標記／非法顏色 | 輸出純文字，列入報告 |
| slug 衝突 | 中止 |
| 輸出 schema 驗證失敗 | 中止 |

## 8. 測試

### 8.1 單元測試（Vitest）
- `parse-locale`：正常、檔案不存在、非物件、值非字串。
- `group-entries`：欄位合併、variant 判斷、未知 key、缺 Name。
- `match-icons`：大小寫差異、詞序差異、`Unique1`↔`Unique`、`Artifact_` 前綴、override（含 null）、多重候選。
- `link-entries`：variant 互連、護甲部位與套裝、附魔↔附魔書。
- `render-markup`：每種標記、巢狀、非法顏色、未知標籤、HTML 注入字串（`<script>`、`"onerror=`）。
- slug 產生與衝突偵測。
- 覆蓋率目標：`scripts/extract/` ≥ 80%。

### 8.2 整合測試
- `tests/fixtures/mini-source/`：包含少量 en / zh-Hant 條目與幾張假圖示，跑完整 extract，比對預期 JSON 快照。

### 8.3 E2E（Playwright，對 `astro preview`）
1. `/zh/` 首頁載入，分類入口可點。
2. 進入近戰列表 → 點「劍」→ 條目頁顯示中英名稱與圖示。
3. 語言切換 → `/en/melee/sword/`，顯示英文。
4. 關閉對照模式 → 對照文字隱藏；重新整理後狀態保留。
5. 搜尋「劍」與「sword」皆有結果。
6. 護甲套裝頁列出四部位並可連到單件頁。
7. 抽查全站內部連結無 404。

## 9. 部署（原型後）
- 本機：`npm run extract` → commit `src/data/` 與 `public/icons/`。
- CI：GitHub Actions 執行 `npm ci`、`npm test`、`astro build`、Pagefind，發布到 GitHub Pages。CI 不需要 `source-data/`。
- 建立 GitHub repo 與公開上線前，需使用者確認。

## 10. 實作順序
1. 專案初始化（Astro + TS + Vitest + Playwright）。
2. 抽取管線（TDD）：parse → group → markup → icons → links → 輸出 / 報告。
3. 對真實 `source-data` 執行，檢視報告，補 `icon-overrides.json`。
4. 頁面骨架：layout、i18n、首頁、分類列表、條目頁、護甲套裝。
5. 對照模式、頁內篩選、Pagefind 搜尋。
6. E2E 測試。
7. 部署設定（不執行發布）。

## 11. 風險與待定事項
- **圖示配對率**：自動比對可能仍有缺漏 → 以 `icon-overrides.json` 逐步補齊；原型接受部分缺圖。
- **R3／R4 判斷**：「未上線」為推測。若確認已上線，改 config 即可產生頁面。
- **護甲套裝名稱**：語系檔無獨立套裝名稱，取各部位名稱的最長共同前綴（en 退到詞邊界、zh 去掉結尾「之」，例：「修行者」／Disciple、「賢者」／Sage）；少於 2 個部位或結果太短時退回套裝 Id 並列入報告。
- **版權**：使用解包素材，網站須維持非商業並保留聲明。

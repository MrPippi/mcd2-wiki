# 維護與開發指南

給維護者的說明：更新遊戲資料、地圖圖塊、素材索引、開發與部署。玩家請看 [README](../README.zh-TW.md)。

## 更新資料（遊戲改版時）

1. 將遊戲解包檔放在 `source-data/`（不進 git）。
2. `npm run extract` → 更新 `src/data/*.json`、`public/icons/`，並產生 `extract-report.md`。
3. 檢查報告；缺圖示時編輯 `scripts/extract/icon-overrides.json` 後重跑。
   - 遊戲版本不在解包檔裡，`npm run extract` 會從遊戲的 `MicrosoftGame.config`（`<Identity … Version="…">`）讀出版本，寫進 `shared/game-version.json`，並替換兩份 README 與兩個 issue 表單（資料錯誤、遊戲內測試）裡的版本號。依序找 `source-data/MicrosoftGame.config`、`GAME_DIR` 指定的安裝目錄（預設 `C:\XboxGames\Minecraft Dungeons II\Content`）。已安裝的遊戲可能比解包檔新，所以解包時最好把當時的 `MicrosoftGame.config` 一起複製進 `source-data/`；版本取自安裝目錄時終端機會提醒。都找不到就不改版本。配裝頁會把版本寫進分享連結，打開舊版本的連結時會提示。
   圖示依序取自：`icon-overrides.json` → 資料表每列的 `IconReference`（`/Game/Spicewood/X` 對應 `Assets/X.png`；其他 `/<外掛>/X` 先找 `Plugins/<外掛>/Content/X.png`、再找 `Assets/X.png`）→ 依檔名比對。神器、護符、披風、寵物的資料列名稱與條目 id 對不上，仍靠檔名比對與覆寫清單。
   部分圖示在遊戲外掛裡，不在 `Assets/` 下：把解包的 `Plugins/OreUI/Content/` 與 `Plugins/SpicewoodUI/Content/` 以相同路徑放進 `source-data/`。效果沒有圖示時照常發布，只是不顯示圖。缺少 `SpicewoodUI` 時，世界地圖的標記圖示會全部被略過，且 `extract-report.md` 不會有任何提示，務必放入。
4. 遊戲地圖有變動時跑 `npm run tiles`（見下方「世界地圖」）。
5. 抽取更新 `shared/game-version.json` 後跑 `npm run game-diff -- <上一版資料的 commit>`（通常是 `master`），把數值變動寫進 `src/data/game-changes.json`；並在 `src/game-updates.json` 補上新版本（見下方「更新日誌」）。
6. Commit `shared/game-version.json`、兩份 README、`.github/ISSUE_TEMPLATE/`、`src/data`、`public/icons`、`public/map`、`public/mobs`、`src/assets/brand`、`scripts/extract/icon-overrides.json`、`scripts/extract/mob-portrait-overrides/`。重新匯出的 PNG 常只是編碼不同、像素完全一樣，這類圖示的變動不必 commit。

網站圖示（favicon、主畫面圖示、分享預覽圖）與首頁背景取自遊戲 `Assets/UI/Icons/` 的 Logo 與 SplashScreen，同樣由 `npm run extract` 複製；首頁背景在 build 時轉成 WebP。分享預覽圖需要絕對網址，部署時由 `SITE_URL` 提供。

流量統計用 Cloudflare Web Analytics（無 cookie），部署 workflow 以 `CF_BEACON_TOKEN` 傳入站點 token，本機 build 不載入；搜尋曝光與索引狀態看 Google Search Console。

## 新增抽取步驟

`npm run extract` 由 `scripts/extract/pipeline.ts` 依序跑 `scripts/extract/steps/index.ts` 裡登記的步驟，每個步驟一個檔案（`scripts/extract/steps/<名稱>.ts`），用 `defineStep`（`scripts/extract/step.ts`）宣告：

- `name`：步驟名稱。
- `needs`：用到的其他步驟，例如 `{ locales: localesStep, quests: questsStep }`。`run` 的第二個參數只拿得到這些步驟的 `value`，型別由步驟本身推得；沒列的拿不到。
- `writes`：會寫進 `src/data/` 的檔名（`run` 回傳的 `files` 必須剛好是這些，否則報錯；兩個步驟寫同一個檔也會報錯）。
- `run(context, needs)`：回傳 `{ value, issues?, files?, tablesRead? }`，`value` 給後面的步驟用。

新增一個資料頁的抽取：

1. 新增 `scripts/extract/steps/foo.ts`，呼叫現有的抽取函式並回傳上述結果（抽取邏輯本身放在 `scripts/extract/foo*.ts`）。
2. 在 `steps/index.ts` 的 `EXTRACT_STEPS` 加一行。清單順序決定 `extract-report.md` 內問題的排列；執行順序由 `needs` 決定，清單裡漏登記、重名、`needs` 形成迴圈都會在啟動時報錯（`validateSteps`）。

需要的順序都寫成 `needs`：例如任務釘點（`quest-markers`）需要 `quests`；`icons` 步驟會先清空 `public/icons/` 再複製，所有要往 `public/icons/` 寫檔的步驟（成就、怪物頭像、區域圖示）都要列 `icons`。世界地圖有兩份：`map` 是純地圖，給各抽取步驟讀；寫出的 `map.json` 是 `spot-markers` 步驟在加上任務釘點之後的結果。

## 共用資料契約（`shared/`）

`shared/` 放抽取程式與網站都要用的東西：各份輸出的 schema（`*-schema.ts`、`schemas.ts`）、分類與語言清單（`config.ts`、`langs.ts`）、介面字串與 `shared/i18n/*.json`、分區登記（`sections.ts`）、機率公式（`affix-odds.ts`、`drop-odds.ts`）等純程式。依賴方向是 `scripts/ → shared/ ← src/`：`src/` 與 `scripts/` 不互相 import（兩邊只透過 `shared/` 或 `src/data/` 的檔案溝通），`shared/` 也不能 import 它們；`tests/unit/site/shared-seam.test.ts` 會檢查。放進 `shared/` 的檔案可能被瀏覽器腳本打包，不要加進 Node 模組或建立會一次拉進整包的 barrel 檔。

## 瀏覽器模組（`src/client/`）

會碰 DOM 的模組（mount 函式、事件綁定、`document` / `window`）一律放 `src/client/`，由 `.astro` 的 `<script>` 只留 import 與 mount 呼叫；純邏輯（解析、編碼、計算、排序）留在 `src/lib/` 或 `shared/`，才能直接用 vitest 測。`tests/unit/site/dom-boundary.test.ts` 會檢查 `src/lib/` 與 `shared/` 沒有 `document.` / `window.` 等瀏覽器全域參照（目前沒有例外；若真的需要，在該測試的 `ALLOWED` 寫明理由）。`client-bundle.test.ts` 另外限制瀏覽器腳本不能拉進介面字串與 zod。

## 新增網站分區

網站有哪些分區由 `shared/sections.ts` 統一登記：

- 道具分類（分頁列、分類頁）：`NAV_GROUPS`（分頁順序，麵包屑與 `llms.txt` 的分類清單也從這裡來）、`GRID_CATEGORIES` / `TABLE_CATEGORIES`（有分類頁的分類）。
- 分類以外的頁面（漢堡選單、麵包屑、`llms.txt`）：`PAGE_SECTIONS` 加一列 `{ segment, key }`，`segment` 要與 `src/pages/[lang]/` 的路徑一致；頁名與選單文字不同時加 `title`，要列進 `llms.txt` 時加 `llms: { intro, rank }`（`rank` 是在 `llms.txt` 的順序）。

新增分區：在 `PAGE_SECTIONS` 加一列、新增頁面本身、在 16 份 `shared/i18n/*.json` 補上對應字串（`tests/unit/site/sections.test.ts` 會檢查路由與字串都在）。首頁精選（`HomeHero.astro`）、圖示（`ui-icons.ts`）、邊框（`frames.ts`）、標籤（`kicker.ts`）是各自挑選或針對全部分類的清單，不由此推導。

## 新增目錄頁

目錄頁（標題、數量、第二語言標題、簡介的版型）共用 `src/layouts/CatalogPage.astro`，新頁面只需要填內容：

- `getStaticPaths`：每個語言一頁的頁面寫 `export const getStaticPaths = langPaths;`（`src/lib/lang-paths.ts`），語言從 `Astro.props.lang` 取。
- 頁首：`<CatalogPage lang label={(l) => t(l, "key")} count intro introClass class headClass pagefindBody>`。`label` 回傳指定語言的頁名（同時產生頁面標題、`<h1>` 與第二語言標題）；`intro` 同時是頁面描述；`count` 與 `icon` 可省略。頁首要多放的東西（篩選列、備註、標籤）用 `slot="head"`，其餘內容直接寫在標籤內。
- 沒有套用的頁面：`GuidePage`（附返回連結）與靈魂風暴（標題是遊戲文字 HTML，前面有圖示）頁首結構不同，仍自己寫。

## 讀取新的資料表

抽取程式讀 DataTable／CurveTable 一律走 `scripts/extract/table-reader.ts`，不要直接用 `readJsonFile`：

- `readDataTable(dir, "DT_Foo", { onRead, optional, dropBase })`：回傳列陣列；缺檔或不是陣列會報錯，`optional` 缺檔時回傳空陣列，`dropBase` 濾掉 `Base*` 範本列，`onRead` 登記到 `tablesRead`。
- `readTableFile(file, label)`：回傳原始 JSON（缺檔為 `undefined`），給要自己驗證的表（曲線表、成就定義等）。
- 兩者都會拒讀 `OnlineConstants`（內含遙測金鑰）；`tests/unit/extract/table-reader.test.ts` 也限制只有少數非資料表的載入器可以 import `read-json`，新程式繞過讀取器會讓測試失敗。

## 讀取遊戲文字

遊戲文字的在地化一律走 `scripts/extract/game-text.ts`，不要自己組各語言的記錄或英文 fallback：

- `gameText(locales, namespace, key, accept?)`：回傳 `{ text, untranslated }`；沒有英文就回傳 `undefined`，其他語言缺字就補英文並列入 `untranslated`。`gameHtml` 同上，另把遊戲標記轉成 HTML。
- `accept(lang, text)` 決定某語言能不能發布這段字（回傳 `undefined` 代表不行）：有語言問題的翻譯在這裡擋掉，網站就顯示英文並標為未翻譯（「語言有問題一律退回英文」的規則）。

## 原始素材索引

`npm run assets` 掃描 `source-data/Assets/`，依分類／分項／細項整理所有素材，並以檔案內容比對 `public/icons/` 標出用途（網站已發布、網站介面、已抽取未發布、未使用）。

- 報告：`asset-index.md`（不進 git）——各分類統計、與上次比較、未分類資料夾、未使用的圖示、原始檔 → 網站路徑。
- 瀏覽頁：`source-data/asset-gallery.html`——用瀏覽器直接開，可依分類、用途、類型、變動篩選與搜尋。

遊戲改版加入新素材時：

1. 更新 `source-data/` 後先跑 `npm run extract`，再跑 `npm run assets`；地圖圖像有變動時另跑 `npm run tiles`。
2. 報告「與上次比較」列出新增、變更、移除的檔案；瀏覽頁可用「變動 → 新增」只看新素材。
3. 報告「未分類資料夾」列出沒有規則的新資料夾：在 `scripts/assets/rules.json` 加一條規則（`prefix` → `group`，`sub` 固定分項或用下一層資料夾名當分項，`names` 可替資料夾取中文名），重跑即可。既有前綴下的新資料夾（例如新的場景）會自動成為分項，不必改規則。
4. 確認後 commit `scripts/assets/snapshot.json`（素材雜湊快照，作為下次比較的基準）。只想重看差異而不更新快照時用 `npm run assets -- --keep-snapshot`。

網站新增公開分類時（`shared/tabs.ts`），對應圖示會自動改判為「網站已發布」。

## 武器數值與效果（遊戲資料表）

`npm run extract` 也會讀遊戲的 DataTables，產生 `src/data/weapons.json`：每一擊／每一發的數值、定位與重量、可出現的效果（含 I/II/III 數值）與獨特武器的固定效果。
同一步驟也會產生：

- `src/data/artifacts.json`：神器的冷卻時間、靈魂消耗、持續時間、範圍與可出現的效果。
- `src/data/effects.json`：效果說明中的數值（I/II/III），取自各等級的效果模板。
- `src/data/enchantments.json`：附魔說明中的數值（I/II/III），依附魔技能的 key value 與各等級的 Override／Add 調整計算；整數型的機率值已是百分比（8 = 8%）。

- 資料表放在 `source-data/DataTables/UFS/`（解包的 `Content/Spicewood/Core/DataTables/`）；缺少時武器數值與效果不會產生，報告會列出 `missing-datatables`。
- 可出現的效果依遊戲規則計算：掉落表依武器標籤選出效果群組，再以各效果基底模板的 `IncompatibleTagsQuery` 排除不適用的武器種類。
- 每一擊的時間與每秒傷害來自動畫檔，不在資料表裡，因此沒有顯示。
- 效果、附魔、附魔書與護符的說明若有遊戲資料算不出的數值，整個條目暫不上架（附魔書無法填值時，其附魔也一併隱藏）；獨特武器的固定效果卡同理。
- 資料表沒有的固定效果數值（存在技能藍圖中）寫在 `src/data/fixed-bonus-overrides.json`，每筆註明確認來源。

## 威脅與難度（曲線表）

`/<lang>/guides/threat/` 讀 `source-data/CurveTables/CT_*.json`（CUE4Parse 匯出的 CurveTable，來源為 `Spicewood/Content/Spicewood/GameplayLogic/CT_*.json`，含 `AttributeCurves/CT_AttributeAdjustments`），寫入 `src/data/guides.json` 的 `threat`（威脅 1–20）與 `difficulty`（低／一般／高）。

- 曲線一律經資料表的參照找到，不寫死曲線名稱：`DT_GameBalanceDefinition` 的 `SecondPass` 列（傷害、稀有度、效果階級曲線與每威脅角色等級）、`DT_DifficultyDefinition`（各難度倍率與文字）、`DT_WorldActorDefinition`（怪物生成設定表）、`DT_RarityChanceDefinition`（低難度不掉特殊／獨特）。
- 只支援線性與常數（階梯）插值，超出端點時取端點值；其他插值或外插寫進報告（`curve-unsupported`），讀作線性／常數。缺少 `CurveTables/` 時報告 `missing-curve-tables`，攻略頁該區段隱藏。
- 兩項尚未在遊戲內確認，標示於頁面，確認後把 `scripts/extract/guides-status.json` 的 `threatBalanceRow` 改為 `true`：遊戲實際使用 `Active` 或 `SecondPass` 哪一列（`Active` 沒有曲線）；一般難度指向 `CT_DifficultySettings` 裡不存在的 `NormalDifficultyMultiplier`，暫以 ×1 顯示。
- 難度圖示（`T_UI_Threat*`）目前未使用。

## 效果出現機率

近戰、遠程、護甲與神器頁的「效果出現機率」表：在該裝備與稀有度已產生的前提下，各隨機效果（各階級）至少出現一次的機率，可選威脅 1–20、稀有度與靈魂風暴獎勵額外詞條。`npm run extract` 寫入 `src/data/affix-models.json`（約 160 KB，相同效果池的裝備共用一個模型），頁面與瀏覽器腳本用同一份 `shared/affix-odds.ts` 計算。

- **效果池的組成**（`scripts/extract/affix-pool.ts` 開頭有完整說明）：`DT_EffectTemplateGroupDropTableDefinition` 的每一列以一個物品標籤為鍵，物品用它所有標籤（含父標籤）和 `SW.Item.Property.Gear` 的列；同一效果群組被多列指定時取最後一個 Set（蘑菇護甲的 Utility 原型 1 對 Gear 0.25，遊戲結果是 0.25）。群組內各模板有自己的權重與運算（Set／Add／Multiply），群組權重只乘 Set／Add。每件裝備還帶有它所屬基底列（TypeTag 出現在它標籤裡的列，如箭袋）的標籤；神器一律視為 `SW.Item.Property.Artifact`。基底模板的 `IncompatibleTagsQuery` 排除不適用的裝備種類。
- **權重**：同一模板的條目，Set 取最大、Add 加總、Multiply 相乘；階級係數（`DT_GameBalanceDefinition` SecondPass 的 `EffectChanceScalingCurves`，已在 `guides.json` 的 `threat[].effectTiers`）對 Set、Add、Multiply 三者**各乘一次**（多筆 Multiply 只乘一次）。抽 n 個欄位（稀有度的 `BaseNumberOfRerollableEffects`，加靈魂風暴獎勵的 `AdditionalEffectChances`）按權重不放回，抽中後同一效果的所有階級移出。獨特稀有度只給獨特變體，一般裝備給稀有與特殊。
- **驗證**：與第三方「逐級詞條概率」表（遊戲 1.1.1）逐格比對，363,400 格全數相符（差 < 1e-6）。該表沒有「特殊」稀有度，所以特殊的數字沒有交叉驗證。
- **尚未在遊戲內確認**，頁面標示，確認後把 `scripts/extract/guides-status.json` 的 `affixOdds` 改為 `true`。需要留意的假設：Mushroom 以外沒有資料能分辨「最後一個 Set 勝出」與「最小值」；`MinimumRequiredItemPower` 目前全為 0 而被忽略，`SecondaryETG` 全空，非 0／非空時報告 `affix-ignored`。

## 掉落機率

物品頁的「掉落機率」表與 `/<lang>/drops/` 掉落機率計算器：觸發一次來源（開一次寶箱、擊敗一次怪物、領一次任務獎勵）時至少掉出一件該物品的機率。`npm run extract` 寫入 `src/data/drop-models.json`（`scripts/extract/drop-*.ts`，規則在 `drop-slots.ts`、`drop-pool.ts`、`drop-rarity-rows.ts`、`drop-universe.ts`），頁面與計算器用同一份 `shared/drop-odds.ts` 計算。

- 涵蓋物品頁列出的寶箱、已發布任務的每一批獎勵、頭目、小頭目與寶箱豬，以及各區域的一般怪物（含靈魂腐化與地卜師）。商人、靈魂風暴寶箱、鑰匙寶箱不在範圍。
- 資料表沒有寶箱出現的區域，故區域寶箱配對所有有掉落池的區域。被略過的來源與無法套用的資料會以 `drop-ignored` 報告。
- **尚未在遊戲內確認**，頁面標示，確認後把 `scripts/extract/guides-status.json` 的 `dropOdds` 改為 `true`。

## 靈魂附魔

`/<lang>/soul-enchantments/` 讀 `DT_SoulEnchantmentDefinition`（名稱取自 `DT_SoulEnchantmentDefinition.csv`，遊戲沒有說明文字），寫入 `src/data/soul-enchantments.json`，圖示複製到 `public/icons/soul-enchantments/`（`/OreUI/...` 參照依上方規則找到 `Assets/UI/Icons/SoulStated/`）。

- 每個附魔有一列基底（`Poison`：名稱、圖示、技能）與 `.I/.II/.III` 三列；各等級顯示該列自己的效果修正（`MultiplyAdditive`／`MultiplyCompound` 顯示為 ×、`AddBase` 為 +/−，+0 略過），技能數值取基底列的技能 key value 再套用該等級的 Override／Add（與裝備附魔相同）。只顯示 `scripts/extract/soul-enchantments.ts` 的 `SHOWN_VALUES` 列出的 key value；距離 ÷100 為格。
- 怪物帶哪種附魔由遊戲程式（`GA_TriggerSoulEnchantmentOnSpawn`）決定，資料只有排除條件：怪物列的 `MobConditions.ExcludedSoulEnchantments`（經 trait 繼承，如 `SoulStatedHusk` → `Husk`）與競技場波次的 `ExcludedSoulEnchantmentsOverride`（以波次標籤中的任務 id 對回任務）。
- **尚未在遊戲內確認**，頁面標示，確認後把 `scripts/extract/guides-status.json` 的 `soulEnchantmentLevels` 改為 `true`：基底列與通用 `Lvl.I–III` 列（最大生命值 ×1.25／×1.5／×2）的修正是否也疊加；`ThreatLevelSettings` 是否就是等級的威脅門檻；`ThreatLevelArea` key value 的意義不明，未顯示。
- 無法顯示的修正或技能寫進報告（`soul-enchantment-ignored`），對不到怪物頁或任務的排除寫進 `soul-enchantment-unlinked`。

## 靈魂風暴

`/<lang>/soul-storm/` 讀 `DT_SoulStormTimeSchedule`（起點、每場長度與間隔）、`DT_SoulStormScheduleAreaRotation`（區域輪替）、`DT_SoulStormPropActorDefinition`（風暴產生器各難度）、`DT_SpawnDefinition`、`DT_LootSourceDefinition`、`DT_RarityChanceDefinition` 與 `DT_GameBalanceDefinition`，寫入 `src/data/soul-storm.json`。倒數在瀏覽器依時程與輪替計算。

- 每場需摧毀幾座風暴產生器不在資料裡（遊戲目標文字的 `{0}` 在執行時填入），頁面用 `src/lib/soul-storm.ts` 的 `OBSERVED_GENERATORS`（遊戲內觀察值 3）填入並註明來源；遊戲改了數量時改這個常數。
- 各區的風暴產生器位置數在 build 時由 `map.json` 的風暴產生器標記計算（見下方「世界地圖」的關卡資料點位）。

## 怪物頭像

怪物圖鑑的頭像是遊戲模型的渲染圖，`npm run extract` 依序取：`scripts/extract/mob-portrait-overrides/<slug>.webp`（進 git）→ `source-data/Renders/Mobs/<資產名>.png`（依怪物資料列的角色參照對到渲染檔），輸出 256 px（`public/mobs/`）與 768 px（`public/mobs/large/`，怪物頁的大圖）。`scripts/extract/mob-portraits.ts` 的 `PORTRAIT_DENYLIST` 列出不採用的渲染檔。

- 渲染工具在 `source-data/Renders/tools/`（不進 git）：用 FModel 匯出怪物的 BP（Save Properties (.json)）、SkeletalMesh（Save Model，產生 `.uemodel` 與材質 `MI_*.json`）與貼圖後，`python -I render_mobs.py <Exports\Dungeons\Content> <Enemies 資料夾> <輸出資料夾> --size 768`。BP 經父類別鏈找模型與材質覆寫。
- 工具會跳過名稱含 `SoulStated`、`Proj`、`Clone` 等的 BP，也只掃傳入的資料夾（`Friendlies/` 下的怪物如寶箱豬要另外指定）。這類頭像渲染後放進覆寫資料夾，目前有寶箱豬、靈魂腐化女巫與扭曲伏守者。
- 靈魂腐化版本的外觀是材質發光與光環特效，渲染工具做不出來，頭像與一般版本相同。
- 扭曲伏守者的觸角材質（`MI_Maw_Antenna`）是 16×8 格的動畫序列圖，直接渲染會把整張圖貼上去；覆寫的頭像只取第 5 列最後一格（螺旋，與製作名單的手繪圖一致）。

## 世界地圖

`/<lang>/map/`（每個語言各一頁）以 Leaflet 顯示遊戲的俯視全圖（主世界、隙浮、營地），標出礦車站、裂隙、傳送雕像、商人、主線／支線任務、風暴產生器、護符寶箱、地下城與區域名稱，可篩選、搜尋，網址 `?world=` 與 `#z/px/py` 可分享視角。

- **圖塊**：`npm run tiles` 把 `source-data/Assets/AutoGenerated/World/WorldMap/BeautyRender/<World>/` 的 1024px 原圖切成 256px webp 圖塊金字塔，輸出到 `public/map/<world>/<z>/<x>/<y>.webp`。每個世界會把各張原圖的檔名、大小與修改時間與 `public/map/<world>/manifest.json` 比對，全部相同就略過；圖塊設定（尺寸、品質、縮放層級）與輸出圖塊是否還在都不檢查。改了設定或要強制重切時，刪掉該世界的 `manifest.json` 再跑（指令沒有強制旗標）。缺原圖時指令失敗並列出檔名。CI 不跑這步，圖塊需 commit。
  - **陸地邊緣**：圖塊的虛空（遊戲烘進圖裡的灰褐色地面）清成透明，並在陸地邊緣內側做一圈像素階梯狀的淡出（`scripts/map-tiles/void-mask.ts` 的 `featherMask`，半徑 `FEATHER_RADIUS` 格 × 4px、`FEATHER_STEPS` 階），邊緣因此化進地圖框的沙色 `#D2B287`（遊戲霧的顏色，`M_WorldMapFogOfWar`）。調整淡出要改 `build.ts` 的 `VOID_MASK_VERSION`，原圖沒變時才會重切。
- **標記**：`npm run extract` 讀 `DT_WorldRegionMapData`、`DT_WorldTeleportPoints`、`DT_WorldExplorationTeleportPoints`、`DT_MerchantLocationsDefinition`、`DT_AreaDefinition`，產生 `src/data/map.json`，圖示複製到 `public/icons/map/`。
  - 座標：`Location` ÷100 為方塊；`px = (y − MinPos.Y) / MapDims × FancyMapSizeRatio × 圖寬`、`py = (1 − (x − MinPos.X) / MapDims × FancyMapSizeRatio) × 圖寬`。圖寬 = 每邊原圖數 × 1024：主世界 8192（8×8）、隙浮 7168（7×7）、營地 3072（3×3）。
  - 礦車站要連 `Debug` 類的傳送點一起查（約一半的站只有 `Debug` 列）；`DT_WorldExplorationTeleportPoints` 中名稱開頭為 `Test`（不分大小寫）的列略過。礦車站沒有各自的名稱，以所在區域命名。
  - 範圍外、名稱查不到、標籤對不回的點寫進報告（`map-marker-outside`、`map-missing-name`、`map-unmatched-tag`），不顯示。
  - 任務（`scripts/extract/map-quests.ts`，在任務抽取之後才加進 `map.json`）：
    - **任務地點**：取自 `DT_QuestLocationDefinition`。列名 `SW.QuestLocation.<任務 id>.<標籤>`，以最長的任務 id 前綴對回任務（`CA02.B.E03` → `CA02_B`）。主線（`quests.json` 的 `type: "core"`）是 `quest-main` 種類、黃色圖示，支線是 `quest-side`、藍色圖示，各有篩選。同一任務相距 24px 內的點併成一個。
    - **區域任務**：沒有任務地點的任務，依 `region.map`（區域中心）每個區域、每種類型各一個圖釘（兩種都有時主線在左、支線在右各偏 16px），彈窗只列該類型的任務連結；id 為 `quest-area:<areaId>:main|side`。
    - `Level` 不是 `Overworld`（洞穴、首領關）或落在各世界範圍外的點，寫進 `quest-location-off-map`；對不回已收錄任務的列寫進 `quest-location-unmatched`。
  - **關卡資料的點位**（`scripts/extract/map-spots.ts`，風暴產生器、護符寶箱、地下城）：座標只存在原始匯出的 World Partition 格（`Content/Spicewood/Maps/Overworld/Overworld/_Generated_/*.json`，約 1.4 GB），CI 讀不到，所以先用一次性腳本壓成小檔：`npx tsx scripts/map-spots/index.ts <原始匯出的 Dungeons 資料夾> [source-data]`，寫出 `source-data/MapSpots/map-spots.json`（約 8 KB，不進 git），`npm run extract` 再讀它、轉成 `map.json`。遊戲改版後重跑一次。座標單位是 cm，走同一套 `toBlocks` → `toImagePixel`。
    - **風暴產生器**（`storm`）：`SpawnVolume` 且 `SpawnDataTag = SW.SpawnDefinition.Storminator`，位置取它的 `CollisionComp`，區域取自 `SpawnIdentityTag`（`SW.SpawnIdentity.<區域>.Storminator.<N>`）。52 個位置，每處是「可能的位置」：區域進行靈魂風暴時，每個位置隨機生成一台任意階級的產生器（一場需摧毀 3 座，觀察值）。
    - **護符寶箱**（`talisman-chest`）：`TypeTag` 以 `SW.LootActor.TalismansChest.` 開頭的關卡物件，位置取根元件（`Root`）。寶箱內的護符由 `DT_LootSourceDefinition_LootActor` 同名列（唯一保證掉落的物品）對回護符條目，彈窗連到護符頁。資料沒有寶箱所在區域，故不顯示區域。
    - **地下城**（`dungeon`）：`BP_SpicewoodTeleportDoor` 且 `TeleportDoorVisualType = Dungeon` 的傳送門（61 個），位置取根元件；區域由 `Doorways` 標籤推得（`SW.Doorway.PlainsA2.Dungeon.5` → `SW.Area.Plains.A2`）。`Rift` 型的門就是既有的裂隙。大小（Small／Large）有存進檔案但地圖沒用；圖示一律用 `T_UI_Icon_Dungeon_LV1`（LV1–3 在遊戲裡是動態等級，資料裡看不出對應）。
- **未收錄**：室內區域。大多數室內場景擺在世界範圍外，入口是關卡內物件，資料表沒有座標。
- **鍵盤**：Z／X 切換到前一個／下一個世界（照遊戲 `DT_WorldMapActions`，到頭會繞回；在輸入框內或按著修飾鍵時忽略）。
- 設計與驗證紀錄：`docs/superpowers/specs/2026-10-10-world-map-design.md`。

## 更新日誌

`/<lang>/changelog/` 列出遊戲各版本的更新，由兩份資料組成：

- `src/game-updates.json`（手寫）：每個版本一筆，`version`、`date`（`YYYY-MM-DD`，由新到舊、每天一筆）、`platforms`、`source`（官方更新說明網址，[Minecraft Feedback 的 Dungeons II Changelogs](https://feedback.minecraft.net/hc/en-us/sections/49286492925453-Minecraft-Dungeons-II-Changelogs)）與 `changes`。同一版本號推出兩次時以 `build`（組建號，只用在網址錨點）區分，並必須加上 `label`（`zh`／`en`，例如「Steam Deck 更新」），頁面在版本號下方顯示這個說明而不是組建號。
  - 以自己的話寫重點摘要，不要整段複製官方原文；`kind` 為 `new`／`changed`／`fixed`。
  - 只寫繁中（`zh`）與英文（`en`）；其他語言顯示英文並標上 `lang="en"`。名稱用站內譯名（怪物、任務等）。
  - `link` 是語言後面的路徑（如 `quests/ca09`），單元測試會檢查頁面存在。
- `src/data/game-changes.json`（`npm run game-diff` 產生）：本站資料換到新版本時，與上一版比對的數值變動。比對沒有找到變動時也會記錄，頁面顯示「沒有數值變動」。

頁面依 `shared/game-version.json` 標出本站資料對應的版本，之後的版本註明「尚未更新」。

## 開發

```bash
npm install
npm run dev          # 開發伺服器（搜尋需 build 後才可用）
npm run typecheck    # 產生 Astro 型別後執行 tsc
npm test             # 單元＋整合測試
npm run test:e2e     # build 後執行 Playwright（預覽伺服器使用 port 4329）
npm run build        # 產生 dist/ 與 Pagefind 索引
```

## 字型

- Noto Serif 與 Noto Serif TC/SC/JP/KR（`@fontsource/noto-serif*`，標題）、Geist 與 Geist Mono（`@fontsource-variable/geist`、`@fontsource-variable/geist-mono`，內文與編號）皆為 SIL Open Font License 1.1。
- 授權全文隨各 npm 套件提供；網站頁尾列出使用的字型。

## 部署

`.github/workflows/ci.yml` 在每個 PR 上執行型別檢查、單元測試、build 與 Playwright；任一失敗時 PR 會顯示紅叉，e2e 失敗的截圖與 trace 上傳為 `playwright-results`。CI 不跑 `npm run extract`（沒有 `source-data/`），資料以 commit 的 `src/data/` 為準。

`.github/workflows/deploy.yml` 在推送到 `master` 時再跑一次型別檢查與單元測試，通過後建置並發布到 GitHub Pages，`BASE_PATH` 自動設為 `/<repo>/`。
若 repo 是 `<user>.github.io`，請把 `BASE_PATH` 改成 `/`。

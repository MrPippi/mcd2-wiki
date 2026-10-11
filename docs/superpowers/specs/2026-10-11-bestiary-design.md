# Minecraft Dungeons II Wiki — 怪物圖鑑與取得方式設計規格

- 日期：2026-10-11
- 狀態：設計已在對話中逐段確認，待使用者審閱本文件
- 基準：分支 `feat/bestiary`，從 `feat/achievements`（`4cd4c70`）分出，再往下疊在 `feat/multilingual`（PR #13）上。
- 使用者的選擇：
  - 怪物頁與掉落並重，物品頁另加「取得方式」（C）。
  - 入口放在漢堡選單（A）。
  - 怪物頭像：遊戲模型的 3/4 視角渲染圖（`source-data/Renders/Mobs/`）由抽取程式轉成 webp；沒有渲染圖的怪物顯示預留框，可用手動覆蓋檔補上（B，已修訂）。
  - 掉落只列來源、不給百分比，任務獎勵標「必得」（B）。
  - 只收敵對怪物（A）。
- 遵守既有規則：16 種語言、對照語言規則、「語言有問題一律退回英文並標未翻譯」（見 `2026-10-11-multilingual-design.md`）。

## 1. 目標

1. 新增怪物圖鑑：一個總覽頁加上每隻怪物一頁，16 種語言都有。
2. 物品頁新增「取得方式」，列出這件物品可以從哪些地方取得。

### 1.1 成功標準

1. 建置出 `/<lang>/mobs/` 和 `/<lang>/mobs/<slug>/`，16 種語言都有。收錄約 60 種敵對怪物：一般、小頭目、頭目，以及具名變種。
2. 怪物名稱使用遊戲官方的 16 語名稱；缺字時顯示英文並標「未翻譯」。
3. 怪物頁的內容：
   - 數值，沒有的欄位不顯示；
   - 「靈魂腐化」小節，只有遊戲有這個版本時才出現；
   - 已知出沒區域，每個區域連到地圖；
   - 掉落規則，以次數與每次機率描述。
4. 物品頁的「取得方式」列出：區域掉落池、寶箱、任務獎勵（標「必得」）、商人、附魔書池。全部不顯示百分比。
5. 漢堡選單新增「怪物圖鑑」，排在地圖、成就之後。
6. 圖片：抽取程式把對得上的渲染圖轉成 `public/mobs/<slug>.webp`（與成就圖示同一套 sharp 流程），頁面自動顯示；沒有渲染圖的怪物顯示預留框。手動覆蓋檔 `scripts/extract/mob-portrait-overrides/<slug>.webp` 存在時優先於渲染圖。頁面註明頭像為遊戲模型渲染。
7. 站內搜尋能用當前語言和英文找到怪物頁。
8. `tsc` 0 錯誤；單元、整合、E2E 全過，覆蓋率四項都 ≥ 80%。

### 1.2 非目標

- 掉落機率的百分比：多張掉落表怎麼疊加寫在遊戲程式裡，資料中沒有。
- 友善生物、同伴、動物。
- 怪物說明文字：遊戲裡只有名稱。
- 依難度或多人人數縮放後的數值：只顯示基礎值。
- 刷寶加成（Looting、DropChanceIncrease）和防止重複掉落的機制。

## 2. 遊戲資料（已盤點）

所有表都在 `source-data/DataTables/UFS/`，這個目錄只能讀。

### 2.1 怪物

**哪些表是哪種怪**
- `DT_MobType1Definition`（43 列）：一般怪。世界別寫在 trait：`SW.Mob.Default.Overworld` 是主世界，`SW.Mob.Default.Wellspring` 是隙浮。
- `DT_MobType2Definition`（7 列）：小頭目，帶 `SW.Trait.MiniBoss`。
- `DT_MobType3Definition`（18 列）：頭目，帶 `SW.Trait.Boss`。
- `DT_MobSoulStatedDefinition`（52 列）：每隻怪的「靈魂腐化」版本，TypeTag 是 `SW.Mob.<X>.SoulStated`。**不另開頁**，併進原本那隻怪的頁面。
- `DT_MobVariantDefinition`（32 列）：變種。原怪物和變種的關係記在 Type1 的 `Variants.Replacements`。
  - 有自己名字的變種（例如屍殼 Husk、流髑 Stray、沼骸 Bogged、Scorched、Mucked、Frozen、Charred、閃電苦力怕 Charged Creeper）各開一頁，原怪物頁也列出它們。
- `DT_MobDefinition`：只有抽象的基礎列，用來解析繼承的 trait。

**略過的列**
- 抽象列：`Default*`、`Monstrosity`、`Monstrosity_Storm`、`StormiMoss`。
- 名稱文字是空的列。
- 帶 `SW.Trait.CannotDropLoot` 的分身（`Shade_Clone`）只標註，不另開頁。

**名稱**
- 從 `TypeTextData.Texts["(TagName=\"SW.TextEntry.Name\")"].Text` 解析出 `LOCTABLE("<表>.csv","<鍵>")`，再到 `Localization/All/<culture>/All.json` 的 `Text/Release/<表>.csv` 找這個鍵。
- **不要用列名推導鍵**：`SlimeLarge` 的名稱是「Slime」，`ZombieFrozen` 的鍵開頭是 `Sw_`（小寫 w）。
- 名稱會重複（例如 Slime 有 4 列），所以依原怪物合併。

**數值**
- 取自 `AttributeValues[]`，只顯示白名單內的屬性：
  - `Health`
  - `MovementSpeed`
  - `Poise`、`PoiseDelay`、`PoiseRecovery`
  - `AI.SightPerceptionRadius`
  - `Mass`
  - `SoulYield`
  - `MeleeAttackSpeed`、`RangedAttackSpeed`
  - `Shield`
  - `Resistance.KnockbackResistanceMultiplier`
  - 各元素傷害的抗性倍率：`*DamageResistanceMultiplier`
- 數值一律顯示基礎值，頁面加註「基礎值」。

**標籤正規化**：比對前把 `Sw.` 統一成 `SW.`，大小寫不敏感。

### 2.2 出沒區域（「已知出沒區域」）

1. `DT_AreaDefinition`：`ConditionGroups[].DefaultDefinition.MobTypes[].MobType` 是區域常駐怪。
   - 大量近乎重複的列（`Meadow_T1_Rift_N`、`Deep_Dark_Dungeon_N`）依 `SW.Area.<Biome>.<Zone>` 前綴合併成一筆。
2. `DT_SpawnWaveDefinition`：競技場波次。
   - 列名前綴代表區域，以 `scripts/extract/spawn-area-prefixes.json` 手寫對照，約 25 筆。
   - 對不上的前綴寫進抽取報告，不靜默丟棄。
3. 區域名稱用 `AreaNameLabels.csv`，或區域列的 `TypeTextData`。區域連結指向地圖頁，能定位到該區域時附上 hash。

### 2.3 掉落

**表的結構**
- 掉落表有：`DT_LootSourceDefinition`、`_Mob`、`_Area`、`_LootActor`、`_Quest`。
- 每一列的 `LootDropDefinition.LootSlots` 裡有：
  - `NumberOfGuaranteedDrops`（必掉次數）
  - `NumberOfRandomRolls`（隨機次數）
  - `DropChancePerRoll`（每次機率）
  - `InheritParentDropTable`（是否沿用上層的物品池）
  - `DropTable.Tags[{TypeTag, Weight, Operation}]`

**怪物列決定「掉幾次」**
- 物品池通常沿用所在區域（`InheritParentDropTable: true`）。
- 頭目：必掉 1，另有 6 次、每次 50%。
- 小頭目：必掉 1，另有 4 次、每次 25%。
- 靈魂腐化：1 次、25%。
- 一般敵對怪：1 次、1.25%。
- 每個 slot（Item、Emeralds、SpringStone、EnchantedBook…）分開描述。

**怪物對應到哪一列掉落**
- 依怪物的 TypeTag，以及沿 `DT_MobDefinition` 解析出的父 trait 找對應的掉落列。
- 解析不到時寫進報告，頁面不顯示掉落規則。

**物品池與反查**
- `_Area` 列提供物品池，內容是物品的 TypeTag，或套裝標籤 `SW.Item.ArmorSet.*`。
- 套裝標籤依護甲的 trait 展開成每一件部位。
- `Operation: Multiply` 且權重為 0 的項目代表「排除」。

**各種來源**
- 寶箱（`_LootActor`）：
  - `FancyChest`、`WellspringChest` 沿用區域池；
  - `KeyChest`、`CampWoodenChest`、`TalismansChest_*` 是固定物品；
  - 靈魂風暴寶箱分等級。
- 任務獎勵（`_Quest`）：`SpecialGear` slot 明確列出物品，而且是必得。例如蘑菇套裝任務必得 4 件中的 2 件。
- 附魔書：`EnchantedBook` slot。
  - 通用書池是 `EnchantmentBooks.Common`。
  - 區域書池有 DeepDark、Meadow、Ravines 三個。
  - `EnchantmentBooksExcludeQuestBooks` 會把任務書排除。
- 商人：`VillageMerchant` 等列出的是類別標籤。類別標籤只顯示成「商人（近戰武器類）」這種說法，不展開成每件物品。

### 2.4 已知的資料問題（要寫進抽取報告）

- 標籤拼法不一致：`SW.Item.Currency.Springstone` 與 `SpringStone`。
- 任務列名有錯字：`QuestMeleeDaggerUnique_)1`。
- 有些怪物列沒有物品池，而且不沿用上層（`Maw`、`GlobalHostileMobLoot`、`WitchType3`、`StorminatorBase` 等）。這些怪物的掉落規則只描述次數。
- 遊戲裡的掉落機制還會受刷寶加成、組隊、執行時合併等影響。頁面一律加註「依遊戲資料整理，實際掉落可能受遊戲機制影響」。

### 2.5 禁止使用的資料

`DataTables/UFS/OnlineConstants.json` 含有遙測用的 API 金鑰。抽取程式**不讀取，也不發布**這個檔案。另外新增一個測試：只在測試裡讀這個檔案，確認抽取時讀取的檔案清單不含它，而且 `src/data` 裡找不到檔案中任何長度 ≥ 20 的字串值。

## 3. 架構

### 3.1 抽取（`scripts/extract/`）

依照既有的 `game-tables.ts` FILES 加上 zod 的做法。新增：

- `mob-tables.ts`：讀取並驗證 Mob 系列表、`DT_AreaDefinition`、`DT_SpawnWaveDefinition`。
- `mobs.ts`：合併原怪物，掛上靈魂腐化和變種，解析名稱和數值，產生 slug。
- `mob-areas.ts`：從區域定義和波次推算出沒區域，加上前綴對照。
- `loot-tables.ts`：讀取並驗證五張 LootSource 表。
- `loot-sources.ts`：解析怪物的掉落規則，並做「物品 → 來源」反查。反查會展開套裝，處理書池和排除項目。
- `pipeline.ts`：
  - 寫出 `src/data/mobs.json`、`src/data/loot-sources.json`；
  - 把新的問題類型（未對應標籤、未對應前綴、未解析的怪物掉落列）寫進 `extract-report.md`。

資料型別：

```ts
interface Mob {
  slug: string;
  id: string;
  kind: "regular" | "miniboss" | "boss" | "variant";
  world: "overworld" | "wellspring" | null;
  name: Localized;
  untranslated: Lang[];
  stats: { key: StatKey; value: number }[];
  soulCorrupted?: { stats: { key: StatKey; value: number }[]; drops: MobDrop[] };
  portrait?: string;         // 已發布的頭像路徑 mobs/<slug>.webp；沒有則顯示預留框
  variants: string[];        // 變種的 slug
  variantOf?: string;        // 原怪物的 slug
  areas: { areaId: string; name: Localized; map?: { world: "overworld" | "sift" | "camp"; px: number; py: number } }[];
  drops: MobDrop[];          // { slot, guaranteed, rolls, chancePerRoll, pool: "area" | "own" | "none" }
}

// 正規化：來源名稱只存一次（名稱會在每個物品重複，不正規化會超過 200KB）。
interface ItemSources {
  // 來源表，鍵為 "<kind>:<id>"，kind 為 area | chest | quest | merchant | bookPool
  sources: Record<string, { kind: SourceKind; name: Localized; untranslated: Lang[] }>;
  // 以物品頁的 category/slug 為鍵；各欄位為 sources 的 id
  items: Record<string, {
    areas: string[];
    chests: { id: string; pool: "area" | "fixed" }[];
    quests: { id: string; picks?: { count: number; of: number } }[];   // picks：任務從 of 件中給 count 件
    merchants: { id: string; category: string }[];                     // category：商品池的類別標籤
    bookPools: string[];
  }>;
}
```

`Localized` 與 16 語退回英文的規則沿用現有機制。寶箱、任務、商人名稱優先用遊戲語系檔；找不到官方名稱時，用新增的介面字串描述，並依規則退回英文。

### 3.2 網站

- **頁面**：
  - `src/pages/[lang]/mobs/index.astro`：總覽頁。依「頭目／小頭目／一般／變種」分組，用現有的 `ListFilter` 篩選。
  - `src/pages/[lang]/mobs/[slug].astro`：怪物頁。
- **新元件**：
  - `MobCard`：卡片，含圖片欄位、名稱加對照名稱、類型標章。
  - `MobStats`：數值表。
  - `MobDrops`：掉落規則。
  - `MobAreas`：出沒區域。
  - `ItemSources`：物品頁的「取得方式」，掛在現有物品頁的資訊區之後。
- **頭像**：`source-data/Renders/Mobs/` 有 79 張 256×256 透明 PNG，檔名是藍圖名去掉 `BP_`（保留遊戲的拼字，如 `Scavanger_Ranged.png`）。
  - 對應方式：**不用資料表列名**（只有 32/86 對得上），改用每列的 `CharacterReference`（`…/BP_Zombie.BP_Zombie_C`）取資產名、去掉 `BP_`。
  - 靈魂腐化列沒有自己的渲染圖，沿用原怪物的頭像；抽象列沒有。
  - 對不上任何怪物頁的渲染圖（召喚物、道具：`Evoker_FangTrap`、`Geomancer_*Pillar`、`*_Cube`、`RedStoneNode`、`MossFlower`、`Large_Moss_Flower`、`TargetDummy`）不發布，列進報告。`Geomancer_BombPillar.png` 是灰色無貼圖，同樣不發布。
  - 轉檔：用 sharp 縮成 128×128 webp（`public/mobs/<slug>.webp`）。優先順序：手動覆蓋（`scripts/extract/mob-portrait-overrides/<slug>.webp`）> 渲染圖 > 預留框。`Mob.portrait` 有值才用 `<img>`。
  - 頁面註明「頭像為遊戲模型渲染」。
- **漢堡選單**：`src/lib/site-menu.ts` 新增「怪物圖鑑」。
- **介面字串**：新增鍵要加到全部 16 個語言檔。
  - zh、en 人工撰寫；其他 14 種機器翻譯並列進 `_machine`。
  - 有疑慮的鍵改用英文並列進 `_english`。
  - 數值名稱優先用遊戲字串，在 `ui-game-keys.json` 對應。
- **搜尋**：怪物頁加 `data-pagefind-body`，內容含當前語言與對照語言的名稱。
- **client 端腳本**：不得引入 extract 端或字典模組，由既有的 client-bundle guard 測試檢查。

## 4. 錯誤處理

- 表格不符 schema：抽取失敗，並指出檔名（沿用現行做法）。
- 未對應的標籤、波次前綴、怪物掉落列：寫進報告，不中斷抽取。頁面只是少一段，不顯示錯誤的內容。
- 某語言缺怪物名稱：用英文，並記進 `untranslated`。
- slug 重複：抽取失敗（沿用現行做法）。

## 5. 測試

- **單元測試**：
  - 合併：同名的多列、靈魂腐化併入原怪物、變種的雙向連結。
  - 名稱鍵從 `TypeTextData` 解析，涵蓋 `Sw_` 小寫的例子。
  - 標籤正規化。
  - 數值白名單。
  - 區域前綴對照，以及對不上時寫進報告。
  - 掉落規則：頭目、小頭目、靈魂腐化、一般怪各一例。
  - 反查：
    - 武器在區域池；
    - 套裝標籤展開成部位；
    - 附魔書池，以及任務書被排除；
    - 任務必得；
    - 商人只顯示類別；
    - 權重 0 的 Multiply 是排除。
  - 遙測金鑰不在輸出中。
- **整合測試**：用少量假資料表跑完整抽取，檢查 `mobs.json`、`loot-sources.json` 與報告。
- **E2E**：
  - `/zh/mobs/`、`/ja/mobs/`、`/ru/mobs/` 能載入並分組；篩選能用。
  - 一個頭目頁和一個一般怪頁：數值、掉落規則、出沒區域連到地圖。
  - 物品頁的「取得方式」連到正確來源，並有「必得」標示。
  - 漢堡選單出現「怪物圖鑑」，目前頁面有標示。
  - 有渲染圖的怪物頁（Zombie）顯示 `<img>`，沒有渲染圖的怪物頁顯示預留框。
  - 站內搜尋用英文怪物名稱在 ja 頁面能找到。
  - 全站連結爬梳的起點加上 `/zh/mobs/`。

## 6. 規模

- 怪物頁約 60 頁 × 16 語，約 960 頁；`dist` 增加約 30MB 以內。
- 新增的資料檔預計 < 200KB。
- 抽取時讀取的原始資料約 6MB。

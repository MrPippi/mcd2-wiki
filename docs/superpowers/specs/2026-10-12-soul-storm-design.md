# Minecraft Dungeons II Wiki — 靈魂風暴頁設計規格

- 日期：2026-10-12
- 狀態：預設決定由 controller 選定，待使用者審閱；§4 每一項都可以推翻。
- 基準：`origin/master` `ad0c1d2`（已含多語言、成就、護符、重新設計、怪物圖鑑）。文件分支 `docs/soul-storm-plan`；實作分支 `feat/soul-storm`。
- 遵守既有規則：16 種語言、對照語言規則、「語言有問題一律退回英文並標未翻譯」（見 `2026-10-11-multilingual-design.md`）。
- 資料來源：所有「已驗證」的值都在 2026-10-12 對 `D:\Project\mcd2-wiki\source-data`（只讀）逐一核對過，見 §2。

## 1. 目標

新增一頁「靈魂風暴」（Soul Storm）。內容包括：

- 現在哪一區有風暴、還剩多久、下一場在哪裡、幾點開始；
- 遊戲資料能證明的規則、風暴產生器、獎勵寶箱；
- 連到風暴巨獸的怪物頁。

### 1.1 成功標準

1. 建置出 `/<lang>/soul-storm/`，16 種語言都有。漢堡選單在「怪物圖鑑」之後新增「靈魂風暴」，在本頁時標示為目前頁面。
2. 頁面上的時程元件在瀏覽器端計算，不需要 API：
   - 「進行中：<區域>，剩 mm:ss」或「下一場：<區域>，mm:ss 後開始」；
   - 接下來 7 個時段（一整輪）的表格，以使用者的當地時間顯示，並標出使用的時區。
3. 只要 `verified` 是 `false`，時程元件旁邊就一律顯示「推算時刻，尚未經遊戲內確認」。改成 `true` 只要改一行（§3.5）。
4. 沒有 JavaScript 時，頁面仍然顯示：
   - 一段靜態說明：每 40 分鐘一場、每場 20 分鐘，倒數需要 JavaScript；
   - 7 區輪替清單。
   這時不顯示倒數。
5. 靜態段落的內容與依據：
   - 介紹：只用官方語系文字。
   - 開放條件：有資料依據，見 §2.6。
   - 時程與輪替：每區連到地圖上的位置。
   - 風暴產生器：三種難度，只列資料裡有的數值。
   - 獎勵寶箱：分組、分等級，標出「條件未確認」，附上官方的「額外效果」文字。
   - 風暴巨獸：連到怪物圖鑑。
6. 所有遊戲名稱與說明都用官方 16 語文字。缺字時退回英文並標「未翻譯」，每個段落或群組最多一個標記，不是每列一個。
7. 站內搜尋能用當前語言與英文找到這一頁。
8. `tsc` 0 錯誤。單元、整合、E2E（chromium＋mobile）全過，覆蓋率四項都 ≥ 80%。

### 1.2 非目標（後續再做）

- 在世界地圖上標出目前的風暴區域。
- 需要用 FModel 匯出的圖示：`T_UI_SoulStorm_Level_{1,2,3}`、`T_UI_Icon_Time`、`T_UI_Icon_Storminator_Backplate`、`T_UI_Soulstorm_Header_Small`。
- 任何伺服器或 API，包括線上覆寫值的抓取。
- 掉落百分比與期望值。寶箱的「裝備」格沒有物品池，見 §2.4。
- 風暴期間每個區域怪物生成的細節（波次表）。

## 2. 遊戲資料（已逐項核對）

表格都在 `source-data/DataTables/UFS/`，語系檔在 `source-data/Localization/All/<culture>/All.json`。這些檔案只能讀。

### 2.1 時程 — `DT_SoulStormTimeSchedule.json`

| 列 | 欄位 | 值 |
|---|---|---|
| `SoulStormTime` | `TypeTag` | `OnlineDataTables.TypeSystem.DT_SoulStormTimeSchedule` |
| | `Timestamp` | `"2026.01.01-00.00.00"`（Unreal `FDateTime` 文字格式，**沒有時區**） |
| | `DurationInSeconds` | `1200`（20 分鐘） |
| | `CadenceInSeconds` | `2400`（每 40 分鐘一場） |

推論（不是資料）：
- 一天 86400 秒可以整除 2400，所以每天有 36 場。每天 UTC 00:00 一定是某一場的開始（假設錨點是 UTC）。
- 36 mod 7 = 1，所以同一個 UTC 時刻的區域每天往後挪一區。
- 一整輪是 7 × 40 分鐘，等於 4 小時 40 分。

### 2.2 輪替 — `DT_SoulStormScheduleAreaRotation.json`

只有一列：`Name "1"`，`TypeTag` 為 `OnlineDataTables.SoulStormScheduleAreaRotation`。`AreaTags` 依序如下：

| # | 標籤 | `DT_AreaDefinition` 列 | en | zh（zh-Hant） | 地圖標記（`src/data/map.json` 的 `area:<小寫標籤>`） |
|---|---|---|---|---|---|
| 0 | `SW.Area.Forest.A1` | `Forest_A1` | Howling Woods | 咆哮森林 | overworld 4241.8, 4046.3 |
| 1 | `SW.Area.Meadow.A1` | `Meadow_A1` | Singer's Meadow | 吟唱者草甸 | sift 634.3, 5473.3 |
| 2 | `SW.Area.Plains.A2` | `PlainsA2` | Rainy Plains | 多雨平原 | overworld 4793.3, 6694.9 |
| 3 | `SW.Area.Carapace.A1` | `CarapaceA1` | Humbler Huskland | 轟鳴蟲殼骸之地 | sift 3316.9, 5462.7 |
| 4 | `SW.Area.Meadow.A2` | `Meadow_A2` | Lullaby Hills | 安眠丘陵 | sift 5506.5, 5795.9 |
| 5 | `SW.Area.Desert.A1` | `Desert_A1` | Frozen Highlands | 冰封高地 | overworld 6611.2, 4173.1 |
| 6 | `SW.Area.Plains.A1` | `Plains_A1` | Honeycomb Fields | 蜂巢原野 | overworld 2805.8, 3954 |

- 名稱鍵都是 `DT_AreaDefinition.csv` 的 `SW_Area_<…>_SW_TextEntry_Name`。抽查 ja、ru、de、uk、tr 都有值。
- 名稱用既有的 `buildAreaNamer`（`scripts/extract/mob-areas.ts`），地圖位置用 `areaMarkers`。
- 7 區都有地圖標記。草甸、蟲殼骸之地在隙浮（`sift`）世界，其餘在主世界。

### 2.3 風暴產生器 — `DT_SoulStormPropActorDefinition.json`

**基礎列與護盾產生器**

- `Storminator`（`SW.PropActor.SoulStorm.Storminator.Base`）
  - 生命 `800`。
  - 抗性：`SoulDamageResistanceMultiplier 0.5`、`MeleeDamageResistanceMultiplier 0.8`、`Resistance.KnockbackResistanceMultiplier 0`。
  - 名稱鍵 `DT_SoulStormPropActorDefinition.csv` / `SW_PropActor_SoulStorm_Storminator_Base_SW_TextEntry_Name`：en「Storm Generator」，zh「風暴產生器」，16 語都有。
  - 說明鍵的英文是「Nearly as cool as Kira.」，是開發者玩笑，**不顯示**。
- `Shieldinator`（`SW.PropActor.SoulStorm.Barrier`）
  - 生命 `55`。
  - 沒有名稱文字。唯一提到它的官方文字是提示句 `…Soulstorm_Shieldinator_Hint`：「This is a Shield Generator…」。

**三種難度**

| 列 | 標籤 | 生命 | 最終召喚門檻（`Health.FinalThreshold`） | 最終召喚（`WaveArray[].SpawnDefinition`） | 護盾產生器（`SpawnShield` 的 `ActivationChance`、`CooldownDuration`） | 內部生成計時器（`GA_ActivateAbilityOnTimer` 的 `TimerDuration`） |
|---|---|---|---|---|---|---|
| `Storminator_Easy` | `…Storminator.Easy` | 沿用基礎 800（本列沒有 `AttributeValues`） | 0.2 | `Storminator.Wave.SoulstatedUndead` → `SW.Mob.Zombie.SoulStated`、`SW.Mob.Vindicator.SoulStated` | 沿用基礎 0%、0 秒（不會召喚） | 沿用基礎 60 秒 |
| `Storminator_Medium` | `…Storminator.Medium` | 1000 | 0.4 | `Storminator.Wave.Type2` → 以下 6 選 1：`Witch`、`Enderman`、`Warden`、`Evoker`、`WellspringMiniboss`、`Driftweaver` | 16%，60 秒 | 45 秒 |
| `Storminator_Hard` | `…Storminator.Hard` | 1200 | 0.4 | `Storminator.Wave.Type3` → 以下 3 選 1：`Monstrosity.Copper.Storm`、`RedStone.Storm`、`Sculk.Storm` | 40%，45 秒 | 30 秒 |

**其他已驗證的值**

- 三種難度都有 `MultiplayerScalingDefinitions`：`HealthMax` 乘數依玩家人數 1–4 分別是 `[1, 1.5, 2, 2.5]`。
- 出現權重來自 `DT_SpawnDefinition` 列 `StorminatorEasy`（`SW.SpawnDefinition.Storminator`）：
  - 條件是 `SWGC_CheckSoulStormInArea`；
  - 權重 Easy `2`、Medium `2`、Hard `1`。
- 怪物在圖鑑中的 slug（`src/data/mobs.json`）：
  - Easy 的召喚：`zombie`、`vindicator`，兩者都有靈魂腐化小節。
  - Medium 的召喚：`witch`、`enderman`、`warden`、`evoker`、`wellspring-miniboss`（Dartback）、`driftweaver`（Harmonizer）。
- 每場要摧毀幾座產生器（`Destroy {0} Storm Generators`）是執行期參數，**資料裡沒有**。

### 2.4 獎勵寶箱 — `DT_LootSourceDefinition_LootActor.json`

每個 slot 的寫法是「必掉＋次數 × 每次機率」。

**風暴產生器寶箱**：父標籤 `SW.LootActor.StorminatorChest`，`DT_LootActorDefinition` 列 `StorminatorChest`，模型是 `BP_FancySoulChest`。

| 列 | 標籤 | 裝備（Item） | 回聲碎片（SpringStone） | 綠寶石（Emeralds） |
|---|---|---|---|---|
| `StorminatorChestEasy` | `…StorminatorChest.Easy` | 1 | 1 + 2 × 33% | 5 + 10 × 30% |
| `StorminatorChestMedium` | `…StorminatorChest.Medium` | 1 | 1 + 2 × 33% | 5 + 10 × 30% |
| `StorminatorChestHard` | `…StorminatorChest.Hard` | 2 | 1 + 3 × 33% | 5 + 15 × 30% |

**風暴獎勵寶箱**：父標籤 `SW.LootActor.StorminatorChest.Final`，`DT_LootActorDefinition` 列 `StorminatorChestFinal`，模型是 `BP_SoulChest`。

| 列 | 標籤 | 裝備 | 回聲碎片 | 綠寶石 |
|---|---|---|---|---|
| `SoulStormRewardChestLow` | `…Final.Low` | 2 | 1 + 3 × 33% | 5 + 15 × 30% |
| `SoulStormRewardChestMedium` | `…Final.Medium` | 3 | 1 + 3 × 33% | 5 + 15 × 30% |
| `SoulStormRewardChestHigh` | `…Final.High` | 4 | 4 + 3 × 33% | 10 + 15 × 30% |

**這些數字能說明什麼**
- **裝備格**：所有寶箱的 Item slot 都是 `InheritParentDropTable: false`，而且 `DropTable: {}`（沒有物品池）。資料只能證明「必定給 N 件裝備」，不能證明給哪些物品。這和怪物圖鑑的發現一致。頁面寫「N 件裝備」，並註明「遊戲資料沒有列出這些裝備從哪裡抽出」。
- **回聲碎片**：池是 `SW.Item.Currency.Springstone`（小寫 s，與貨幣列 `SpringStone` 拼法不同，屬已知問題）。名稱用 `OnboardingLabels.csv` / `tutoriallog_springstones_title`（Echo Shards／回聲碎片），網站已有 `lootSlotSpringStone`。
- **綠寶石**：池是 `Emerald` 與 `EmeraldBlock`，權重各 1。名稱用網站已有的 `lootSlotEmeralds`。
- **寶箱與難度的對應不在資料裡**：
  - 基礎產生器的 `ApplyDeathEffects` 寫死 `TagToSpawn: SW.LootActor.StorminatorChest.Easy`。
  - Medium、Hard 只寫了「覆寫了 `GA_SpawnTypeSystemActorsData`」，匯出檔沒有覆寫後的值。
  - Final Low／Medium／High 的觸發條件也不在資料裡。
- **稀有度修正**：`DT_RarityChanceDefinition` 列 `StorminatorRewardChest`（標籤 `SW.LootActor.StorminatorChest`）寫著 `SW.Rarity.Common` Multiply `0`、`SW.Rarity.Rare` Multiply `0.01`。這是否也套用到子標籤，資料沒有寫。
- **額外效果**：
  - `DT_LootActorDefinition` 的 `StorminatorChest` 開箱時加上情境標籤 `SW.Item.Property.StorminatorReward`。
  - `DT_RarityDefinition` 的 Rare、Special、Unique 都有 `AdditionalEffectChances[StorminatorReward] = 1`。這個 1 是機率還是次數，資料沒有說明。
  - 官方文字 `LootItemPanelLabels.csv` / `SoulStormMessage`：「In Soul Storms, items have a chance to drop with an extra effect!」，zh「在靈魂風暴中，物品掉落時有機率附帶額外效果！」，16 語都有。頁面只引用這句官方文字。
- **風暴中召喚的怪物**：`DT_LootSourceDefinition` 列 `StorminatorSpawned`（標籤 `SW.SoulStorm.StorminatorSpawned`）的 Item slot 是 0/0/0，`InheritParentDropTable: true`，`SW.Item.Property.Gear` Multiply `0`。這個標籤套用到誰，資料沒有寫，所以**不上頁面**，只記在這裡。
- `DT_LootSourceDefinition_Mob` 列 `StorminatorBase`：產生器本身的 Item 與 SpringStone 都是 0/0，沒有物品池。

### 2.5 區域修改 — `DT_AreaModificationDefinition.json`

列 `SoulStorm`（`SW.AreaModification.SoulStorm`）：
- `AreaThreatOverride 1`
- `RecommendedThreatOffset 0`
- `MobBudgetMultiplier 1`

這些值的意義（威脅等級是否被固定為 1）資料沒有說明，**不上頁面**。

### 2.6 開放條件（有資料依據）

- `DT_GameBalanceDefinition` 列 `SecondPass`（`SW.GameplayRuleSet.SecondPass`）：`SoulStormConstants.SoulStormEligibilityGamestate = SW.GameState.MainQuestComplete`，`SoulStormEndSpawnVolumeCooldownSeconds 30`。
- 列 `Active`（`SW.GameplayRuleSet.Active`）的同一欄是 `None`，但它的 trait 是 `SW.GameplayRuleSet.SecondPass`。
- 官方文字 `OnboardingLabels.csv`：
  - `panel_endgame_overview_ description`（鍵名中間有空格）：「Congratulations on beating the game! Here's what you can do now:」；
  - 同一個面板（`DT_OnboardingPanel` 列 `SW.UI.Onboarding.Panel.Endgame.Overview`）介紹靈魂風暴，並解鎖教學 `SW.UI.TutorialLog.Gameplay.SoulStorm`。
- 語系檔沒有任何一句直接寫「完成主線後解鎖靈魂風暴」。
- 結論：可以寫「完成主線故事後開放」，依據是 `MainQuestComplete`。哪個規則集在線上生效仍未確認，見 §3 U4。

### 2.7 官方語系文字（16 語都有，核對過 zh-Hant、zh-Hans、en、ja-JP、ko-KR、de-DE、fr-FR、es-ES、it-IT、pt-BR、ru-RU、pl-PL、nl-NL、sv-SE、tr-TR、uk-UA）

| 用途 | 命名空間 / 鍵 | en |
|---|---|---|
| 頁面標題 | `OnboardingLabels.csv` / `tutoriallog_soulstorms_title` | Soul Storms |
| 介紹第 1 段 | `OnboardingLabels.csv` / `panel_soulstorm_overview_description_1` | The Illager High Council is activating powerful generators … destroy the `<emphasis>`Storm Generators`</>` … |
| 介紹第 2 段 | `OnboardingLabels.csv` / `panel_soulstorm_overview_description_2` | You can find the location of the ongoing Soul Storm on your map. |
| 玩法 | `OnboardingLabels.csv` / `tutoriallog_soulstorms_description` **只取第 1 段** | Soul Storms are high paced combat areas … you will be generously rewarded. |
| 目標 | `DT_UITypeDataDefinition.csv` / `SW_AreaModification_SoulStorm_SW_TextEntry_Soulstorm_Entered_Description` | Destroy {0} Storm Generators to quell the Soul Storm before time runs out! |
| 產生器提示 | 同上命名空間 / `…_Soulstorm_Storminator_Hint` | This is a Storm Generator. When it is not shielded by a Shield Generator, it is vulnerable. … |
| 護盾提示 | 同上命名空間 / `…_Soulstorm_Shieldinator_Hint` | This is a Shield Generator. It protects Storm Generators. … |
| 額外效果 | `LootItemPanelLabels.csv` / `SoulStormMessage` | In Soul Storms, items have a chance to drop with an extra effect! |
| 產生器名稱 | `DT_SoulStormPropActorDefinition.csv` / `SW_PropActor_SoulStorm_Storminator_Base_SW_TextEntry_Name` | Storm Generator |

- `tutoriallog_soulstorms_description` 在 16 語都是兩段。第 2 段（「每小時隨機出現、持續約 40 分鐘」）**過時**：它和時程表不符，也和固定輪替的「隨機」說法矛盾。**不使用**。抽取時以空行切段，只取第 1 段；任何語言切不出 2 段 → 該語言退回英文第 1 段，並記入 `untranslated`。
- `SW_AreaModification_SoulStorm_*` 這組鍵在 `DT_UITypeDataDefinition.csv`（列 `SoulStormTexts`），**不在** AreaModification 表的 csv。
- `SW_SoulStorm_Active` 的 fr-FR 與英文相同（「Active」）。本頁不用這個鍵。
- 含 `{0}` 的句子：`{0}` 由 `renderMarkup` 轉成既有的佔位標籤樣式（`placeholderLabel`），和物品頁的作法一樣。

### 2.8 圖示（在 source-data 裡，可直接用）

- `Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/WorldMap/Icons/T_UI_Icon_Storminator.png`（64×64）：風暴產生器圖示。
- `Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/Minimap/Icons/T_UI_Icon_Storminator.png`（64×64）：小地圖版本。注意路徑是 `Texture/Minimap/Icons/`，不是 `WorldMap/Icons/Minimap/`。本頁不用。
- `Plugins/SpicewoodUI/Content/Spicewood/UI/Widget/SoulStorm/T_UI_soulstorm_icon_tmp.png`（152×156）：遊戲教學日誌的靈魂風暴圖示（`DT_TutorialLog`）。

### 2.9 風暴巨獸

- `DT_MobType3Definition` 的 `StormiCopper`、`StormiRedstone`、`StormiSculk` 的英文名稱與一般巨獸相同，例如 `SW_Mob_Monstrosity_Copper_Storm_SW_TextEntry_Name` 是「Copper Monstrosity」。怪物圖鑑已把它們併入 `monstrosity-copper`、`monstrosity-red-stone`、`monstrosity-sculk`。
- `StormiMoss` 沒有名稱，也沒有任何風暴表會召喚它，所以**不連** `monstrosity-moss`。
- 連結清單由抽取程式產生：用 Hard 的最終召喚標籤，查怪物圖鑑的 tag 索引。不手寫。

### 2.10 禁止使用的資料

`DataTables/UFS/OnlineConstants.json` 含遙測 API 金鑰。抽取程式**不讀取、不發布**。所有表一律經 `readDataTable`（它會拒絕這個檔名），既有的 `telemetry-key` 測試涵蓋新輸出 `soul-storm.json`。

## 3. 未驗證，需要在遊戲內確認

頁面以 `verified: false` 表示以下各點仍是假設。

| # | 假設 | 為什麼不確定 | 錯了會怎樣 | 怎麼修 |
|---|---|---|---|---|
| U1 | 錨點 `2026.01.01-00.00.00` 是 **UTC** | `FDateTime` 文字沒有時區 | 所有時刻整體偏移 | 改 `scripts/extract/soul-storm-status.json` 的 `anchorOffsetMinutes`（例如錨點其實是 UTC+8 就填 `480`），再跑 `npm run extract` |
| U2 | 區域 = `(floor((now − anchor) / cadence) + rotationOffset) mod 7`，`rotationOffset` 預設 `0` | 輪替規則寫在遊戲程式裡，資料只有清單 | 時刻對、區域錯 | 改同一檔的 `rotationOffset`（0–6） |
| U3 | 線上值與匯出檔相同 | 兩張表的 TypeTag 都是 `OnlineDataTables.*`，伺服器可以覆寫 | 時刻、長度或輪替與遊戲不同 | 重新匯出資料後跑 `npm run extract` |

**資料缺口**：頁面標「條件未確認」或不顯示，不需要使用者做任何事。
- U4：線上生效的是 `Active` 還是 `SecondPass` 規則集（影響開放條件）。
- U5：每種產生器開出哪種寶箱；Final Low／Medium／High 的條件。
- U6：寶箱裝備的物品池，以及稀有度修正是否套用到子標籤。

## 4. 設計決定（預設，可推翻）

| # | 決定 | 預設 | 推翻時要改的地方 |
|---|---|---|---|
| D1 | 頁面與入口 | 每種語言一頁 `/<lang>/soul-storm/`；漢堡選單排在「怪物圖鑑」之後；specimen 風格，只用既有元件與重新設計後的 tokens | `SITE_MENU`、頁面路徑 |
| D2 | 即時時程元件 | 在瀏覽器端計算，每秒更新；顯示「進行中／下一場」、區域、倒數，以及接下來 7 個時段（當地時間，並標出 IANA 時區名）；沒有 API | `SoulStormClock.astro` |
| D3 | 未確認標示 | `verified: false` 時，元件旁一律顯示「推算時刻，尚未經遊戲內確認」 | `soul-storm-status.json` |
| D4 | 「已確認」開關 | 唯一的真實來源是 `scripts/extract/soul-storm-status.json`：`{ "verified": false, "anchorOffsetMinutes": 0, "rotationOffset": 0 }`。抽取時抄進 `src/data/soul-storm.json`；有測試確保兩者一致 | — |
| D5 | 沒有 JavaScript 時 | 顯示靜態說明與輪替清單，不顯示倒數；元件以 `hidden` 起始，script 執行後才顯示 | — |
| D6 | 介紹文字 | 只用官方文字：overview 第 1、2 段，加上 tutorial 第 1 段；過時的第 2 段不用 | `soul-storm-texts.ts` |
| D7 | 開放條件 | **顯示**「完成主線故事後開放」，以新增的介面字串呈現（依據見 §2.6） | 拿掉 `unlock` 段 |
| D8 | 產生器 | 三種難度一張表：生命、多人生命乘數、出現權重（2:2:1）、護盾產生器機率與冷卻、最終召喚門檻與召喚的怪物（連到圖鑑）；附官方提示句。抗性只列基礎列的三項，並註明三種難度相同 | `SoulStormGenerators.astro` |
| D9 | 寶箱 | 兩組（產生器寶箱 Easy／Medium／Hard；獎勵寶箱 Low／Medium／High）× 三個 slot。每組標題旁一個「條件未確認」。裝備格註明沒有物品池。最後附官方 `SoulStormMessage` | `SoulStormChests.astro` |
| D10 | 稀有度修正 | **顯示**一句：「依遊戲資料，風暴寶箱的品質權重：一般 ×0、稀有 ×0.01」，放在寶箱段的「條件未確認」群組內 | 拿掉該句與 `chestRarity` |
| D11 | 不上頁面的資料 | `StorminatorSpawned`、AreaModification 數值、產生器說明的玩笑文字 | — |
| D12 | 風暴巨獸 | 由資料產生的連結：`monstrosity-copper`、`monstrosity-red-stone`、`monstrosity-sculk`，卡片沿用 `MobCard` | `monstrosities` |
| D13 | 圖示 | 頁首用 `T_UI_soulstorm_icon_tmp.png`，產生器段用 `T_UI_Icon_Storminator.png`（WorldMap 版），經 `planAssets` 複製到 `public/icons/soul-storm/` | `SOUL_STORM_ICON_SOURCES` |
| D14 | 語言規則 | 官方文字優先。新介面字串 zh、en 人工撰寫；其他 14 種機器翻譯，列進 `_machine`；有疑慮的列進 `_english` 與 `ENGLISH_FALLBACK`。每段、每群組最多一個「未翻譯」標記 | — |
| D15 | 時間格式 | `Intl.DateTimeFormat(<html lang>, { weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23" })`；倒數用 `m:ss`（滿 1 小時用 `h:mm:ss`），秒數無條件進位 | `soul-storm-schedule.ts` |
| D16 | 範圍外 | 地圖標出目前區域、需要 FModel 的圖示、伺服器或 API | — |

## 5. 架構

### 5.1 抽取（`scripts/extract/`）

依照 `bestiary.ts` 的做法：zod 驗證表格，報告問題但不中斷抽取。新增：

- `soul-storm-tables.ts`：
  - 用 zod 驗證所需的表：`DT_SoulStormTimeSchedule`、`DT_SoulStormScheduleAreaRotation`、`DT_SoulStormPropActorDefinition`、`DT_SpawnDefinition`、`DT_LootSourceDefinition_LootActor`、`DT_RarityChanceDefinition`、`DT_GameBalanceDefinition`。
  - 一律經 `readDataTable`，讀取清單透過 `onRead` 回報。
  - 只描述用得到的欄位，其他欄位用 `z.looseObject` 放過。
- `soul-storm-schema.ts`：輸出型別與 zod（見 §5.2）。
- `soul-storm-status.json`：手動維護的開關（D4）。
- `soul-storm-schedule-data.ts`：
  - `parseUeTimestamp("2026.01.01-00.00.00", offsetMinutes)` 轉成 ISO UTC 字串，格式錯誤時丟 `ExtractError`；
  - 產生時程與輪替（名稱、地圖位置、未翻譯語言）。
- `soul-storm-texts.ts`：官方文字。用 `localize` 加 `renderMarkup`；tutorial 只取第 1 段；名稱與說明的未翻譯語言分開記錄。
- `soul-storm-combat.ts`：產生器（含 Base 的繼承）、最終召喚 → 怪物 slug、寶箱 slot、稀有度修正、開放條件。
- `soul-storm.ts`：串接以上模組，傳入 `extractBestiary` 的 `links`（tag 索引、區域列），回傳 `{ data, issues, tablesRead }`。
- 既有檔案的修改：
  - `bestiary.ts`：`BestiaryResult` 增加 `links: { tagIndex; areas }`，不序列化，避免第二次讀取 `DT_AreaDefinition`。
  - `pipeline.ts`：寫出 `soul-storm.json`，把 `tablesRead` 合併進摘要。
  - `issues.ts`：新增問題類型 `missing-soul-storm-tables`、`soul-storm-area-unnamed`、`soul-storm-mob-unlinked`、`soul-storm-text-fallback`。

### 5.2 `src/data/soul-storm.json`

```ts
interface SoulStormData {
  verified: boolean;
  schedule: {
    anchorRaw: string;              // "2026.01.01-00.00.00"
    anchorUtc: string;              // "2026-01-01T00:00:00.000Z"（已套用 anchorOffsetMinutes）
    anchorOffsetMinutes: number;    // 0
    durationSeconds: number;        // 1200
    cadenceSeconds: number;         // 2400
    rotationOffset: number;         // 0
  };
  rotation: { areaId: string; name: Localized; map?: { world: "overworld" | "sift" | "camp"; px: number; py: number } }[]; // 7 筆，順序同表
  rotationUntranslated: Lang[];     // 任一區名退回英文的語言（整組一個標記）
  texts: Record<"title" | "overview1" | "overview2" | "tutorial" | "objective" | "generatorHint" | "shieldHint" | "extraEffect" | "generatorName",
                { html: Localized; untranslated: Lang[] }>;
  unlock: { gameState: string } | null;   // "SW.GameState.MainQuestComplete"
  generators: {
    tier: "easy" | "medium" | "hard";
    health: number;                 // 800 / 1000 / 1200
    healthByPlayers: number[];      // [1, 1.5, 2, 2.5]
    spawnWeight: number;            // 2 / 2 / 1
    shield: { chance: number; cooldownSeconds: number } | null;  // null / {0.16,60} / {0.4,45}
    finalSummon: { healthFraction: number; mobs: string[] };     // 0.2 [zombie, vindicator] / 0.4 [6 隻] / 0.4 [3 隻]
  }[];
  resistances: { key: "resistSoul" | "resistMelee" | "knockbackResistance"; value: number }[]; // 基礎列
  shieldHealth: number | null;      // 55
  chests: { id: string; group: "generator" | "final"; tier: "easy" | "medium" | "hard" | "low" | "high";
            slots: MobDrop[] }[];          // 沿用 mob-schema 的 MobDropSchema；裝備格 pool:"none"，回聲碎片與綠寶石 pool:"own"
  chestRarity: { common: number; rare: number } | null;   // { common: 0, rare: 0.01 }
  monstrosities: string[];          // ["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"]
  icons: { header?: string; generator?: string };  // "icons/soul-storm/header.png"、"icons/soul-storm/generator.png"；檔案不存在時省略
}
```

圖示必須在 `pipeline.ts` 呼叫 `copyIcons`（它會清空 `public/icons`）**之前**用 `planAssets` 規劃，並把 copies 併進同一次 `copyIcons`。`extractSoulStorm` 只接收已規劃好的 `paths`。

介面字串盡量沿用既有的鍵：
- 寶箱 slot 的文字沿用 `mobDropGuaranteed`、`mobDropRolls`、`mobDropPoolNone`、`lootSlot*`；
- 抗性沿用 `statResistSoul`、`statResistMelee`、`statKnockbackResistance`；
- 資料註記沿用 `mobDropsNote`。

`medium` 這個 tier 兩組共用。網站依 `group` 決定標籤要寫「中等」還是「中」。

### 5.3 網站

- **頁面**：`src/pages/[lang]/soul-storm.astro`，每種語言一頁。
  - 結構：頁首（官方標題、對照語言標題、圖示） → 介紹 → 時程元件 → 時程與輪替 → 開放條件 → 產生器 → 寶箱 → 風暴巨獸 → 資料註記。
  - 內容區加 `data-pagefind-body`。
- **伺服器端 lib**：`src/lib/soul-storm.ts`。
  - zod `parse` `soul-storm.json`。
  - 提供格式化函式：機率用 `formatChance`，倒數表格的資料由伺服器端產生。
  - `rotationLinks(lang)` 沿用 `mapLinkOf`。
- **client 端純函式**：`src/lib/soul-storm-schedule.ts`。
  - **不得**引入 zod、`ui-strings`、`ui-dicts`、`src/i18n/*.json`、`ui-game-strings.json`，也不得引入任何 extract 模組的執行期程式碼。
  - 內容：`windowAt`、`stormState`、`upcomingWindows`、`formatCountdown`、`formatWindowTime`、`parseSchedulePayload`（手寫型別守衛）。
- **元件**：
  - `SoulStormClock.astro`：
    - 伺服器端輸出 `<script type="application/json" data-soul-storm-json>`，內含 `{ anchorMs, durationMs, cadenceMs, areaCount, rotationOffset, areas: [{ name, href }], labels: {...} }`，所有字串都是當前語言；
    - bundled `<script>` 只引入 `../lib/soul-storm-schedule`；
    - 每秒更新一次文字，表格只在跨越時段邊界時重算；
    - 用 `aria-live="polite"` 只播報狀態變化，不播報每秒的倒數。
  - `SoulStormRotation.astro`：輪替清單，連到地圖；沒有 JS 時也顯示。
  - `SoulStormGenerators.astro`、`SoulStormChests.astro`：表格。
  - 風暴巨獸區沿用 `MobCard`。
- **選單**：`SITE_MENU` 新增 `{ key: "soulStorm", segment: "soul-storm" }`。
- **介面字串**：
  - `soulStorm` 對應遊戲字串（`ui-game-keys.json` → `tutoriallog_soulstorms_title`），所以 14 種語言不必機器翻譯。
  - 其餘新鍵見計畫 Task 5。
- **樣式**：`src/styles/soul-storm.css`，只用 `tokens.css` 的變數。手機寬度單欄、表格可水平捲動（容器內捲動，頁面不得橫向溢出），長語言加 `overflow-wrap:anywhere`。

### 5.4 Client bundle 防線

`tests/unit/site/client-bundle.test.ts` 會自動掃到 `SoulStormClock.astro` 的 script。另外加一個斷言：`src/lib/soul-storm-schedule.ts` 的執行期引入是空的，一個 import 都沒有。

### 5.5 遙測金鑰規則

- 新程式不得出現 `OnlineConstants` 字樣（`table-reader.ts` 的禁止清單與 `telemetry-key` 測試除外）。
- `telemetry-key` 測試對 `src/data` 的掃描會自動涵蓋新的 JSON。
- 整合測試斷言 `tablesRead` 不含它。

## 6. 錯誤處理

- 時程表或輪替表不存在：
  - 抽取報告記 `missing-soul-storm-tables`；
  - 輸出空的 `soul-storm.json`（`rotation: []`、`generators: []`…），schema 允許；
  - 頁面只顯示官方介紹與「目前沒有時程資料」。
  - 建置不失敗，和怪物圖鑑缺表時的作法一致。
- 表格不符 schema：抽取失敗，訊息指出檔名（沿用 `formatZodError`）。
- `Timestamp` 格式不對：抽取失敗，因為時程錯了比沒有更糟。
- 區域名稱找不到：記 `soul-storm-area-unnamed`，以標籤末段當英文名，全部 16 語都記入未翻譯。
- 最終召喚的怪物標籤對不到圖鑑：記 `soul-storm-mob-unlinked`，不顯示該怪物，不顯示錯誤連結。
- 官方文字缺某語言：退回英文，並記入該段的 `untranslated`。
- 瀏覽器端：`parseSchedulePayload` 失敗或 `areaCount` 是 0 → 元件維持 `hidden`，只留下靜態說明，並 `console.error` 一次，不丟例外。

## 7. 測試

- **單元（extract）**：
  - 表格 schema：真實形狀的假資料可以通過，缺欄位時失敗並帶檔名。
  - `parseUeTimestamp`：
    - `"2026.01.01-00.00.00"` → `2026-01-01T00:00:00.000Z`；
    - offset 480 → `2025-12-31T16:00:00.000Z`；
    - 格式錯誤 → 丟例外。
  - 輪替：保持表格順序；名稱與地圖位置；缺名稱時記問題並退回英文。
  - 官方文字：tutorial 只取第 1 段；切段失敗時退回英文並記入未翻譯；`<emphasis>` 轉成 `<em class="emphasis">`。
  - 產生器：
    - Easy 沿用基礎的生命 800；
    - Medium、Hard 使用自己的生命；
    - 護盾：Easy `null`，Medium `{0.16,60}`，Hard `{0.4,45}`；
    - 出現權重 2/2/1；
    - 最終召喚：門檻，以及解析成 slug（巢狀 SpawnDefinition，例如 Type3 → 三個巨獸子定義 → 怪物標籤）；
    - 對不到的標籤記問題。
  - 寶箱：6 列的 slot 數字與 pool；裝備格是 `"none"`；稀有度修正。
  - 開放條件：有 `MainQuestComplete` → `unlock`；沒有 → `null`。
  - status 檔與輸出一致；`verified` 只接受布林值。
- **單元（site）**：
  - `soul-storm-schedule.ts` 用固定時鐘測試，值取自真資料：錨點、時段邊界、7 區繞回、錨點之前、2026-10-11 實際時刻、`rotationOffset`、時區（Asia/Taipei、America/New_York，含 2026-11-01 夏令時間結束）。詳見計畫 Task 4。
  - 該模組沒有任何引入。
  - 選單包含新項目且順序正確。
  - 介面字串的翻譯規則（既有測試會自動涵蓋新鍵）。
- **元件（Astro container）**：
  - 頁面在 `verified:false` 時有未確認標記，`verified:true` 時沒有；
  - 輪替清單有 7 個地圖連結；
  - 每個寶箱群組最多一個「未翻譯」；
  - 裝備格的物品池註記；
  - 沒有開放條件時不顯示該段。
- **整合**：用假資料表跑 `runExtract`，檢查 `soul-storm.json`、報告的新問題類型，以及 `tablesRead` 不含 `OnlineConstants`。
- **E2E**（`tests/e2e/soul-storm.spec.ts`，用 `page.clock` 固定時間）：
  - 固定在 `2026-10-11T00:00:00Z` → 「進行中」、區域是 Humbler Huskland（en），倒數 `20:00`；前進 1 秒 → `19:59`。
  - 固定在 `00:25Z` → 「下一場」Lullaby Hills，`15:00` 後開始。
  - 以 `timezoneId: "Asia/Taipei"` 開新 context → 表格第一列是 08:00；並且頁面標出這個時區名。
  - 未確認標記可見。
  - `javaScriptEnabled: false` → 沒有倒數，有靜態說明與 7 個區域連結。
  - 地圖連結會開到 `?world=sift#4/…`（Humbler Huskland）。
  - 選單順序：`["地圖", "成就", "怪物圖鑑", "靈魂風暴"]`；在本頁時有 `aria-current`。
  - 風暴巨獸連到 `/en/mobs/monstrosity-copper/`。
  - `/de/soul-storm/` 在手機寬度下沒有橫向溢出。
  - 搜尋：在 ja 頁面用「Soul Storms」能找到 `/ja/soul-storm/`。
  - 全站連結爬梳的起點加上 `/zh/soul-storm/`。

## 8. 規模

- 16 頁 HTML，每頁約 30–60 KB。
- `src/data/soul-storm.json` 預估 < 25 KB，上限 50 KB。
- `public/icons/soul-storm/` 兩張 PNG，< 20 KB。
- `dist` 增加 < 2 MB。
- 抽取時多讀約 1 MB 的資料表：`DT_SoulStormPropActorDefinition` 97 KB，加上 SpawnDefinition、LootActor、RarityChance、GameBalance。

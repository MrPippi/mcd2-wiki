# 靈魂風暴頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 16 語言的「靈魂風暴」頁 `/<lang>/soul-storm/`。頁面有瀏覽器端的即時時程（進行中／下一場、倒數、接下來 7 場的當地時間），以及只取自遊戲資料的規則、風暴產生器、獎勵寶箱與風暴巨獸連結。所有資料由 `npm run extract` 從 `source-data` 抽出。

**Architecture:**
- 抽取端：
  - 先用 zod 驗證新資料表，並建立手動維護的狀態檔（Task 1）；
  - 再產生時程、輪替與官方文字（Task 2）；
  - 然後產生產生器、寶箱、開放條件，並由 `soul-storm.ts` 串進 `pipeline.ts`，寫出 `src/data/soul-storm.json`（Task 3）。
- 網站端：
  - 時程計算是不引入任何模組的純函式，用固定時鐘做決定性測試（Task 4）；
  - 接著補 16 語言字串（Task 5），再做頁面、元件、client 元件與選單（Task 6）；
  - 最後是 E2E、全面驗證、最終審查與 PR（Task 7）。

**Tech Stack:** Astro 7、TypeScript、zod 4、Vitest 5、Playwright 1.64、Pagefind 1.5、sharp 0.35（本功能不需要 sharp）。

**Spec:** `docs/superpowers/specs/2026-10-12-soul-storm-design.md`。資料值都在 spec §2 核對過；本計畫測試用的數字都取自那裡。

## Global Constraints

- **工作位置**：
  - worktree `D:\Project\mcd2-wiki\.claude\worktrees\soul-storm-impl`，分支 `feat/soul-storm`，從 `origin/master` 建立。執行 prompt 會說明怎麼建。
  - `source-data` 是指向主 checkout 的 junction（建法和 `D:\Project\mcd2-wiki\.claude\worktrees\multilingual\source-data` 一樣，Task 1 Step 0 有指令），**只能讀**：不寫入、不刪除、不移動 `source-data/**`。
  - 在 worktree 根目錄跑 `npm ci` 與 `npx astro sync`。不要接到主 checkout 的 `node_modules`。
- **語言**：
  - 16 種語言 `zh, zh-hans, en, ja, ko, de, fr, es, it, pt, ru, pl, nl, sv, tr, uk`（`ALL_LANGS`，來自 `scripts/extract/langs.ts`）。
  - 對照規則：`compareLang("en")="zh"`，其他語言是 `"en"`。
  - **任何語言問題一律退回英文並標「未翻譯」**：
    - 官方文字缺某語言 → 用英文，該語言記入 `untranslated`；
    - 區域名稱缺字 → 同上，整個輪替清單只標一個；
    - 介面字串有疑慮的鍵 → 該語言檔的值改成英文，列進 `_english`，並同步 `tests/unit/site/ui-translations.test.ts` 的 `ENGLISH_FALLBACK`。
  - zh、en 人工撰寫；其他 14 種機器翻譯，列進 `_machine`（遊戲字串鍵不列）。
  - 「未翻譯」標記每段或每群組最多一個，不是每列一個。
- **程式碼**：
  - 不得使用 `as` 斷言、`@ts-ignore`、`@ts-expect-error`。改用 zod `parse`、型別守衛、`satisfies`、`as const`。
  - 檔案 ≤ 400 行，函式 < 50 行。
  - 不可變：回傳新物件或陣列，不修改輸入。
  - 錯誤要明確處理，不可默默吞掉。
- **換行符號**：保持每個**既有**檔案原本的換行。改檔前先用 node 數 CR：
  `node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log((s.match(/\r\n/g)||[]).length,(s.match(/\n/g)||[]).length)" <file>`
  第一個數字是 CRLF 行數。
  - 本計畫會動到的既有檔案大多是 **LF**（2026-10-12 量過）：`site-menu.ts`、`pipeline.ts`、`issues.ts`、`bestiary.ts`、`ui-game-keys.json`、`src/i18n/*.json`、`ui-translations.test.ts`、`achievements.spec.ts`、`mobs.spec.ts`、`wiki.spec.ts`、`vitest.config.ts`。
  - **CRLF** 的檔案：`src/lib/map/viewer.ts`、`src/lib/map/marker-dom.ts`、`tests/e2e/map.spec.ts`。本計畫不需要改它們；萬一要改，用 node 腳本整檔改寫並保留 CRLF。
  - 新檔一律用 LF。
- **client 腳本**：`.astro` 裡 bundled 的 `<script>` 不得引入：
  - extract 端模組的執行期程式碼；
  - `src/lib/ui-strings.ts`、`ui-dicts.ts`、`src/i18n/*.json`、`ui-game-strings.json`、`zod`。

  `tests/unit/site/client-bundle.test.ts` 會檢查。`src/lib/soul-storm-schedule.ts` **不得有任何 import**，Task 4 有測試。型別引入一律用 `import type`。
- **禁用資料**：
  - `DataTables/UFS/OnlineConstants.json` 含遙測 API 金鑰，**絕不讀取、絕不發布**。
  - 所有 DataTable 一律經 `readDataTable`。
  - 新程式碼不得出現 `OnlineConstants` 這個字（既有的 `telemetry-key.test.ts` 會掃 `scripts/extract/*.ts`）。
  - 時程與輪替兩張表的標籤是 `OnlineDataTables.*`，那是另一回事，可以讀。
- **預覽與 E2E 只用 port 4329**：
  - 開工前先檢查：PowerShell `Get-NetTCPConnection -LocalPort 4329 -State Listen -ErrorAction SilentlyContinue`。
  - 若被佔用：確認是本專案的 `astro preview` 才能關。它若服務的是舊 build，`reuseExistingServer` 會讓 E2E 測到舊頁面，要先處理。
  - **絕不碰 4321**（那是使用者另一個專案）。
- **子路徑建置**：Git Bash 要加 `MSYS_NO_PATHCONV=1`：`MSYS_NO_PATHCONV=1 BASE_PATH=/mcd2-wiki/ npm run build`。驗證完要用 `npm run build` 重建，把 dist 還原。
- **Commit**：
  - conventional commits（`feat:`、`test:`、`refactor:`、`docs:`、`chore:`、`fix:`）。
  - **不加任何 attribution 行**（沒有 Co-Authored-By、沒有 session 連結）。
  - 每個 Task 至少一個 commit。
- **不要 push**，直到 Task 7 的最終審查通過。
- **規模上限**（spec §8）：
  - `src/data/soul-storm.json` < 50 KB；
  - `dist` 相對 `origin/master` 的 build 增加 < 2 MB（Task 7 先量基準）。
- **每個 Task 開工前**：在 worktree 根目錄確認已 `npm ci`、`npx astro sync`。**每個 Task 結束前**：跑該 Task 列出的測試，以及 `npx tsc --noEmit -p .`，必須 0 錯誤。

## Review Focus

1. **時間計算的正確性**（Task 4）：
   - 時段邊界是左閉右開：`[start, start+20min)` 進行中，`start+20min` 那一刻已結束；
   - 錨點之前用數學 floor，index −1 → 區域 6；
   - 7 區繞回：index 7 → 區域 0；
   - `rotationOffset` 有生效；
   - 當地時間只在顯示時轉換，計算一律用 epoch ms。
2. **未確認標記**：`verified:false` 時，頁面上有且只有一個「推算時刻，尚未經遊戲內確認」，沒有 JS 時也看得到；`verified:true` 時沒有。`verified` 的唯一來源是 `scripts/extract/soul-storm-status.json`，Task 3 有測試保證輸出與它一致。
3. **只說資料能證明的事**：
   - 寶箱的裝備格寫成「必掉 N」加「資料中沒有物品清單」，不能暗示是哪些物品；
   - 寶箱群組標「條件未確認」；
   - 過時的 tutorial 第 2 段不得出現在任何語言的頁面上；
   - `StorminatorSpawned`、AreaModification 的數值、「Nearly as cool as Kira.」都不上頁面。
4. **Easy 產生器的生命是沿用基礎列的 800**，不是 0 或缺值。Easy 的護盾是 `null`（基礎 `ActivationChance 0`），不是「0% 機率」。
5. **最終召喚要解析巢狀 SpawnDefinition**：`Type3` → 三個 `…Monstrosity` 子定義 → `SW.Mob.Monstrosity.*.Storm`。結果要經圖鑑的 tag 索引轉成 slug；對不到的要進報告，不能產生壞連結。
6. **client bundle**：`soul-storm-schedule.ts` 沒有任何 import；`SoulStormClock.astro` 的 script 只引入它。字串一律由伺服器端放進 JSON payload。
7. **遙測金鑰**：讀取清單不含它，`src/data/soul-storm.json` 不含它的任何值（既有測試自動涵蓋）。
8. **噪音**：每段或每群組最多一個「未翻譯」，每個寶箱群組一個「條件未確認」。德文、俄文在 412px 寬下不得橫向溢出。

## 預檢：spec 模糊處的決定

| # | 模糊處 | 決定 |
|---|---|---|
| P1 | `verified` 放哪裡、怎麼「一行切換」 | 唯一來源是 `scripts/extract/soul-storm-status.json`：`{ "verified": false, "anchorOffsetMinutes": 0, "rotationOffset": 0 }`。抽取時抄進 `soul-storm.json`。切換方法：改成 `"verified": true`，跑 `npm run extract`，兩個檔一起 commit。測試保證兩者一致，避免只改一半。 |
| P2 | client 怎麼拿到資料 | 與 `WorldMap.astro` 相同：`<script type="application/json" data-soul-storm-json set:html={payload}>`。payload 內的字串都已是當前語言（標籤、區域名、地圖連結），client 不必查字典。 |
| P3 | `soul-storm-schedule.ts` 放在 `src/lib`，不在覆蓋率範圍內 | 在 `vitest.config.ts` 的 `coverage.include` **只加這一個檔**：`"src/lib/soul-storm-schedule.ts"`。不放寬其他範圍，四項門檻一樣 ≥ 80%。 |
| P4 | 怎麼拿到圖鑑的 tag 索引與區域列 | `BestiaryResult` 增加 `links: { tagIndex: ReadonlyMap<string,string>; areas: readonly AreaRow[] }`（不序列化）。缺怪物表時是空的 Map 與空陣列。這樣不必再讀一次 570 KB 的 `DT_AreaDefinition`。 |
| P5 | 寶箱排序與 tier 名稱 | 產生器寶箱 easy → medium → hard，接著獎勵寶箱 low → medium → high。tier 取標籤的最後一段轉小寫。網站依 `group` 選標籤：產生器用 `soulStormTier*`（簡單／中等／困難），獎勵用 `soulStormChest*`（低／中／高）。 |
| P6 | 巢狀 SpawnDefinition 的解析 | `resolveSpawnMobs(spawns, tag)`：深度 ≤ 4；用 visited 集合防止循環；合併 `SpawnTable.Tags` 與 `Conditions[].DropTable.Tags`；`SW.SpawnDefinition.*` 遞迴；`SW.Mob.*` 收集；去重並保持首次出現的順序。 |
| P7 | 風暴巨獸清單怎麼來 | `monstrosities` = Hard 的 `finalSummon.mobs`，由資料推出，不手寫。 |
| P8 | tutorial 第 1 段怎麼切 | `text.split(/\r?\n[ \t]*\r?\n/)`，取 `[0].trim()`。切出 < 2 段 → 該語言退回英文第 1 段，並記入 `untranslated`。英文本身切不出 2 段 → 整段（全部語言）視為缺字：`html` 全為空字串、記 `soul-storm-text-fallback`，頁面不顯示這段。 |
| P9 | 未確認標記放哪裡 | 全頁只有一個：時程段標題下的 `<p class="tag warn" data-testid="soul-storm-unverified">`。它在 `<noscript>` 之外，沒有 JS 也看得到。 |
| P10 | 時區名稱 | client 用 `Intl.DateTimeFormat().resolvedOptions().timeZone`，填進 `soulStormTimeZone` 的 `{zone}`。 |
| P11 | 接下來幾場 | 7 場（一整輪），從「進行中的那場」或「下一場」開始。 |
| P12 | 頁面檔名 | `src/pages/[lang]/soul-storm.astro`，與 `achievements.astro` 相同模式。 |
| P13 | 缺表時 | 輸出 `EMPTY_SOUL_STORM`（`rotation: []`、`generators: []`、`chests: []`…），schema 允許。頁面只顯示官方介紹與 `soulStormNoData`，時程元件不輸出。 |
| P14 | 護盾機率 0 | 機率為 0 時 `shield: null`，網站顯示 `soulStormShieldNone`（不召喚）。 |
| P15 | 百分比格式 | 沿用 `src/lib/mobs.ts` 的 `formatChance`（依語言的 `Intl.NumberFormat` percent）。門檻 0.2 顯示為「20%」。 |
| P16 | 重新抽取造成其他 JSON 變動 | Task 3 Step 6 跑 `npm run extract` 後看 `git diff --stat src/data public`。只提交 `soul-storm.json` 與 `public/icons/soul-storm/`；其他檔若只是順序變動或無關變動就還原，並寫進 ledger。 |
| P17 | 寶箱 slot 型別 | 沿用 `MobDropSchema`。`pool` 的判斷：有自己的 `DropTable.Tags` → `"own"`；否則 `InheritParentDropTable` 為真 → `"area"`；否則 `"none"`。必掉與次數都是 0 的 slot 不輸出。 |

---

### Task 1: 資料表、狀態檔與輸出 schema

**Files:**
- Create: `scripts/extract/soul-storm-tables.ts`
- Create: `scripts/extract/soul-storm-schema.ts`
- Create: `scripts/extract/soul-storm-status.json`
- Modify: `scripts/extract/issues.ts`（LF）：`IssueType` 加 `"missing-soul-storm-tables" | "soul-storm-area-unnamed" | "soul-storm-mob-unlinked" | "soul-storm-text-fallback"`
- Create: `tests/helpers/soul-storm-tables.ts`
- Test: `tests/unit/extract/soul-storm-tables.test.ts`、`tests/unit/extract/soul-storm-schema.test.ts`

**Interfaces:**
- Produces（`soul-storm-tables.ts`）：
  ```ts
  export const SOUL_STORM_TABLE_FILES = {
    schedule: "DT_SoulStormTimeSchedule",
    rotation: "DT_SoulStormScheduleAreaRotation",
    props: "DT_SoulStormPropActorDefinition",
    spawns: "DT_SpawnDefinition",
    lootActor: "DT_LootSourceDefinition_LootActor",
    rarityChance: "DT_RarityChanceDefinition",
    gameBalance: "DT_GameBalanceDefinition",
  } as const;
  export const SoulStormTablesSchema;  // z.object({ schedule, rotation, props, spawns, lootActor, rarityChance, gameBalance })
  export type SoulStormTables = z.infer<typeof SoulStormTablesSchema>;
  export type ScheduleRow, RotationRow, PropRow, SpawnRow, RarityChanceRow, GameBalanceRow;  // 各表的元素型別
  export interface LoadedSoulStormTables { readonly tables?: SoulStormTables; readonly missing: readonly string[] }
  export function loadSoulStormTables(sourceRoot: string, onRead?: (file: string) => void): Promise<LoadedSoulStormTables>;
  // 每個檔案先檢查存在（existsSync），不存在就放進 missing、該表當作 []；
  // schedule 或 rotation 缺 → tables 為 undefined；
  // 存在但欄位不符 → throw ExtractError，訊息含檔名（用 formatZodError）；
  // 讀取一律經 readDataTable（UFS 目錄 = path.join(sourceRoot, "DataTables", "UFS")）。
  ```
  zod 只描述用得到的欄位。各列與巢狀物件用 `z.looseObject`，其餘欄位放過：
  - `schedule`：`{ Name, TypeTag:{TagName}, Timestamp: string, DurationInSeconds: number, CadenceInSeconds: number }`
  - `rotation`：`{ Name, TypeTag, AreaTags: {TagName}[] }`
  - `props`：
    - 基本：`{ Name, TypeTag, Traits?:{GameplayTags?}, AttributeValues?:{Attribute:{TagName},Value:number}[], TypeTextData? }`；
    - `AttributeThresholds?:{Thresholds:{Event:{TagName},Value:number}[]}`；
    - `Abilities?:{ AbilityCallsign?:{TagName}, CommonKeyValues?:KeyValue[], InstanceData?:{ WaveArray?:{SpawnDefinition:{TagName}}[], TagToSpawn?:{TagName}, TargetAbilityCallsign?:{TagName}, TimerDuration?:number }[] }[]`；
    - `AbilitySpecialization?:{Specializations:{AbilityCallsign:{TagName}, KeyValueSpecializations?:{KeyValue:KeyValue}[], InstanceDataSpecializations?:{TimerDuration?:number}[]}[]}`；
    - `MultiplayerScalingDefinitions?:{TagMap: Record<string,{Multipliers:number[]}>}`；
    - `KeyValue = { TypeTag:{TagName}, Type:string, Int?:number, Float?:number }`。
  - `spawns`：`{ Name, TypeTag, SpawnDefinition?:{ SpawnSlot: Record<string,{ SpawnTable?:{Tags?:TagWeight[]}, Conditions?:{DropTable?:{Tags?:TagWeight[]}}[] }> } }`，其中 `TagWeight = {TypeTag:{TagName}, Weight:number, Operation:string}`。
  - `lootActor`：`LootTablesSchema.shape.lootActor`（沿用 `loot-tables.ts`）。
  - `rarityChance`：`{ Name, TypeTag, TagList:{Tags?:TagWeight[]} }`
  - `gameBalance`：`{ Name, TypeTag, Traits?, SoulStormConstants?:{ SoulStormEligibilityGamestate?:{TagName} } }`
- Produces（`soul-storm-schema.ts`）：
  ```ts
  export const SoulStormStatusSchema = z.strictObject({
    verified: z.boolean(),
    anchorOffsetMinutes: z.number().int().min(-720).max(840),
    rotationOffset: z.number().int().nonnegative(),
  });
  export type SoulStormStatus = z.infer<typeof SoulStormStatusSchema>;
  export const GENERATOR_TIERS = ["easy", "medium", "hard"] as const;
  export const CHEST_TIERS = ["easy", "medium", "hard", "low", "high"] as const;
  export const TEXT_IDS = ["title", "overview1", "overview2", "tutorial", "objective", "generatorHint", "shieldHint", "extraEffect", "generatorName"] as const;
  export type TextId = (typeof TEXT_IDS)[number];
  export const SoulStormDataSchema;   // 欄位逐字照 spec §5.2；rotation 元素用 MobAreaSchema（mob-schema.ts）；chests[].slots 用 z.array(MobDropSchema)；
                                      // resistances[].key 是 z.enum(["resistSoul","resistMelee","knockbackResistance"])
  export type SoulStormData = z.infer<typeof SoulStormDataSchema>;
  export type Generator = SoulStormData["generators"][number];
  export type Chest = SoulStormData["chests"][number];
  export const EMPTY_SOUL_STORM: SoulStormData;  // 每個 texts[id] = { html: 全部語言 "", untranslated: [] }，其他陣列為空、unlock/chestRarity/shieldHealth 為 null、icons {}，verified false，schedule 全 0、anchorRaw ""、anchorUtc ""
  ```
- Produces（`soul-storm-status.json`）：逐字是
  ```json
  {
    "verified": false,
    "anchorOffsetMinutes": 0,
    "rotationOffset": 0
  }
  ```
- Produces（`tests/helpers/soul-storm-tables.ts`）：見 Step 1。

- [ ] **Step 0：環境（只做一次）**

  在 worktree 根目錄（PowerShell）：
  ```powershell
  if (-not (Test-Path source-data)) { cmd /c mklink /J source-data D:\Project\mcd2-wiki\source-data }
  (Get-Item source-data).LinkType   # 應為 Junction
  npm ci
  npx astro sync
  ```
  `source-data/` 已在 `.gitignore`。`git status` 不應出現它。

- [ ] **Step 1：寫測試輔助與失敗的測試**

`tests/helpers/soul-storm-tables.ts`（新檔，Task 1–3 共用；值取自真資料 spec §2）：

```ts
/** Hand-made Soul Storm DataTable rows in the game's export shape, with the real values from spec §2. */
import { lootRow, slot } from "./mob-tables";
import { SoulStormTablesSchema, type SoulStormTables } from "../../scripts/extract/soul-storm-tables";

const tag = (TagName: string) => ({ TagName });
const tagWeight = (name: string, Weight = 1, Operation = "Set") => ({ TypeTag: tag(name), Weight, Operation });
const keyValue = (name: string, type: "Int" | "Float", value: number) =>
  type === "Int" ? { TypeTag: tag(`SW.KeyValue.${name}`), Type: "Int", Int: value } : { TypeTag: tag(`SW.KeyValue.${name}`), Type: "Float", Float: value };
const attr = (name: string, Value: number) => ({ Attribute: tag(`SW.Attribute.${name}`), Value });

export const ROTATION_TAGS = [
  "SW.Area.Forest.A1", "SW.Area.Meadow.A1", "SW.Area.Plains.A2", "SW.Area.Carapace.A1",
  "SW.Area.Meadow.A2", "SW.Area.Desert.A1", "SW.Area.Plains.A1",
] as const;

export const scheduleRow = (Timestamp = "2026.01.01-00.00.00", DurationInSeconds = 1200, CadenceInSeconds = 2400) => ({
  Name: "SoulStormTime", TypeTag: tag("OnlineDataTables.TypeSystem.DT_SoulStormTimeSchedule"), Timestamp, DurationInSeconds, CadenceInSeconds,
});

export const rotationRow = (areas: readonly string[] = ROTATION_TAGS) => ({
  Name: "1", TypeTag: tag("OnlineDataTables.SoulStormScheduleAreaRotation"), AreaTags: areas.map(tag),
});

export const BASE_TAG = "SW.PropActor.SoulStorm.Storminator.Base";
const FINAL = "SW.AbilityCallsign.Soulstorm.StorminatorHealthFinalThreshold";
const SHIELD = "SW.AbilityCallsign.Soulstorm.SpawnShield";
const scaling = { TagMap: { '(AttributeName="HealthMax",Attribute=/Script/SpicewoodGAS.ATR_Health:HealthMax,AttributeOwner=None)': { Multipliers: [1, 1.5, 2, 2.5] } } };

export const baseGenerator = () => ({
  Name: "Storminator",
  TypeTag: tag(BASE_TAG),
  Traits: { GameplayTags: [tag("SW.PropActor.Default.HostileMob")] },
  AttributeValues: [attr("Health", 800), attr("Resistance.KnockbackResistanceMultiplier", 0), attr("SoulDamageResistanceMultiplier", 0.5), attr("MeleeDamageResistanceMultiplier", 0.8)],
  Abilities: [
    { AbilityCallsign: tag(SHIELD), CommonKeyValues: [keyValue("ActivationChance", "Int", 0), keyValue("CooldownDuration", "Float", 0)], InstanceData: [{ TagToSpawn: tag("SW.PropActor.SoulStorm.Barrier") }] },
    { AbilityCallsign: tag("SW.AbilityCallsign.ApplyDeathEffects"), CommonKeyValues: [keyValue("ActivationChance", "Int", 100)], InstanceData: [{ TagToSpawn: tag("SW.LootActor.StorminatorChest.Easy") }] },
  ],
  TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': { Text: 'LOCTABLE("DT_SoulStormPropActorDefinition.csv", "SW_PropActor_SoulStorm_Storminator_Base_SW_TextEntry_Name")' } } },
});

export interface TierOptions {
  readonly health?: number;                       // undefined → the row has no Health (Easy)
  readonly finalThreshold: number;
  readonly finalWave: string;                     // SW.SpawnDefinition.Storminator.Wave.<…>
  readonly shield?: readonly [chancePercent: number, cooldownSeconds: number];
}
export const tierGenerator = (tier: "Easy" | "Medium" | "Hard", options: TierOptions) => ({
  Name: `Storminator_${tier}`,
  TypeTag: tag(`SW.PropActor.SoulStorm.Storminator.${tier}`),
  Traits: { GameplayTags: [tag(BASE_TAG), tag("SW.Property.Spawnable")] },
  ...(options.health === undefined ? {} : { AttributeValues: [attr("Health", options.health)] }),
  AttributeThresholds: { Thresholds: [{ Event: tag("SW.GameplayEvent.SoulStorm.Health.FinalThreshold"), Value: options.finalThreshold }] },
  Abilities: [{ AbilityCallsign: tag(FINAL), InstanceData: [{ WaveArray: [{ SpawnDefinition: tag(options.finalWave) }] }] }],
  AbilitySpecialization: {
    Specializations: options.shield
      ? [{ AbilityCallsign: tag(SHIELD), KeyValueSpecializations: [{ KeyValue: keyValue("ActivationChance", "Int", options.shield[0]) }, { KeyValue: keyValue("CooldownDuration", "Float", options.shield[1]) }] }]
      : [],
  },
  MultiplayerScalingDefinitions: scaling,
});

export const shieldGenerator = () => ({ Name: "Shieldinator", TypeTag: tag("SW.PropActor.SoulStorm.Barrier"), AttributeValues: [attr("Health", 55)] });

export const REAL_GENERATORS = () => [
  baseGenerator(),
  shieldGenerator(),
  tierGenerator("Easy", { finalThreshold: 0.2, finalWave: "SW.SpawnDefinition.Storminator.Wave.SoulstatedUndead" }),
  tierGenerator("Medium", { health: 1000, finalThreshold: 0.4, finalWave: "SW.SpawnDefinition.Storminator.Wave.Type2", shield: [16, 60] }),
  tierGenerator("Hard", { health: 1200, finalThreshold: 0.4, finalWave: "SW.SpawnDefinition.Storminator.Wave.Type3", shield: [40, 45] }),
];

const slotKey = '(TagName="SW.SpawnSlot.Mob.Special")';
export const spawnRow = (Name: string, typeTag: string, tags: readonly (readonly [string, number])[]) => ({
  Name, TypeTag: tag(typeTag), SpawnDefinition: { SpawnSlot: { [slotKey]: { SpawnTable: { Tags: tags.map(([name, weight]) => tagWeight(name, weight)) } } } },
});
export const REAL_SPAWNS = () => [
  {
    Name: "StorminatorEasy", TypeTag: tag("SW.SpawnDefinition.Storminator"),
    SpawnDefinition: { SpawnSlot: { '(TagName="SW.SpawnSlot.Storminator")': { SpawnTable: {}, Conditions: [{ DropTable: { Tags: [
      tagWeight("SW.PropActor.SoulStorm.Storminator.Easy", 2), tagWeight("SW.PropActor.SoulStorm.Storminator.Medium", 2), tagWeight("SW.PropActor.SoulStorm.Storminator.Hard", 1),
    ] } }] } } },
  },
  spawnRow("StorminatorWaveSoulstated", "SW.SpawnDefinition.Storminator.Wave.SoulstatedUndead", [["SW.Mob.Zombie.SoulStated", 1], ["SW.Mob.Vindicator.SoulStated", 1]]),
  spawnRow("Type2", "SW.SpawnDefinition.Storminator.Wave.Type2", ["Witch", "Enderman", "Warden", "Evoker", "WellspringMiniboss", "Driftweaver"].map((mob) => [`SW.Mob.${mob}`, 1] as const)),
  spawnRow("Type3", "SW.SpawnDefinition.Storminator.Wave.Type3", [["SW.SpawnDefinition.Storminator.Wave.CopperMonstrosity", 1], ["SW.SpawnDefinition.Storminator.Wave.RedStoneMonstrosity", 1], ["SW.SpawnDefinition.Storminator.Wave.SculkMonstrosity", 1]]),
  spawnRow("CopperMonstrosity", "SW.SpawnDefinition.Storminator.Wave.CopperMonstrosity", [["SW.Mob.Monstrosity.Copper.Storm", 1]]),
  spawnRow("RedStoneMonstrosity", "SW.SpawnDefinition.Storminator.Wave.RedStoneMonstrosity", [["SW.Mob.Monstrosity.RedStone.Storm", 1]]),
  spawnRow("SculkMonstrosity", "SW.SpawnDefinition.Storminator.Wave.SculkMonstrosity", [["SW.Mob.Monstrosity.Sculk.Storm", 1]]),
];

/** [name, tag, gear, springStone [g, rolls], emeralds [g, rolls]] for the six chests, as in the game. */
const CHESTS = [
  ["StorminatorChestEasy", "SW.LootActor.StorminatorChest.Easy", 1, [1, 2], [5, 10]],
  ["StorminatorChestMedium", "SW.LootActor.StorminatorChest.Medium", 1, [1, 2], [5, 10]],
  ["StorminatorChestHard", "SW.LootActor.StorminatorChest.Hard", 2, [1, 3], [5, 15]],
  ["SoulStormRewardChestLow", "SW.LootActor.StorminatorChest.Final.Low", 2, [1, 3], [5, 15]],
  ["SoulStormRewardChestMedium", "SW.LootActor.StorminatorChest.Final.Medium", 3, [1, 3], [5, 15]],
  ["SoulStormRewardChestHigh", "SW.LootActor.StorminatorChest.Final.High", 4, [4, 3], [10, 15]],
] as const;
export const REAL_CHESTS = () => [
  { Name: "StorminatorChest", TypeTag: tag("SW.LootActor.StorminatorChest"), LootDropDefinition: {} },
  ...CHESTS.map(([name, typeTag, gear, [stoneG, stoneR], [emeraldG, emeraldR]]) =>
    lootRow(name, typeTag, [
      slot("Item", gear, 0, 1, false),
      slot("SpringStone", stoneG, stoneR, 0.33, true, ["SW.Item.Currency.Springstone"]),
      slot("Emeralds", emeraldG, emeraldR, 0.3, false, ["SW.Item.Currency.Emerald", "SW.Item.Currency.EmeraldBlock"]),
    ])),
  lootRow("FancyChest", "SW.LootActor.FancyChest", [slot("Item", 1, 0, 1, true)]),
];

export const REAL_RARITY = () => [
  { Name: "Default", TypeTag: tag("SW.RarityChanceDefinition.Default"), TagList: { Tags: [tagWeight("SW.Rarity.Common", 50), tagWeight("SW.Rarity.Rare", 25)] } },
  { Name: "StorminatorRewardChest", TypeTag: tag("SW.LootActor.StorminatorChest"), TagList: { Tags: [tagWeight("SW.Rarity.Common", 0, "Multiply"), tagWeight("SW.Rarity.Rare", 0.01, "Multiply")] } },
];

export const REAL_BALANCE = () => [
  { Name: "Active", TypeTag: tag("SW.GameplayRuleSet.Active"), Traits: { GameplayTags: [tag("SW.GameplayRuleSet.SecondPass")] }, SoulStormConstants: { SoulStormEligibilityGamestate: tag("None") } },
  { Name: "SecondPass", TypeTag: tag("SW.GameplayRuleSet.SecondPass"), SoulStormConstants: { SoulStormEligibilityGamestate: tag("SW.GameState.MainQuestComplete"), SoulStormEndSpawnVolumeCooldownSeconds: 30 } },
];

const EMPTY = { schedule: [], rotation: [], props: [], spawns: [], lootActor: [], rarityChance: [], gameBalance: [] };
export const soulStormTables = (partial: Partial<Record<keyof SoulStormTables, readonly unknown[]>> = {}): SoulStormTables =>
  SoulStormTablesSchema.parse({ ...EMPTY, ...partial });
export const realSoulStormTables = (): SoulStormTables =>
  soulStormTables({ schedule: [scheduleRow()], rotation: [rotationRow()], props: REAL_GENERATORS(), spawns: REAL_SPAWNS(), lootActor: REAL_CHESTS(), rarityChance: REAL_RARITY(), gameBalance: REAL_BALANCE() });
```

`tests/unit/extract/soul-storm-tables.test.ts`：

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSoulStormTables, SOUL_STORM_TABLE_FILES } from "../../../scripts/extract/soul-storm-tables";
import { realSoulStormTables, REAL_CHESTS, REAL_GENERATORS, REAL_SPAWNS, rotationRow, scheduleRow } from "../../helpers/soul-storm-tables";

async function sourceWith(tables: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mcd2-storm-"));
  const dir = path.join(root, "DataTables", "UFS");
  await mkdir(dir, { recursive: true });
  for (const [name, rows] of Object.entries(tables)) await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows), "utf8");
  return root;
}

describe("Soul Storm tables", () => {
  it("accepts the game's row shapes", () => {
    const tables = realSoulStormTables();
    expect(tables.schedule[0].CadenceInSeconds).toBe(2400);
    expect(tables.rotation[0].AreaTags.map((area) => area.TagName)).toHaveLength(7);
    expect(tables.props).toHaveLength(5);
  });

  it("loads every table through the reader and reports what it read", async () => {
    const root = await sourceWith({
      DT_SoulStormTimeSchedule: [scheduleRow()], DT_SoulStormScheduleAreaRotation: [rotationRow()],
      DT_SoulStormPropActorDefinition: REAL_GENERATORS(), DT_SpawnDefinition: REAL_SPAWNS(), DT_LootSourceDefinition_LootActor: REAL_CHESTS(),
      DT_RarityChanceDefinition: [], DT_GameBalanceDefinition: [],
    });
    const read: string[] = [];
    const loaded = await loadSoulStormTables(root, (file) => read.push(file));
    expect(loaded.missing).toEqual([]);
    expect(loaded.tables?.schedule[0].Timestamp).toBe("2026.01.01-00.00.00");
    expect(read.sort()).toEqual(Object.values(SOUL_STORM_TABLE_FILES).map((name) => `${name}.json`).sort());
    expect(read.some((file) => /constants/i.test(file))).toBe(false);
  });

  it("has no tables without the schedule, and names what is missing", async () => {
    const root = await sourceWith({ DT_SoulStormScheduleAreaRotation: [rotationRow()] });
    const loaded = await loadSoulStormTables(root);
    expect(loaded.tables).toBeUndefined();
    expect(loaded.missing).toContain("DT_SoulStormTimeSchedule.json");
  });

  it("keeps going with empty optional tables", async () => {
    const root = await sourceWith({ DT_SoulStormTimeSchedule: [scheduleRow()], DT_SoulStormScheduleAreaRotation: [rotationRow()] });
    const loaded = await loadSoulStormTables(root);
    expect(loaded.tables?.props).toEqual([]);
    expect(loaded.missing).toEqual(expect.arrayContaining(["DT_SoulStormPropActorDefinition.json", "DT_SpawnDefinition.json"]));
  });

  it("fails with the file name when a row does not match", async () => {
    const root = await sourceWith({ DT_SoulStormTimeSchedule: [{ ...scheduleRow(), CadenceInSeconds: "2400" }], DT_SoulStormScheduleAreaRotation: [rotationRow()] });
    await expect(loadSoulStormTables(root)).rejects.toThrow(/DT_SoulStormTimeSchedule/);
  });
});
```

`tests/unit/extract/soul-storm-schema.test.ts`：

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_SOUL_STORM, SoulStormDataSchema, SoulStormStatusSchema } from "../../../scripts/extract/soul-storm-schema";

describe("Soul Storm schema", () => {
  it("ships unverified, with no offsets", () => {
    const status = SoulStormStatusSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/extract/soul-storm-status.json"), "utf8")));
    expect(status).toEqual({ verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 });
  });

  it("rejects a status that is not a plain boolean switch", () => {
    expect(() => SoulStormStatusSchema.parse({ verified: "yes", anchorOffsetMinutes: 0, rotationOffset: 0 })).toThrow();
    expect(() => SoulStormStatusSchema.parse({ verified: true, anchorOffsetMinutes: 0, rotationOffset: -1 })).toThrow();
    expect(() => SoulStormStatusSchema.parse({ verified: true, anchorOffsetMinutes: 0, rotationOffset: 0, extra: 1 })).toThrow();
  });

  it("accepts the empty output used when the tables are missing", () => {
    expect(SoulStormDataSchema.parse(EMPTY_SOUL_STORM)).toEqual(EMPTY_SOUL_STORM);
  });
});
```

- [ ] **Step 2：跑測試，確認失敗**：
  `npx vitest run tests/unit/extract/soul-storm-tables.test.ts tests/unit/extract/soul-storm-schema.test.ts`
  預期因為找不到模組而失敗。
- [ ] **Step 3：實作**
  - 照 Interfaces 寫 `soul-storm-tables.ts`、`soul-storm-schema.ts`、`soul-storm-status.json`、`issues.ts`（改前先數 CR）。
  - `loadSoulStormTables` 拆成小函式：`tablePath`、`readOptional`、`parseTables`。
  - 用 `SoulStormTablesSchema.safeParse`；失敗時 `throw new ExtractError(formatZodError(...))`，訊息要含檔名。拿不到單一檔名時，用表的鍵對回 `SOUL_STORM_TABLE_FILES`。
- [ ] **Step 4：跑測試，確認通過**（同 Step 2 指令），再跑 `npx tsc --noEmit -p .`。
- [ ] **Step 5：對真資料做煙霧測試**（不寫檔）：
  `npx tsx -e "import('./scripts/extract/soul-storm-tables.ts').then(async m=>{const r=await m.loadSoulStormTables('source-data');console.log(r.missing,r.tables?.props.length,r.tables?.spawns.length,r.tables?.lootActor.length,r.tables?.rarityChance.length,r.tables?.gameBalance.length)})"`
  - 預期 `[] 5 109 25 25 2`。
  - schema 對真資料失敗時，放寬的只能是「用不到的欄位」，不可把用得到的欄位改成 `unknown`。
- [ ] **Step 6：Commit**：`feat: read the Soul Storm DataTables behind the telemetry-safe reader`

---

### Task 2: 時程、輪替與官方文字（抽取端）

**Files:**
- Create: `scripts/extract/soul-storm-schedule-data.ts`
- Create: `scripts/extract/soul-storm-texts.ts`
- Modify: `tests/helpers/locales.ts`（LF）：加 `makeSparseLocales`
- Test: `tests/unit/extract/soul-storm-schedule-data.test.ts`、`tests/unit/extract/soul-storm-texts.test.ts`

**Interfaces:**
- Consumes：
  - `ScheduleRow`、`RotationRow`、`SoulStormStatus`（Task 1）；
  - `AreaRow`（`mob-tables.ts`）、`AreaMarker`／`areaMarkers`（`mob-areas.ts`）；
  - `locRef`、`localize`、`englishFallbacks`（`loc-table.ts`）、`renderMarkup`（`render-markup.ts`）。
- Produces（`soul-storm-schedule-data.ts`）：
  ```ts
  /** "2026.01.01-00.00.00" read as UTC minus offsetMinutes → ISO string; throws ExtractError on any other format. */
  export function parseUeTimestamp(raw: string, offsetMinutes: number): string;
  export function buildSchedule(row: ScheduleRow, status: SoulStormStatus): SoulStormData["schedule"];
  // 必須 cadence > duration > 0，否則 throw ExtractError。
  export interface RotationResult { readonly rotation: MobArea[]; readonly untranslated: Lang[]; readonly issues: Issue[] }
  export function buildRotation(row: RotationRow, areas: readonly AreaRow[], locales: Locales, markers: ReadonlyMap<string, AreaMarker>): RotationResult;
  // 保持表格順序；untranslated 是各區 englishFallbacks 的聯集，依 LANGS 排序；
  // 找不到名稱 → issue soul-storm-area-unnamed，英文名用標籤末兩段（"Forest A1"），15 種非英語都記入 untranslated。
  ```
- Produces（`soul-storm-texts.ts`）：
  ```ts
  export const SOUL_STORM_TEXT_KEYS: Readonly<Record<TextId, { readonly namespace: string; readonly key: string; readonly firstParagraph?: true }>>;
  // title → OnboardingLabels.csv/tutoriallog_soulstorms_title；overview1/2 → panel_soulstorm_overview_description_1/_2；
  // tutorial → tutoriallog_soulstorms_description（firstParagraph）；
  // objective/generatorHint/shieldHint → DT_UITypeDataDefinition.csv/SW_AreaModification_SoulStorm_SW_TextEntry_Soulstorm_{Entered_Description,Storminator_Hint,Shieldinator_Hint}；
  // extraEffect → LootItemPanelLabels.csv/SoulStormMessage；generatorName → DT_SoulStormPropActorDefinition.csv/SW_PropActor_SoulStorm_Storminator_Base_SW_TextEntry_Name
  // （namespace 都加 "Text/Release/" 前綴）
  export function firstParagraph(text: string): string | undefined;   // 少於 2 段 → undefined
  export function buildSoulStormTexts(locales: Locales): { texts: SoulStormData["texts"]; issues: Issue[] };
  ```

- [ ] **Step 1：寫失敗的測試**

`tests/unit/extract/soul-storm-schedule-data.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { buildRotation, buildSchedule, parseUeTimestamp } from "../../../scripts/extract/soul-storm-schedule-data";
import { areaRow } from "../../helpers/mob-tables";
import { realSoulStormTables, rotationRow, scheduleRow } from "../../helpers/soul-storm-tables";
import { makeSparseLocales as locales } from "../../helpers/locales";

describe("parseUeTimestamp", () => {
  it("reads the game's timestamp as UTC", () => {
    expect(parseUeTimestamp("2026.01.01-00.00.00", 0)).toBe("2026-01-01T00:00:00.000Z");
  });
  it("shifts by the configured offset when the anchor is local time", () => {
    expect(parseUeTimestamp("2026.01.01-00.00.00", 480)).toBe("2025-12-31T16:00:00.000Z");
    expect(parseUeTimestamp("2026.01.01-00.00.00", -300)).toBe("2026-01-01T05:00:00.000Z");
  });
  it("refuses anything else", () => {
    for (const bad of ["2026-01-01T00:00:00Z", "2026.13.01-00.00.00", "2026.01.01", ""]) expect(() => parseUeTimestamp(bad, 0), bad).toThrow();
  });
});

describe("buildSchedule", () => {
  const status = { verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 };
  it("keeps the raw values and the computed anchor", () => {
    expect(buildSchedule(realSoulStormTables().schedule[0], status)).toEqual({
      anchorRaw: "2026.01.01-00.00.00", anchorUtc: "2026-01-01T00:00:00.000Z", anchorOffsetMinutes: 0,
      durationSeconds: 1200, cadenceSeconds: 2400, rotationOffset: 0,
    });
  });
  it("refuses a storm longer than its cadence", () => {
    const row = realSoulStormTables().schedule[0];
    expect(() => buildSchedule({ ...row, DurationInSeconds: 2400 }, status)).toThrow();
  });
});

describe("buildRotation", () => {
  const areas = [
    areaRow("Forest_A1", "SW.Area.Forest.A1", []),
    areaRow("Carapace_A1", "SW.Area.Carapace.A1", [], "SW_Area_Carapace_A1_SW_TextEntry_Name"),
  ];
  const loc = locales({
    "Text/Release/DT_AreaDefinition.csv": {
      SW_Area_Forest_A1_SW_TextEntry_Name: { en: "Howling Woods", zh: "咆哮森林", ja: "遠吠えの森" },
      SW_Area_Carapace_A1_SW_TextEntry_Name: { en: "Humbler Huskland", zh: "轟鳴蟲殼骸之地" },
    },
  });
  const markers = new Map([["sw.area.carapace.a1", { world: "sift" as const, px: 3316.9, py: 5462.7 }]]);

  it("keeps the table order, names each area and places it on the map", () => {
    const result = buildRotation(rotationRow(["SW.Area.Carapace.A1", "SW.Area.Forest.A1"]), areas, loc, markers);
    expect(result.rotation.map((area) => area.name.en)).toEqual(["Humbler Huskland", "Howling Woods"]);
    expect(result.rotation[0].map).toEqual({ world: "sift", px: 3316.9, py: 5462.7 });
    expect(result.rotation[1].map).toBeUndefined();
  });

  it("marks the whole list once for each language that fell back to English", () => {
    const result = buildRotation(rotationRow(["SW.Area.Carapace.A1", "SW.Area.Forest.A1"]), areas, loc, markers);
    expect(result.untranslated).toContain("ja");      // Carapace has no ja
    expect(result.untranslated).not.toContain("zh");
    expect(result.rotation[0].name.ja).toBe("Humbler Huskland");
  });

  it("reports an area with no name and shows its tag in English", () => {
    const result = buildRotation(rotationRow(["SW.Area.Plains.A9"]), areas, loc, markers);
    expect(result.issues).toEqual([{ type: "soul-storm-area-unnamed", detail: "SW.Area.Plains.A9" }]);
    expect(result.rotation[0].name.zh).toBe("Plains A9");
    expect(result.untranslated).toHaveLength(15);
  });
});
```

`locales` helper：既有的 `tests/helpers/locales.ts` 的 `makeLocales` 會把缺的語言補成英文，這樣 `englishFallbacks` 就測不到缺字。所以在同一個檔案加一個 `makeSparseLocales`：沒寫的語言就**沒有**這個鍵，連 en 也可以沒有。用 `byLang` 建構，**不可用 `as`**：

```ts
type SparseRows = Record<string, Record<string, Partial<Record<Lang, string>>>>;
/** Like makeLocales, but a language left out has no text at all (so englishFallbacks can see it). */
export function makeSparseLocales(rows: SparseRows): Record<Lang, LocaleFile> {
  const fileFor = (lang: Lang): LocaleFile =>
    Object.fromEntries(Object.entries(rows).map(([namespace, keys]) => [
      namespace,
      Object.fromEntries(Object.entries(keys).flatMap(([key, texts]) => { const text = texts[lang]; return text === undefined ? [] : [[key, text]]; })),
    ]));
  return byLang(fileFor);
}
```

`tests/unit/extract/soul-storm-texts.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { buildSoulStormTexts, firstParagraph } from "../../../scripts/extract/soul-storm-texts";
import { makeSparseLocales as locales } from "../../helpers/locales";

const ON = "Text/Release/OnboardingLabels.csv";
const TUTORIAL_EN = "Soul Storms are high paced combat areas that have increased quantity and re-spawn rate of hostile mobs. If you defeat a Soul Storm, you will be generously rewarded. \n\nThey appear randomly in the world every hour and last for around 40 minutes.";
const TUTORIAL_ZH = "靈魂風暴是節奏快速的戰鬥區域，其中敵對怪物的數量與重生率都會提高。平息靈魂風暴後，你將會獲得豐厚的獎勵。\n\n靈魂風暴每小時都會隨機出現在世界中，並持續約 40 分鐘。";

describe("firstParagraph", () => {
  it("keeps only the first of two paragraphs", () => {
    expect(firstParagraph(TUTORIAL_EN)).toBe("Soul Storms are high paced combat areas that have increased quantity and re-spawn rate of hostile mobs. If you defeat a Soul Storm, you will be generously rewarded.");
    expect(firstParagraph("a\r\n\r\nb")).toBe("a");
  });
  it("has nothing when the text is one paragraph", () => {
    expect(firstParagraph("one paragraph only")).toBeUndefined();
  });
});

describe("buildSoulStormTexts", () => {
  const loc = locales({
    [ON]: {
      tutoriallog_soulstorms_title: { en: "Soul Storms", zh: "靈魂風暴" },
      tutoriallog_soulstorms_description: { en: TUTORIAL_EN, zh: TUTORIAL_ZH, ja: "一段だけ" },
      panel_soulstorm_overview_description_1: { en: "Destroy the <emphasis>Storm Generators</>.", zh: "摧毀<emphasis>風暴產生器</>。" },
    },
  });

  it("never publishes the stale second paragraph in any language", () => {
    const { texts } = buildSoulStormTexts(loc);
    for (const html of Object.values(texts.tutorial.html)) {
      expect(html).not.toMatch(/40/);
      expect(html).not.toMatch(/every hour|每小時/);
    }
    expect(texts.tutorial.html.zh).toBe("靈魂風暴是節奏快速的戰鬥區域，其中敵對怪物的數量與重生率都會提高。平息靈魂風暴後，你將會獲得豐厚的獎勵。");
  });

  it("falls back to the English first paragraph where a language cannot be split", () => {
    const { texts } = buildSoulStormTexts(loc);
    expect(texts.tutorial.html.ja).toBe(texts.tutorial.html.en);
    expect(texts.tutorial.untranslated).toContain("ja");
    expect(texts.tutorial.untranslated).not.toContain("zh");
  });

  it("renders the game's emphasis markup", () => {
    expect(buildSoulStormTexts(loc).texts.overview1.html.zh).toBe('摧毀<em class="emphasis">風暴產生器</em>。');
  });

  it("leaves a text empty and reports it when the game has no English", () => {
    const { texts, issues } = buildSoulStormTexts(loc);
    expect(texts.extraEffect.html.en).toBe("");
    expect(issues).toContainEqual({ type: "soul-storm-text-fallback", detail: "LootItemPanelLabels.csv/SoulStormMessage" });
  });
});
```

- [ ] **Step 2：跑測試，確認失敗。**
- [ ] **Step 3：實作**
  - 時間戳記解析用 `/^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})$/`，再用 `Date.UTC(...)`，最後減掉 `offsetMinutes * 60_000`。
  - 用 `new Date(ms).getUTCMonth()` 回推檢查，月份或日期溢位（例如 13 月）就丟例外。
  - 區域名稱：沿用 `mob-areas.ts` 的作法，從 `TypeTextData.Texts` 中鍵含 `SW.TextEntry.Name` 的那筆取 `locRef`，再 `localize` 與 `englishFallbacks`。
  - 地圖標記用 `tagKey(tag)` 查。
  - 檔案都 ≤ 400 行，函式都 < 50 行。
- [ ] **Step 4：跑測試，確認通過**，再跑 tsc。
- [ ] **Step 5：對真資料做煙霧測試**（印出結果，不寫檔）：
  - 用 Task 1 的 loader、`loadMobTables`、`loadLocales('source-data')`、`areaMarkers(JSON.parse(src/data/map.json))` 跑 `buildRotation` 與 `buildSoulStormTexts`。
  - 預期：
    - 7 區英文名依序是 `Howling Woods, Singer's Meadow, Rainy Plains, Humbler Huskland, Lullaby Hills, Frozen Highlands, Honeycomb Fields`；
    - 7 區都有 `map`；
    - `untranslated` 是 `[]`；
    - 每個文字的 `untranslated` 都是 `[]`；
    - `texts.tutorial.html.en` 不含 `40`。
  - 有任何不同，先查明原因再寫進 ledger。
- [ ] **Step 6：Commit**：`feat: derive the Soul Storm schedule, rotation and official texts`

---

### Task 3: 產生器、寶箱、開放條件，並串進抽取流程

**Files:**
- Create: `scripts/extract/soul-storm-combat.ts`
- Create: `scripts/extract/soul-storm.ts`
- Modify: `scripts/extract/bestiary.ts`（LF）：`BestiaryResult.links`
- Modify: `scripts/extract/pipeline.ts`（LF）：
  - 規劃圖示並併入 `copyIcons`；
  - 呼叫 `extractSoulStorm`；
  - 寫出 `soul-storm.json`；
  - `tablesRead` 合併；
  - `ExtractOptions.soulStormStatusPath?`。
- Test: `tests/unit/extract/soul-storm-combat.test.ts`、`tests/unit/extract/soul-storm.test.ts`、`tests/integration/soul-storm.test.ts`
- 產物：`src/data/soul-storm.json`、`public/icons/soul-storm/{header,generator}.png`

**Interfaces:**
- Produces（`soul-storm-combat.ts`）：
  ```ts
  export function resolveSpawnMobs(spawns: readonly SpawnRow[], spawnTag: string): string[];   // 見 P6；回傳正規化（normalizeTag）後的 SW.Mob.* 標籤
  export function spawnWeights(spawns: readonly SpawnRow[]): Partial<Record<GeneratorTier, number>>;  // 取 TypeTag 為 SW.SpawnDefinition.Storminator 那列
  export interface GeneratorResult {
    readonly generators: Generator[]; readonly resistances: SoulStormData["resistances"];
    readonly shieldHealth: number | null; readonly issues: Issue[];
  }
  export function buildGenerators(tables: SoulStormTables, tagIndex: ReadonlyMap<string, string>): GeneratorResult;
  // 基礎列 = TypeTag 為 SW.PropActor.SoulStorm.Storminator.Base；各難度 = …Storminator.{Easy,Medium,Hard}；
  // health = 自己的 SW.Attribute.Health ?? 基礎列的；healthByPlayers = TagMap 中鍵含 AttributeName="HealthMax" 的 Multipliers（自己 ?? 基礎 ?? [1]）；
  // shield：自己的 SpawnShield 特化 ActivationChance（Int，百分比）/CooldownDuration，否則基礎能力的 CommonKeyValues；機率 0 → null；
  // finalSummon.healthFraction = 事件 SW.GameplayEvent.SoulStorm.Health.FinalThreshold 的 Value；
  // finalSummon.mobs = 能力 …StorminatorHealthFinalThreshold 的 WaveArray[].SpawnDefinition 經 resolveSpawnMobs、再經 tagIndex（tagKey）轉 slug，去重；
  // 對不到 slug 的標籤 → issue soul-storm-mob-unlinked "<tier>: <tag>"；
  // resistances 取基礎列：SoulDamageResistanceMultiplier→resistSoul、MeleeDamageResistanceMultiplier→resistMelee、
  // Resistance.KnockbackResistanceMultiplier→knockbackResistance，依此順序；shieldHealth = SW.PropActor.SoulStorm.Barrier 列的 Health ?? null。
  export function buildChests(rows: readonly LootRow[]): Chest[];        // 見 P5、P17；只收 TypeTag 以 SW.LootActor.StorminatorChest. 開頭且有 slot 的列
  export function chestRarity(rows: readonly RarityChanceRow[]): SoulStormData["chestRarity"];  // TypeTag 正好是 SW.LootActor.StorminatorChest 的列
  export function unlockOf(rows: readonly GameBalanceRow[]): SoulStormData["unlock"];           // 第一個非 "None" 的 SoulStormEligibilityGamestate
  ```
- Produces（`soul-storm.ts`）：
  ```ts
  export const SOUL_STORM_ICON_SOURCES: Readonly<Record<"header" | "generator", string>> = {
    header: "Plugins/SpicewoodUI/Content/Spicewood/UI/Widget/SoulStorm/T_UI_soulstorm_icon_tmp.png",
    generator: "Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/WorldMap/Icons/T_UI_Icon_Storminator.png",
  };
  export interface SoulStormInput {
    readonly sourceRoot: string;
    readonly locales: Readonly<Record<Lang, LocaleFile>>;
    readonly map: MapData;
    readonly links: BestiaryLinks;               // { tagIndex, areas }
    readonly icons: Readonly<Record<string, string>>;   // planAssets(...).paths
    readonly statusPath: string;
  }
  export interface SoulStormResult { readonly data: SoulStormData; readonly issues: Issue[]; readonly tablesRead: readonly string[] }
  export function extractSoulStorm(input: SoulStormInput): Promise<SoulStormResult>;
  // 讀 status（zod parse，失敗 → ExtractError 含檔名）→ loadSoulStormTables → 缺 schedule/rotation 時回傳 EMPTY_SOUL_STORM（verified 仍抄自 status、texts 仍產生、icons 仍填）＋ missing-soul-storm-tables；
  // 否則組出完整資料，最後 SoulStormDataSchema.parse；monstrosities = hard 的 finalSummon.mobs（P7）。
  ```
- Modifies（`bestiary.ts`）：
  ```ts
  export interface BestiaryLinks { readonly tagIndex: ReadonlyMap<string, string>; readonly areas: readonly AreaRow[] }
  export interface BestiaryResult { …既有…; readonly links: BestiaryLinks }   // 缺怪物表 → { tagIndex: new Map(), areas: [] }
  ```
  `loadAndBuildMobs` 已經有 `built.tagIndex`，往上傳即可。不要改任何既有輸出。

- [ ] **Step 1：寫失敗的測試**

`tests/unit/extract/soul-storm-combat.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { buildChests, buildGenerators, chestRarity, resolveSpawnMobs, spawnWeights, unlockOf } from "../../../scripts/extract/soul-storm-combat";
import { realSoulStormTables, REAL_BALANCE, soulStormTables } from "../../helpers/soul-storm-tables";

const TAG_INDEX = new Map([
  ["sw.mob.zombie.soulstated", "zombie"], ["sw.mob.vindicator.soulstated", "vindicator"],
  ["sw.mob.witch", "witch"], ["sw.mob.enderman", "enderman"], ["sw.mob.warden", "warden"], ["sw.mob.evoker", "evoker"],
  ["sw.mob.wellspringminiboss", "wellspring-miniboss"], ["sw.mob.driftweaver", "driftweaver"],
  ["sw.mob.monstrosity.copper.storm", "monstrosity-copper"], ["sw.mob.monstrosity.redstone.storm", "monstrosity-red-stone"],
  ["sw.mob.monstrosity.sculk.storm", "monstrosity-sculk"],
]);

describe("resolveSpawnMobs", () => {
  const { spawns } = realSoulStormTables();
  it("follows nested spawn definitions down to mob tags, in order", () => {
    expect(resolveSpawnMobs(spawns, "SW.SpawnDefinition.Storminator.Wave.Type3")).toEqual([
      "SW.Mob.Monstrosity.Copper.Storm", "SW.Mob.Monstrosity.RedStone.Storm", "SW.Mob.Monstrosity.Sculk.Storm",
    ]);
  });
  it("survives a cycle and an unknown tag", () => {
    const loop = soulStormTables({ spawns: [
      { Name: "A", TypeTag: { TagName: "SW.SpawnDefinition.A" }, SpawnDefinition: { SpawnSlot: { s: { SpawnTable: { Tags: [{ TypeTag: { TagName: "SW.SpawnDefinition.A" }, Weight: 1, Operation: "Set" }, { TypeTag: { TagName: "SW.Mob.Zombie" }, Weight: 1, Operation: "Set" }] } } } } },
    ] }).spawns;
    expect(resolveSpawnMobs(loop, "SW.SpawnDefinition.A")).toEqual(["SW.Mob.Zombie"]);
    expect(resolveSpawnMobs(loop, "SW.SpawnDefinition.Missing")).toEqual([]);
  });
});

describe("spawnWeights", () => {
  it("reads the 2:2:1 generator weights", () => {
    expect(spawnWeights(realSoulStormTables().spawns)).toEqual({ easy: 2, medium: 2, hard: 1 });
  });
});

describe("buildGenerators", () => {
  const result = buildGenerators(realSoulStormTables(), TAG_INDEX);
  const byTier = Object.fromEntries(result.generators.map((generator) => [generator.tier, generator]));

  it("lists the three tiers in order", () => {
    expect(result.generators.map((generator) => generator.tier)).toEqual(["easy", "medium", "hard"]);
  });
  it("gives Easy the base row's 800 health and the others their own", () => {
    expect(result.generators.map((generator) => generator.health)).toEqual([800, 1000, 1200]);
    expect(byTier.easy.healthByPlayers).toEqual([1, 1.5, 2, 2.5]);
  });
  it("has no shield generator on Easy and the specialised chance on the others", () => {
    expect(byTier.easy.shield).toBeNull();
    expect(byTier.medium.shield).toEqual({ chance: 0.16, cooldownSeconds: 60 });
    expect(byTier.hard.shield).toEqual({ chance: 0.4, cooldownSeconds: 45 });
  });
  it("names what each tier summons at its final threshold", () => {
    expect(byTier.easy.finalSummon).toEqual({ healthFraction: 0.2, mobs: ["zombie", "vindicator"] });
    expect(byTier.medium.finalSummon).toEqual({ healthFraction: 0.4, mobs: ["witch", "enderman", "warden", "evoker", "wellspring-miniboss", "driftweaver"] });
    expect(byTier.hard.finalSummon).toEqual({ healthFraction: 0.4, mobs: ["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"] });
  });
  it("carries the weights, the base resistances and the shield generator's health", () => {
    expect(result.generators.map((generator) => generator.spawnWeight)).toEqual([2, 2, 1]);
    expect(result.resistances).toEqual([{ key: "resistSoul", value: 0.5 }, { key: "resistMelee", value: 0.8 }, { key: "knockbackResistance", value: 0 }]);
    expect(result.shieldHealth).toBe(55);
    expect(result.issues).toEqual([]);
  });
  it("reports a summoned mob the bestiary does not know, and leaves it out", () => {
    const partial = new Map([...TAG_INDEX].filter(([key]) => key !== "sw.mob.warden"));
    const medium = buildGenerators(realSoulStormTables(), partial);
    expect(medium.generators[1].finalSummon.mobs).not.toContain("warden");
    expect(medium.issues).toEqual([{ type: "soul-storm-mob-unlinked", detail: "medium: SW.Mob.Warden" }]);
  });
});

describe("buildChests", () => {
  const chests = buildChests(realSoulStormTables().lootActor);
  it("keeps the six storm chests in generator then final order, and nothing else", () => {
    expect(chests.map((chest) => `${chest.group}:${chest.tier}`)).toEqual([
      "generator:easy", "generator:medium", "generator:hard", "final:low", "final:medium", "final:high",
    ]);
  });
  it("describes each slot as guaranteed plus rolls, with no item list for gear", () => {
    const high = chests[5];
    expect(high.id).toBe("SoulStormRewardChestHigh");
    expect(high.slots).toEqual([
      { slot: "item", guaranteed: 4, rolls: 0, chancePerRoll: 1, pool: "none" },
      { slot: "emeralds", guaranteed: 10, rolls: 15, chancePerRoll: 0.3, pool: "own" },
      { slot: "springStone", guaranteed: 4, rolls: 3, chancePerRoll: 0.33, pool: "own" },
    ]);
    expect(chests[0].slots.find((s) => s.slot === "springStone")).toEqual({ slot: "springStone", guaranteed: 1, rolls: 2, chancePerRoll: 0.33, pool: "own" });
  });
});

describe("chestRarity and unlockOf", () => {
  it("reads the storm chest rarity multipliers", () => {
    expect(chestRarity(realSoulStormTables().rarityChance)).toEqual({ common: 0, rare: 0.01 });
    expect(chestRarity([])).toBeNull();
  });
  it("finds the main-quest gate and nothing when every rule set says None", () => {
    expect(unlockOf(realSoulStormTables().gameBalance)).toEqual({ gameState: "SW.GameState.MainQuestComplete" });
    expect(unlockOf(soulStormTables({ gameBalance: [REAL_BALANCE()[0]] }).gameBalance)).toBeNull();
  });
});
```

（slot 的順序依 `LOOT_SLOT_KEYS`（`item, specialGear, enchantedBook, talismans, emeralds, springStone, …`），所以綠寶石排在回聲碎片前面。如果 `slotsOf` 的實際順序不同，以 `LOOT_SLOT_KEYS` 為準修測試，並記進 ledger。）

`tests/unit/extract/soul-storm.test.ts`：

- 用 `vi.mock` 或暫存目錄建一個最小的 source root，裡面放 `DT_*` 與 `soul-storm-status.json`。
- 驗證：
  - `verified` 等於 status 檔的值：分別寫 `false` 與 `true` 跑兩次；
  - `monstrosities` 等於 hard 的 `finalSummon.mobs`；
  - 缺時程表 → `EMPTY_SOUL_STORM` 的結構，加上 `missing-soul-storm-tables`，`texts` 仍有內容；
  - status 檔壞掉（`"verified": "no"`）→ 丟出含檔名的錯誤；
  - `tablesRead` 不含任何 `/constants/i`。

`tests/integration/soul-storm.test.ts`：照 `tests/integration/bestiary.test.ts` 的假 source-data 寫法，`runExtract` 之後：
- `src/data/soul-storm.json`（暫存 outRoot 下）通過 `SoulStormDataSchema.parse`；
- `rotation` 有 7 筆；
- `public/icons/soul-storm/generator.png` 存在（假 source 放一張 1×1 PNG）；
- 報告含 `soul-storm` 段落，或至少不丟例外；
- `summary.tablesRead` 包含 `DT_SoulStormTimeSchedule.json`，不含 `/constants/i`。

既有的 `tests/unit/extract/telemetry-key.test.ts` 不需改，它會自動掃到新的 JSON 與新的 `.ts`。

另外在 `tests/unit/extract/soul-storm-schema.test.ts` 加一個 status 一致性測試（P1）：

```ts
it("publishes the same verified flag as the hand-kept status file", () => {
  const out = path.resolve(__dirname, "../../../src/data/soul-storm.json");
  if (!existsSync(out)) return;   // 第一次抽取前沒有輸出；Task 3 Step 6 之後一定存在
  const data = SoulStormDataSchema.parse(JSON.parse(readFileSync(out, "utf8")));
  const status = SoulStormStatusSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/extract/soul-storm-status.json"), "utf8")));
  expect(data.verified).toBe(status.verified);
  expect(data.schedule.rotationOffset).toBe(status.rotationOffset);
  expect(data.schedule.anchorOffsetMinutes).toBe(status.anchorOffsetMinutes);
});
```

- [ ] **Step 2：跑測試，確認失敗**：
  `npx vitest run tests/unit/extract/soul-storm-combat.test.ts tests/unit/extract/soul-storm.test.ts tests/integration/soul-storm.test.ts`
- [ ] **Step 3：實作**
  - `soul-storm-combat.ts` 拆成小函式：`rowByTag`、`attribute`、`keyValueOf`、`shieldOf`、`finalOf`、`scalingOf`、`toSlugs`。
  - `pipeline.ts`（改前先數 CR）：
    1. 在 `brand` 之後加
       `const soulStormIcons = planAssets(options.sourceRoot, options.outRoot, SOUL_STORM_ICON_SOURCES, "soul-storm", "missing-ui-icon");`
       並把 `...soulStormIcons.copies` 加進 `copyIcons` 的陣列。
    2. 在 `extractBestiary` 之後加：
       ```ts
       const soulStorm = await extractSoulStorm({
         sourceRoot, locales, map: map.data, links: bestiary.links, icons: soulStormIcons.paths,
         statusPath: options.soulStormStatusPath ?? path.join(path.dirname(options.overridesPath), "soul-storm-status.json"),
       });
       ```
    3. `issues` 加 `...soulStormIcons.issues, ...soulStorm.issues`。
    4. `extraData` 加 `"soul-storm.json": soulStorm.data`。
    5. 回傳值的 `tablesRead` 改成 `[...bestiary.tablesRead, ...soulStorm.tablesRead]`。
  - 改完 `pipeline.ts` 應 < 260 行。
- [ ] **Step 4：跑測試，確認通過**：`npx vitest run`（全部單元＋整合），再跑 tsc。
- [ ] **Step 5：對真資料做煙霧測試**（不寫檔）：用真資料呼叫 `extractSoulStorm`（`links` 用 `extractBestiary` 的結果），印出：
  - `generators` 的 tier、health、shield、finalSummon；
  - `chests` 的 id 與 slots；
  - `chestRarity`、`unlock`、`monstrosities`；
  - `issues`。

  預期值全部等於 spec §2.3、§2.4、§2.6、§2.9，`issues` 是 `[]`。不符時查明原因：
  - 圖鑑 slug 不同 → 以資料為準，修測試的期望值，並寫進 ledger；
  - 資料與 spec 不同 → 停下來，依 prompt 的規則判斷要不要問使用者。
- [ ] **Step 6：真資料抽取並檢查**：
  1. `npm run extract`，然後 `git status`、`git diff --stat src/data public`。
  2. 確認：
     - 新增 `src/data/soul-storm.json`，且 < 50 KB（`ls -l`）；
     - 新增 `public/icons/soul-storm/header.png` 與 `generator.png`；
     - `extract-report.md` 沒有 `soul-storm-*` 問題。
  3. 其他 `src/data/*.json` 或 `public/**` 的變動：逐一看 diff。無關的變動就還原（`git checkout -- <file>`），並寫進 ledger（P16）。
  4. 再跑 `npx vitest run tests/unit/extract/telemetry-key.test.ts tests/unit/extract/soul-storm-schema.test.ts`。
- [ ] **Step 7：Commit**，分兩個：
  - `feat: extract Soul Storm generators, chests and unlock into soul-storm.json`（程式與測試）；
  - `chore: generate Soul Storm data and icons`（`src/data/soul-storm.json`、`public/icons/soul-storm/`）。

---

### Task 4: 時程計算（瀏覽器端純函式，決定性測試）

**Files:**
- Create: `src/lib/soul-storm-schedule.ts`（**沒有任何 import**）
- Modify: `vitest.config.ts`（LF）：`coverage.include` 加 `"src/lib/soul-storm-schedule.ts"`（P3）
- Test: `tests/unit/site/soul-storm-schedule.test.ts`

**Interfaces:**
- Produces：
  ```ts
  export interface StormSchedule {
    readonly anchorMs: number; readonly durationMs: number; readonly cadenceMs: number;
    readonly areaCount: number; readonly rotationOffset: number;
  }
  export interface StormWindow { readonly index: number; readonly areaIndex: number; readonly startMs: number; readonly endMs: number }
  /** active: `window` is the running storm and msLeft counts to its end; otherwise `window` is the next one and msLeft counts to its start. */
  export interface StormState { readonly active: boolean; readonly window: StormWindow; readonly msLeft: number }
  export interface ClockArea { readonly name: string; readonly href: string }
  export interface ClockLabels { readonly now: string; readonly next: string; readonly endsIn: string; readonly startsIn: string; readonly timeZone: string }
  export interface ClockPayload extends StormSchedule { readonly areas: readonly ClockArea[]; readonly labels: ClockLabels; readonly upcoming: number }

  export function windowAt(schedule: StormSchedule, index: number): StormWindow;
  export function stormState(schedule: StormSchedule, nowMs: number): StormState;
  export function upcomingWindows(schedule: StormSchedule, nowMs: number, count: number): StormWindow[];
  export function formatCountdown(ms: number): string;     // ceil 到秒；"m:ss"，≥ 1 小時 "h:mm:ss"；≤ 0 → "0:00"
  export function formatWindowTime(ms: number, locale: string, timeZone?: string): string;
  // new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(ms)
  export function parseClockPayload(raw: unknown): ClockPayload | undefined;  // 手寫型別守衛；任何欄位不對、areaCount < 1、areas.length !== areaCount、cadence <= duration → undefined
  ```
  - `areaIndex = mod(index + rotationOffset, areaCount)`，其中 `mod` 對負數也回傳 `[0, n)`。
  - `index = Math.floor((nowMs − anchorMs) / cadenceMs)`；`active = nowMs < startMs + durationMs`。

- [ ] **Step 1：寫失敗的測試** `tests/unit/site/soul-storm-schedule.test.ts`。

  數字取自真資料：錨點 `2026-01-01T00:00:00Z` = `1767225600000`；每場 20 分；每 40 分一場；7 區。

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeImports } from "./client-bundle.test";
import {
  formatCountdown, formatWindowTime, parseClockPayload, stormState, upcomingWindows, windowAt, type StormSchedule,
} from "../../../src/lib/soul-storm-schedule";

const ANCHOR = Date.UTC(2026, 0, 1);            // 1767225600000
const MIN = 60_000;
const S: StormSchedule = { anchorMs: ANCHOR, durationMs: 20 * MIN, cadenceMs: 40 * MIN, areaCount: 7, rotationOffset: 0 };
const AREAS = ["Howling Woods", "Singer's Meadow", "Rainy Plains", "Humbler Huskland", "Lullaby Hills", "Frozen Highlands", "Honeycomb Fields"];
const at = (iso: string): number => Date.parse(iso);

describe("windowAt", () => {
  it("places window 0 on the anchor and wraps the rotation every 7 windows", () => {
    expect(windowAt(S, 0)).toEqual({ index: 0, areaIndex: 0, startMs: ANCHOR, endMs: ANCHOR + 20 * MIN });
    expect(windowAt(S, 7).areaIndex).toBe(0);
    expect(windowAt(S, 7).startMs).toBe(at("2026-01-01T04:40:00Z"));
    expect(windowAt(S, -1)).toEqual({ index: -1, areaIndex: 6, startMs: at("2025-12-31T23:20:00Z"), endMs: at("2025-12-31T23:40:00Z") });
  });
  it("applies the rotation offset", () => {
    expect(windowAt({ ...S, rotationOffset: 2 }, 0).areaIndex).toBe(2);
    expect(windowAt({ ...S, rotationOffset: 2 }, 5).areaIndex).toBe(0);
  });
});

describe("stormState at the edges of a window", () => {
  it("is active from the first millisecond", () => {
    expect(stormState(S, ANCHOR)).toEqual({ active: true, window: windowAt(S, 0), msLeft: 20 * MIN });
  });
  it("is still active one second before the end", () => {
    expect(stormState(S, ANCHOR + 20 * MIN - 1000)).toMatchObject({ active: true, msLeft: 1000 });
  });
  it("is over exactly at the end, and points at the next window", () => {
    expect(stormState(S, ANCHOR + 20 * MIN)).toEqual({ active: false, window: windowAt(S, 1), msLeft: 20 * MIN });
  });
  it("counts the last millisecond before the next start", () => {
    expect(stormState(S, ANCHOR + 40 * MIN - 1)).toMatchObject({ active: false, msLeft: 1, window: { index: 1, areaIndex: 1 } });
  });
  it("starts the next storm in the next area", () => {
    expect(stormState(S, ANCHOR + 40 * MIN)).toMatchObject({ active: true, window: { index: 1, areaIndex: 1 } });
  });
  it("handles a time before the anchor", () => {
    expect(stormState(S, ANCHOR - 1000)).toEqual({ active: false, window: windowAt(S, 0), msLeft: 1000 });
  });
});

describe("stormState on real dates", () => {
  it("2026-10-11 00:00 UTC is window 10188, Humbler Huskland, 20 minutes left", () => {
    const state = stormState(S, at("2026-10-11T00:00:00Z"));
    expect(state).toMatchObject({ active: true, msLeft: 20 * MIN, window: { index: 10188, areaIndex: 3 } });
    expect(AREAS[state.window.areaIndex]).toBe("Humbler Huskland");
  });
  it("2026-10-11 00:25 UTC waits 15 minutes for Lullaby Hills", () => {
    const state = stormState(S, at("2026-10-11T00:25:00Z"));
    expect(state).toMatchObject({ active: false, msLeft: 15 * MIN, window: { index: 10189, areaIndex: 4, startMs: at("2026-10-11T00:40:00Z") } });
    expect(AREAS[state.window.areaIndex]).toBe("Lullaby Hills");
  });
  it("moves one area along per day (36 windows a day, 36 mod 7 = 1)", () => {
    expect(stormState(S, at("2026-10-12T00:00:00Z")).window.areaIndex).toBe(4);
  });
});

describe("upcomingWindows", () => {
  it("starts with the running storm", () => {
    expect(upcomingWindows(S, ANCHOR, 3).map((w) => w.index)).toEqual([0, 1, 2]);
  });
  it("starts with the next storm between storms", () => {
    expect(upcomingWindows(S, ANCHOR + 20 * MIN, 3).map((w) => w.index)).toEqual([1, 2, 3]);
  });
  it("covers a full rotation with seven windows", () => {
    expect(new Set(upcomingWindows(S, ANCHOR, 7).map((w) => w.areaIndex)).size).toBe(7);
  });
});

describe("formatCountdown", () => {
  it("rounds up to the second and grows an hour field when needed", () => {
    expect(formatCountdown(20 * MIN)).toBe("20:00");
    expect(formatCountdown(20 * MIN - 1)).toBe("20:00");
    expect(formatCountdown(1000)).toBe("0:01");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(60 * MIN)).toBe("1:00:00");
  });
});

describe("formatWindowTime in the viewer's time zone", () => {
  const start = at("2026-10-11T00:00:00Z");
  it("shows Taipei time", () => {
    expect(formatWindowTime(start, "zh-TW", "Asia/Taipei")).toContain("08:00");
  });
  it("shows New York time, a day earlier", () => {
    const text = formatWindowTime(start, "en-US", "America/New_York");
    expect(text).toContain("20:00");
    expect(text).toMatch(/Sat/);   // 2026-10-10 is a Saturday
  });
  it("follows daylight saving: two windows 40 minutes apart read 01:20 then 01:00 on 2026-11-01 in New York", () => {
    const before = windowAt(S, Math.floor((at("2026-11-01T05:20:00Z") - ANCHOR) / S.cadenceMs));
    expect(before.startMs).toBe(at("2026-11-01T05:20:00Z"));
    expect(formatWindowTime(before.startMs, "en-US", "America/New_York")).toContain("01:20");
    expect(formatWindowTime(before.startMs + S.cadenceMs, "en-US", "America/New_York")).toContain("01:00");
  });
});

describe("parseClockPayload", () => {
  const good = {
    ...S, upcoming: 7,
    areas: AREAS.map((name) => ({ name, href: "/en/map/" })),
    labels: { now: "Now: {area}", next: "Next: {area}", endsIn: "{time} left", startsIn: "starts in {time}", timeZone: "Times are in your time zone: {zone}" },
  };
  it("accepts the page's payload", () => {
    expect(parseClockPayload(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });
  it("rejects anything malformed instead of throwing", () => {
    for (const bad of [null, "x", { ...good, areaCount: 0 }, { ...good, areas: good.areas.slice(1) }, { ...good, cadenceMs: good.durationMs }, { ...good, labels: { ...good.labels, now: 1 } }]) {
      expect(parseClockPayload(bad)).toBeUndefined();
    }
  });
});

describe("the module itself", () => {
  it("imports nothing, so the browser bundle stays small", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../src/lib/soul-storm-schedule.ts"), "utf8");
    expect(runtimeImports(source)).toEqual([]);
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
```

（從 `client-bundle.test.ts` 引入 `runtimeImports` 是既有的匯出。如果在測試檔之間引入會造成重複執行或其他問題，就把 `runtimeImports` 抽到 `tests/helpers/imports.ts`，兩邊共用。這種小重構可以順手做，記進 ledger。）

- [ ] **Step 2：跑測試，確認失敗**：`npx vitest run tests/unit/site/soul-storm-schedule.test.ts`
- [ ] **Step 3：實作**
  - 全部是純函式，不用 `Date.now()`：時間一律由參數傳入。
  - `parseClockPayload` 拆成小守衛：`isRecord`、`isFiniteNumber`、`isArea`、`isLabels`。
  - 改 `vitest.config.ts` 前先數 CR。
- [ ] **Step 4：跑測試，確認通過**，再跑 `npm run test:coverage`：四項都 ≥ 80%，而且 `soul-storm-schedule.ts` 本身應接近 100%。最後跑 tsc。
- [ ] **Step 5：Commit**：`feat: compute Soul Storm windows and countdowns in a dependency-free module`

---

### Task 5: 介面字串（16 種語言）

**Files:**
- Modify: `src/i18n/*.json`（16 個，LF；改前逐一數 CR）
- Modify: `scripts/extract/ui-game-keys.json`（LF）：加 `"soulStorm": { "namespace": "Text/Release/OnboardingLabels.csv", "key": "tutoriallog_soulstorms_title" }`
- Modify: `tests/unit/site/ui-translations.test.ts`（LF）
- 產物：`src/data/ui-game-strings.json`（重新抽取後會有 `soulStorm`）

**新鍵**：`soulStorm` 是遊戲字串鍵，**不列** `_machine`。其餘 37 個鍵在 14 種語言中機器翻譯，列進 `_machine`。zh、en 逐字如下：

| 鍵 | zh | en |
|---|---|---|
| `soulStorm` | 靈魂風暴 | Soul Storms |
| `soulStormIntro` | 靈魂風暴的即時時程、區域輪替、風暴產生器與獎勵寶箱。 | Live Soul Storm schedule, area rotation, Storm Generators and reward chests. |
| `soulStormSchedule` | 時程與區域輪替 | Schedule and area rotation |
| `soulStormUnverified` | 推算時刻，尚未經遊戲內確認 | Estimated times, not yet confirmed in game |
| `soulStormNow` | 進行中：{area} | Now: {area} |
| `soulStormNext` | 下一場：{area} | Next: {area} |
| `soulStormEndsIn` | 剩 {time} | {time} left |
| `soulStormStartsIn` | {time} 後開始 | starts in {time} |
| `soulStormUpcoming` | 接下來的時段 | Upcoming storms |
| `soulStormColStart` | 開始 | Starts |
| `soulStormColArea` | 區域 | Area |
| `soulStormTimeZone` | 時間以你的時區顯示：{zone} | Times are in your time zone: {zone} |
| `soulStormCadence` | 每 {cadence} 分鐘一場，每場持續 {duration} 分鐘，區域依下列順序輪替。 | A storm starts every {cadence} minutes and lasts {duration} minutes; the areas take turns in the order below. |
| `soulStormNoScript` | 開啟 JavaScript 才能看到倒數。 | Turn on JavaScript to see the countdown. |
| `soulStormNoData` | 目前沒有時程資料。 | There is no schedule data yet. |
| `soulStormUnlock` | 開放條件 | Unlock |
| `soulStormUnlockMainQuest` | 完成主線故事後開放。 | Available after you complete the main story. |
| `soulStormTier` | 難度 | Difficulty |
| `soulStormTierEasy` | 簡單 | Easy |
| `soulStormTierMedium` | 中等 | Medium |
| `soulStormTierHard` | 困難 | Hard |
| `soulStormHealthByPlayers` | 1–4 名玩家時生命 ×{list} | Health with 1–4 players: ×{list} |
| `soulStormSpawnWeight` | 出現權重 | Spawn weight |
| `soulStormShield` | 護盾產生器 | Shield Generator |
| `soulStormShieldRule` | {chance} 機率召喚，冷卻 {seconds} 秒 | {chance} chance, {seconds} s cooldown |
| `soulStormShieldNone` | 不召喚 | None |
| `soulStormFinalSummon` | 生命降到 {percent} 時召喚其中之一 | At {percent} health, summons one of |
| `soulStormResistances` | 三種難度的抗性相同： | All three difficulties share these resistances: |
| `soulStormChests` | 獎勵寶箱 | Reward chests |
| `soulStormChestsGenerator` | 摧毀風暴產生器後 | From a destroyed Storm Generator |
| `soulStormChestsFinal` | 平息風暴後 | For quelling the storm |
| `soulStormChestLow` | 低 | Low |
| `soulStormChestMedium` | 中 | Medium |
| `soulStormChestHigh` | 高 | High |
| `soulStormTierUnconfirmed` | 條件未確認 | Conditions unconfirmed |
| `soulStormRarity` | 依遊戲資料，風暴寶箱的品質權重：一般 ×{common}、稀有 ×{rare} | Per the game data, storm chests weight rarities: Common ×{common}, Rare ×{rare} |
| `soulStormMonstrosities` | 風暴巨獸 | Storm Monstrosities |
| `soulStormMonstrositiesNote` | 困難的風暴產生器會召喚以下其中一隻。 | A Hard Storm Generator summons one of these. |

各語言檔的 `soulStorm` 值：zh、en 用上表；其他 14 個語言的值用 `source-data/Localization/All/<culture>/All.json` 的 `tutoriallog_soulstorms_title` 原文（用 node 讀出來貼上），作為後備值。

機器翻譯的原則：
- 遊戲有官方用詞的，沿用遊戲用詞，例如風暴產生器、回聲碎片、難度、稀有度名稱。可以用 node 對各語系 `All.json` 搜尋後採用。
- 有疑慮的鍵（不確定語氣、詞序或數字格式是否通順）：值改成英文原文，列進該檔 `_english`（不列 `_machine`），並加進測試的 `ENGLISH_FALLBACK`。

- [ ] **Step 1：寫失敗的測試**（加在 `ui-translations.test.ts` 最後一個 `describe` 內）：

```ts
it("keeps the Soul Storm placeholders in every language", () => {
  const needs: Record<string, readonly string[]> = {
    soulStormNow: ["{area}"], soulStormNext: ["{area}"], soulStormEndsIn: ["{time}"], soulStormStartsIn: ["{time}"],
    soulStormTimeZone: ["{zone}"], soulStormCadence: ["{cadence}", "{duration}"], soulStormHealthByPlayers: ["{list}"],
    soulStormShieldRule: ["{chance}", "{seconds}"], soulStormFinalSummon: ["{percent}"], soulStormRarity: ["{common}", "{rare}"],
  };
  for (const lang of LANGS) {
    for (const [key, placeholders] of Object.entries(needs)) {
      const text = plainText(UI_DICTS[lang].values[key] ?? "");
      for (const placeholder of placeholders) expect(text, `${lang}.${key}`).toContain(placeholder);
    }
  }
});

it("has every Soul Storm key in every language and names it in the menu language", () => {
  const keys = Object.keys(UI_DICTS.zh.values).filter((key) => key.startsWith("soulStorm"));
  expect(keys).toHaveLength(38);
  for (const lang of LANGS) for (const key of keys) expect(UI_DICTS[lang].values[key], `${lang}.${key}`).toBeTypeOf("string");
  expect(plainText(UI_DICTS.zh.values.soulStorm ?? "")).toBe("靈魂風暴");
  expect(plainText(UI_DICTS.en.values.soulStorm ?? "")).toBe("Soul Storms");
});

it("translates the Soul Storm warning instead of copying English", () => {
  for (const lang of TRANSLATED) {
    if (UI_DICTS[lang].english.includes("soulStormUnverified")) continue;
    expect(UI_DICTS[lang].values.soulStormUnverified, lang).not.toEqual(UI_DICTS.en.values.soulStormUnverified);
  }
});
```

- [ ] **Step 2：跑測試，確認失敗**：`npx vitest run tests/unit/site/ui-translations.test.ts tests/unit/site/i18n.test.ts`
- [ ] **Step 3：實作**
  - 照上表加鍵，保留原檔的換行與縮排。
  - 14 個語言檔的 `_machine` 各加 37 個鍵（扣掉移到 `_english` 的）。
  - `ui-game-keys.json` 加 `soulStorm`。
- [ ] **Step 4：跑測試，確認通過**：`npx vitest run tests/unit/site tests/unit/extract/ui-game-strings.test.ts`，再跑 tsc。
- [ ] **Step 5：抽取一次，確認遊戲字串**：
  - `npm run extract`；
  - `node -e` 確認 `src/data/ui-game-strings.json` 的 `soulStorm` 在 16 語都有值；
  - `extract-report.md` 沒有 `missing-ui-game-string`；
  - 其他 `src/data` 變動照 P16 處理。
- [ ] **Step 6：Commit**：`feat: add Soul Storm UI strings in 16 languages`。如果 `ui-game-strings.json` 有變動，另開一個 `chore: regenerate game UI strings`。

---

### Task 6: 頁面、元件、client 時程元件與選單

**Files:**
- Create: `src/lib/soul-storm.ts`（伺服器端：zod parse、格式化、payload）
- Create: `src/components/SoulStormClock.astro`（bundled script：只 `import` `../lib/soul-storm-schedule`）
- Create: `src/components/SoulStormRotation.astro`、`SoulStormGenerators.astro`、`SoulStormChests.astro`
- Create: `src/pages/[lang]/soul-storm.astro`
- Create: `src/styles/soul-storm.css`
- Modify: `src/lib/site-menu.ts`（LF）：在 `mobs` 之後加 `{ key: "soulStorm", segment: "soul-storm" }`
- Test: `tests/unit/site/soul-storm.test.ts`、`tests/unit/components/soul-storm-page.test.ts`

**Interfaces:**
- Produces（`src/lib/soul-storm.ts`）：
  ```ts
  export const soulStormData: SoulStormData;                      // SoulStormDataSchema.parse(raw)
  export const scheduleOf: (data: SoulStormData) => StormSchedule;  // anchorMs = Date.parse(anchorUtc)，秒 → ms，areaCount = rotation.length
  export function clockPayload(lang: Lang, data?: SoulStormData): ClockPayload | undefined;  // rotation 空 → undefined；areas[i] = { name: rotation[i].name[lang], href: mapLinkOf(lang, rotation[i]) }；upcoming 7
  export const hasSchedule: (data: SoulStormData) => boolean;     // rotation.length > 0 && cadenceSeconds > 0
  export const textOf: (data: SoulStormData, id: TextId, lang: Lang) => { html: string; untranslated: boolean } | undefined;  // html 空 → undefined
  export const generatorTierLabel: (tier: Generator["tier"], lang: Lang) => string;
  export const chestLabel: (chest: Chest, lang: Lang) => string;  // group generator → soulStormTier*；final → soulStormChest*
  export const formatMultipliers: (values: readonly number[]) => string;   // [1,1.5,2,2.5] → "1 / 1.5 / 2 / 2.5"
  export const summonedMobs: (slugs: readonly string[]) => Mob[];  // findMob；找不到就略過（抽取端已報告）
  ```
- 頁面結構與 test id（E2E 依賴，逐字照用）：
  - `data-testid="soul-storm-intro"`：overview1、overview2、tutorial；
  - `data-testid="soul-storm-schedule"`：段落，內含：
    - `data-testid="soul-storm-unverified"`（`verified:false` 才輸出）；
    - `data-testid="soul-storm-cadence"`（靜態句，永遠輸出）；
    - `<noscript data-testid="soul-storm-noscript">`；
    - `data-testid="soul-storm-clock"`（元件根元素，帶 `hidden`，script 成功後才移除），其中有：
      - `data-testid="soul-storm-status"`（「進行中：X」或「下一場：X」）；
      - `data-testid="soul-storm-countdown"`；
      - `data-testid="soul-storm-timezone"`；
      - `<table data-testid="soul-storm-upcoming">`；
    - `<ol data-testid="soul-storm-rotation">`，7 個 `<li><a href=地圖連結>`。
  - `data-testid="soul-storm-unlock"`：`unlock` 為 null 時不輸出；
  - `data-testid="soul-storm-generators"`；
  - `data-testid="soul-storm-chests"`：兩個 `.soul-storm-chest-group`，每組標題旁各一個 `data-testid="soul-storm-unconfirmed"`；
  - `data-testid="soul-storm-monstrosities"`：用 `MobCard`；
  - 資料註記：`mobDropsNote`，`data-testid="soul-storm-note"`。
- 「未翻譯」標記的規則：
  - 頁首：`texts.title` 未翻譯時一個；
  - 介紹段：三段之中任一未翻譯時一個；
  - 輪替：`rotationUntranslated` 含當前語言時一個；
  - 產生器段：`generatorName`、`generatorHint`、`shieldHint` 任一未翻譯時一個；
  - 寶箱段：`extraEffect` 未翻譯時一個。
  - 每段最多一個。

- [ ] **Step 1：寫失敗的測試**

`tests/unit/site/soul-storm.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { chestLabel, clockPayload, formatMultipliers, scheduleOf, soulStormData, summonedMobs } from "../../../src/lib/soul-storm";
import { parseClockPayload, stormState } from "../../../src/lib/soul-storm-schedule";
import { SITE_MENU } from "../../../src/lib/site-menu";

describe("Soul Storm site data", () => {
  it("turns the extracted schedule into the real anchor and lengths", () => {
    expect(scheduleOf(soulStormData)).toEqual({ anchorMs: Date.UTC(2026, 0, 1), durationMs: 1_200_000, cadenceMs: 2_400_000, areaCount: 7, rotationOffset: 0 });
  });
  it("builds a payload the browser module accepts, in the page language", () => {
    const payload = clockPayload("zh");
    expect(parseClockPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
    expect(payload?.areas.map((area) => area.name)).toEqual(["咆哮森林", "吟唱者草甸", "多雨平原", "轟鳴蟲殼骸之地", "安眠丘陵", "冰封高地", "蜂巢原野"]);
    expect(payload?.areas[3].href).toMatch(/^\/zh\/map\/\?world=sift#4\//);
    expect(payload?.labels.now).toBe("進行中：{area}");
  });
  it("agrees with the browser module on a real instant", () => {
    const state = stormState(scheduleOf(soulStormData), Date.parse("2026-10-11T00:00:00Z"));
    expect(soulStormData.rotation[state.window.areaIndex].name.en).toBe("Humbler Huskland");
  });
  it("labels chests by group", () => {
    const [easy, , , low] = soulStormData.chests;
    expect(chestLabel(easy, "zh")).toBe("簡單");
    expect(chestLabel(low, "zh")).toBe("低");
  });
  it("formats the player multipliers and finds the summoned mobs", () => {
    expect(formatMultipliers([1, 1.5, 2, 2.5])).toBe("1 / 1.5 / 2 / 2.5");
    expect(summonedMobs(soulStormData.monstrosities).map((mob) => mob.slug)).toEqual(["monstrosity-copper", "monstrosity-red-stone", "monstrosity-sculk"]);
  });
  it("lists the page in the menu after the bestiary", () => {
    expect(SITE_MENU.map((item) => item.segment)).toEqual(["map", "achievements", "mobs", "soul-storm"]);
  });
});
```

`tests/unit/components/soul-storm-page.test.ts`（Astro container，照 `mob-page.test.ts` 的寫法；頁面要能接受 `data` prop 以便注入假資料，預設用 `soulStormData`）：

```ts
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import SoulStormPage from "../../../src/pages/[lang]/soul-storm.astro";
import { soulStormData } from "../../../src/lib/soul-storm";
import type { SoulStormData } from "../../../scripts/extract/soul-storm-schema";

let container: AstroContainer;
beforeAll(async () => { container = await AstroContainer.create(); });
const render = (lang: string, data: SoulStormData = soulStormData) => container.renderToString(SoulStormPage, { props: { lang, data }, params: { lang } });
const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("Soul Storm page", () => {
  it("warns once that the times are estimated while unverified", async () => {
    const html = await render("zh");
    expect(count(html, 'data-testid="soul-storm-unverified"')).toBe(1);
    expect(html).toContain("推算時刻，尚未經遊戲內確認");
  });
  it("drops the warning once verified", async () => {
    expect(await render("zh", { ...soulStormData, verified: true })).not.toContain('data-testid="soul-storm-unverified"');
  });
  it("keeps the schedule readable without JavaScript", async () => {
    const html = await render("en");
    expect(/<[^>]*data-testid="soul-storm-clock"[^>]*>/.exec(html)?.[0]).toMatch(/\shidden(\s|=|>)/);   // attribute order is not fixed
    expect(html).toContain("A storm starts every 40 minutes and lasts 20 minutes");
    expect(count(html, 'href="/en/map/?world=')).toBeGreaterThanOrEqual(7);
  });
  it("never shows the stale tutorial paragraph", async () => {
    for (const lang of ["zh", "en", "ja", "ru"]) expect(await render(lang)).not.toMatch(/every hour|每小時|毎時間|каждый час/);   // the stale paragraph's own words; the cadence line legitimately says "40"
  });
  it("says the gear has no item list and marks each chest group unconfirmed once", async () => {
    const html = await render("en");
    expect(count(html, 'data-testid="soul-storm-unconfirmed"')).toBe(2);
    expect(html).toContain("The data has no item list for this.");
    expect(html).toContain("In Soul Storms, items have a chance to drop with an extra effect!");
  });
  it("shows one untranslated marker for the rotation, not one per area", async () => {
    const fallback = { ...soulStormData, rotationUntranslated: ["ja" as const] };
    const html = await render("ja", fallback);
    const rotation = html.slice(html.indexOf('data-testid="soul-storm-rotation"'));
    expect(count(rotation.slice(0, rotation.indexOf("</ol>") + 400), "tag warn")).toBe(1);
  });
  it("leaves out the unlock section when the data has none", async () => {
    expect(await render("en", { ...soulStormData, unlock: null })).not.toContain('data-testid="soul-storm-unlock"');
  });
  it("shows only the introduction and a no-data line when there is no schedule", async () => {
    const html = await render("en", { ...soulStormData, rotation: [], generators: [], chests: [] });
    expect(html).toContain("There is no schedule data yet.");
    expect(html).not.toContain('data-testid="soul-storm-clock"');
  });
});
```

（`rotationUntranslated: ["ja" as const]` 是 `as const`，規則允許。如果 tsc 仍推不出型別，改用 `satisfies SoulStormData`。）

既有的 `tests/unit/site/client-bundle.test.ts`：在 `finds the site's client scripts` 的 `arrayContaining` 加 `"src/components/SoulStormClock.astro"`。

- [ ] **Step 2：跑測試，確認失敗**：`npx vitest run tests/unit/site tests/unit/components`
- [ ] **Step 3：實作**
  - `SoulStormClock.astro` 的 script（每個函式 < 50 行）：
    1. 讀 `[data-soul-storm-json]` → `parseClockPayload`。失敗就 `console.error("soul storm clock: bad payload")`、保持 `hidden`、結束。
    2. `render(now)`：
       - 用 `stormState` 決定文字，`labels.now`／`labels.next` 填 `{area}`，`endsIn`／`startsIn` 填 `{time}`（`formatCountdown`）；
       - 狀態文字改變時才寫入 `aria-live="polite"` 的元素；
       - 倒數放在另一個沒有 `aria-live` 的元素。
    3. 表格只在 `state.window.index` 改變時重建：`upcomingWindows(…, payload.upcoming)`，時間用 `formatWindowTime(w.startMs, document.documentElement.lang)`，區域連到 `areas[w.areaIndex].href`。
    4. 時區：`Intl.DateTimeFormat().resolvedOptions().timeZone` 填進 `labels.timeZone` 的 `{zone}`。
    5. 移除 `hidden`，每 1000 ms `render(Date.now())`。
  - 頁面的 frontmatter 接受 `data?: SoulStormData`（預設 `soulStormData`），測試才能注入。
  - `getStaticPaths` 只傳 `lang`。
  - 標題用 `texts.title`；對照語言標題沿用 `achievements.astro` 的寫法；圖示用 `assetUrl(data.icons.header)`，`alt=""`。
  - 內容區加 `data-pagefind-body`。
  - 機率與門檻用 `formatChance`；寶箱 slot 用 `dropSummary` 加 `lootSlotLabel`，`pool:"none"` 的 item 加 `t(lang,"mobDropPoolNone")`；抗性用 `statLabel` 加 `formatStat`。
  - CSS 只用 `tokens.css` 的變數。表格外層加 `.soul-storm-scroll { overflow-x:auto }`，長字加 `overflow-wrap:anywhere`。
- [ ] **Step 4：跑測試與型別檢查**：`npx vitest run tests/unit/site tests/unit/components`，再跑 tsc。
- [ ] **Step 5：建置並目視檢查**：
  1. `npm run build`；
  2. 確認 4329 可用（見 Global Constraints），再 `npm run preview`；
  3. 截圖存到 `.superpowers/screens/`（不提交）：`/zh/soul-storm/`、`/en/soul-storm/`、`/de/soul-storm/`、`/ru/soul-storm/`，桌面與 412px 手機各一張。
  4. 檢查：
     - 倒數有在跑；
     - 時區名稱有顯示；
     - 未確認標記只有一個；
     - 輪替連結正確；
     - 沒有橫向溢出；
     - 字型正確；
     - 「未翻譯」只出現在該出現的地方。
- [ ] **Step 6：Commit**：`feat: add the Soul Storm page with a live schedule`

---

### Task 7: E2E、全面驗證、最終審查與 PR

**Files:**
- Create: `tests/e2e/soul-storm.spec.ts`
- Modify（全部 LF，改前數 CR）：
  - `tests/e2e/achievements.spec.ts`：選單陣列改成 `["地圖", "成就", "怪物圖鑑", "靈魂風暴"]`；ja 的陣列加上 `src/i18n/ja.json`／遊戲字串的 `soulStorm`（用 node 讀出實際值）；
  - `tests/e2e/mobs.spec.ts`：選單陣列同上；
  - `tests/e2e/wiki.spec.ts`：爬梳起點加 `/zh/soul-storm/`。如果 `[path, title, count]` 那段測試是逐頁斷言標題，不要把本頁加進去（本頁沒有 count）。

- [ ] **Step 1：寫 E2E** `tests/e2e/soul-storm.spec.ts`：

```ts
import { expect, test, type Page } from "@playwright/test";

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("live schedule (UTC)", () => {
  test.use({ timezoneId: "UTC" });

  test("a running storm counts down to its end", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-11T00:00:00Z") });
    await page.goto("/en/soul-storm/");
    const clock = page.getByTestId("soul-storm-clock");
    await expect(clock).toBeVisible();
    await expect(page.getByTestId("soul-storm-status")).toHaveText("Now: Humbler Huskland");
    await expect(page.getByTestId("soul-storm-countdown")).toContainText("20:00");
    await page.clock.runFor(1000);
    await expect(page.getByTestId("soul-storm-countdown")).toContainText("19:59");
  });

  test("between storms it names the next area and when it starts", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-11T00:25:00Z") });
    await page.goto("/en/soul-storm/");
    await expect(page.getByTestId("soul-storm-status")).toHaveText("Next: Lullaby Hills");
    await expect(page.getByTestId("soul-storm-countdown")).toContainText("15:00");
    await expect(page.getByTestId("soul-storm-upcoming").locator("tbody tr")).toHaveCount(7);
  });

  test("always warns that the times are estimated", async ({ page }) => {
    await page.goto("/zh/soul-storm/");
    await expect(page.getByTestId("soul-storm-unverified")).toHaveText("推算時刻，尚未經遊戲內確認");
  });
});

test.describe("viewer's time zone", () => {
  test.use({ timezoneId: "Asia/Taipei" });
  test("lists the upcoming storms in local time and names the zone", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-11T00:00:00Z") });
    await page.goto("/zh/soul-storm/");
    await expect(page.getByTestId("soul-storm-upcoming").locator("tbody tr").first()).toContainText("08:00");
    await expect(page.getByTestId("soul-storm-timezone")).toContainText("Asia/Taipei");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("shows the static schedule and the rotation, no countdown", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    await expect(page.getByTestId("soul-storm-clock")).toBeHidden();
    await expect(page.getByTestId("soul-storm-cadence")).toContainText("every 40 minutes");
    await expect(page.getByTestId("soul-storm-rotation").locator("a")).toHaveCount(7);
    await expect(page.getByTestId("soul-storm-unverified")).toBeVisible();
  });
});

test.describe("static sections", () => {
  test("a rotation link opens the map on the area", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    await page.getByTestId("soul-storm-rotation").getByRole("link", { name: "Humbler Huskland" }).click();
    await expect(page).toHaveURL(/\/en\/map\/\?world=sift#4\/\d+(\.\d+)?\/\d+(\.\d+)?/);
  });

  test("the Storm Monstrosities link to the bestiary", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    const links = page.getByTestId("soul-storm-monstrosities").locator("a");
    await expect(links).toHaveCount(3);
    await expect(links.first()).toHaveAttribute("href", "/en/mobs/monstrosity-copper/");
  });

  test("chests say what the data supports and nothing more", async ({ page }) => {
    await page.goto("/en/soul-storm/");
    const chests = page.getByTestId("soul-storm-chests");
    await expect(chests.getByTestId("soul-storm-unconfirmed")).toHaveCount(2);
    await expect(chests).toContainText("Guaranteed: 4");
    await expect(chests).toContainText("The data has no item list for this.");
    await expect(page.locator("body")).not.toContainText("Nearly as cool as Kira");
  });

  test("does not overflow on a phone in a long language", async ({ page }) => {
    await page.goto("/de/soul-storm/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("menu and search", () => {
  test("the menu lists Soul Storms after the bestiary and marks it on its page", async ({ page }) => {
    await page.goto("/zh/soul-storm/");
    await page.getByTestId("site-menu").click();
    await expect(page.locator(".site-menu a")).toHaveText(["地圖", "成就", "怪物圖鑑", "靈魂風暴"]);
    await expect(page.locator(".site-menu [aria-current='page']")).toHaveText("靈魂風暴");
  });

  test("site search finds the page by its English name from a Japanese page", async ({ page }) => {
    await page.goto(`/ja/search/?q=${encodeURIComponent("Soul Storms")}`);
    await expect(page.locator('.pagefind-ui__results a[href*="/ja/soul-storm/"]').first()).toBeVisible({ timeout: 15_000 });
  });
});
```

（`page.clock.install` 之後頁面的 `setInterval` 會跟著假時鐘走，`runFor(1000)` 會觸發一次更新。如果 Playwright 1.64 的 API 名稱不同，以 `npx playwright --version` 對應的文件為準調整，並記進 ledger。手機 project（Pixel 7）的視窗只有 412px，「長語言不溢出」那個測試在兩個 project 都會跑。）

- [ ] **Step 2：跑測試，確認失敗**：
  先確認 4329 可用，然後 `npm run build`，再 `npx playwright test tests/e2e/soul-storm.spec.ts --project=chromium`。
  如果 Task 6 已經完成，這一步可能直接通過。那也要先把一個斷言改錯，親眼看它失敗，再改回來。
- [ ] **Step 3：修正**：補上 Task 6 漏掉的 test id，並更新三個既有 spec 的選單陣列與爬梳起點。
- [ ] **Step 4：全面驗證**（逐項執行，貼出結果數字）：
  1. **型別**：`npx tsc --noEmit -p .` → 0 錯誤。
  2. **單元＋整合＋覆蓋率**：`npm run test:coverage` → 全過；lines、functions、branches、statements **四項都 ≥ 80%**。不足時補測試，不可降低門檻。
  3. **基準大小**：在 `origin/master` 的 build 上量 `du -sm dist`。可以用另一個暫存 worktree，或使用者提供的數字；量不到時以 merge-base 重建量測，並寫進 ledger。
  4. **建置**：`npm run build`，記錄耗時、`du -sm dist`、`find dist -name '*.html' | wc -l`、`du -sh dist/pagefind`。
  5. **E2E**：先檢查 4329（見 Global Constraints），再 `npx playwright test`。**chromium 與 mobile 兩個 project 全過**，包含全站連結爬梳。
  6. **資料大小**：`ls -l src/data/soul-storm.json`（< 50 KB）；`dist` 增加 < 2 MB。
  7. **子路徑建置**：
     - `MSYS_NO_PATHCONV=1 BASE_PATH=/mcd2-wiki/ npm run build`；
     - 確認 `dist/zh/soul-storm/index.html` 的地圖連結與圖示都以 `/mcd2-wiki/` 開頭：
       ```
       grep -o 'href="[^"]*map/[^"]*"' dist/zh/soul-storm/index.html | head -3
       grep -o 'src="[^"]*soul-storm[^"]*"' dist/zh/soul-storm/index.html
       ```
     - 確認 client payload 的 `href` 也帶子路徑：`grep -o '"href":"[^"]*"' dist/zh/soul-storm/index.html | head -2`；
     - 最後用 `npm run build` 把 dist 還原。
  8. **截圖**（存 `.superpowers/screens/`，不提交）：
     - `/zh/soul-storm/`、`/en/soul-storm/`、`/ja/soul-storm/`、`/de/soul-storm/`、`/ru/soul-storm/`，桌面與 412px 手機各一；
     - 沒有 JS 的 `/en/soul-storm/`；
     - 選單展開。
  9. **隱私**：
     - `git grep -n "OnlineConstants" -- . ':!tests/unit/extract/telemetry-key.test.ts' ':!scripts/extract/table-reader.ts' ':!docs'` 沒有結果；
     - `telemetry-key` 測試通過。
  10. **工作區**：`git status` 沒有未預期的檔案；`source-data` 沒有任何變動。它被 ignore，git 看不到，所以改用時間檢查：PowerShell `Get-ChildItem D:\Project\mcd2-wiki\source-data -Recurse -File | Where-Object LastWriteTime -gt (Get-Date).AddDays(-1) | Select-Object -First 5` 應為空。若使用者當天剛重新解包，以解包時間為準判斷。
- [ ] **Step 5：Commit**：`test: cover the Soul Storm page end to end`。驗證中修的東西各自獨立 commit（`fix:`／`test:`）。
- [ ] **Step 6：最終審查**（用最強的模型）：
  - 範圍：整個分支 `git diff origin/master...HEAD`。
  - 依據：spec 與本計畫的 Review Focus。
  - Critical 與 Important 必須修好並補測試；Minor 列進 PR 說明的「延後處理」。
- [ ] **Step 7：Push 並開 PR**（最終審查通過後才做）：
  - `git push -u origin feat/soul-storm`；
  - `gh pr create --base master --title "feat: Soul Storm page with a live schedule"`；
  - PR 說明依執行 prompt 的要求撰寫，**不加 attribution 行**；
  - **不要合併**。

---

## Self-Review（寫完後自查的結果）

**Spec 覆蓋**
- §1.1-1（頁面、16 語、選單位置）→ Task 6、7；-2（client 計算、7 場、當地時間、時區名）→ Task 4、6、7；-3（未確認標記、一行切換）→ Task 1（status 檔）、Task 3（一致性測試）、Task 6、7；-4（無 JS）→ Task 6、7；-5（靜態段落）→ Task 2、3、6；-6（官方文字、標記數量）→ Task 2、5、6；-7（搜尋）→ Task 6、7；-8（tsc／覆蓋率／E2E）→ Task 7。
- §2 每一個資料值都在 Task 1 的 fixture 或 Task 2、3 的煙霧測試中出現。§2.10 遙測 → Task 1、3、7。
- §3 U1–U3 → status 檔的 `anchorOffsetMinutes`、`rotationOffset`、`verified`（Task 1）；修正方法寫在執行 prompt 的回報要求。
- §4 D1–D16 → P1–P17 與 Task 6；§5.4 client bundle → Task 4、6；§6 錯誤處理 → Task 1（schema、缺表）、Task 2（時間戳記、缺名稱、缺文字）、Task 3（未連結的怪物、空輸出）、Task 4（壞 payload）；§7 測試清單 → Task 1–7；§8 規模 → Task 3、7。

**佔位字掃描**：沒有 TBD／TODO。機器翻譯的內容由執行者產生，規則已寫明；`ENGLISH_FALLBACK` 是否新增依實際判斷，記進 ledger。

**型別一致**：
- `SoulStormTables`（Task 1）→ Task 2、3；
- `SoulStormData`、`Generator`、`Chest`、`TextId`（Task 1）→ Task 2、3、6；
- `BestiaryLinks`（Task 3）→ `extractSoulStorm`；
- `StormSchedule`、`ClockPayload`（Task 4）→ Task 6 的 `scheduleOf`、`clockPayload`；
- `MobArea`（既有）→ rotation 與 `mapLinkOf`；
- `MobDrop`（既有）→ 寶箱 slots 與 `dropSummary`。

**Review Focus 對應**：1→Task 4；2→Task 1、3、6、7；3→Task 2、3、6、7；4→Task 3；5→Task 3；6→Task 4、6；7→Task 1、3、7；8→Task 6、7。

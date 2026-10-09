# Minecraft Dungeons II 繁中 Wiki 原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 從遊戲語系檔與圖示自動產生 Minecraft Dungeons II 繁中／英文雙語靜態 Wiki 原型（裝備、附魔與效果）。

**Architecture:** `scripts/extract/` 是一條純函式為主的 Node/TypeScript 抽取管線：讀 `source-data/` 的 `en`、`zh-Hant` 語系檔 → 依 key 組成條目 → 標記轉安全 HTML → 配對圖示 → 建立條目間連結與護甲套裝 → 驗證後寫入 `src/data/*.json` 與 `public/icons/`。Astro 以這些 JSON 靜態產生 `/zh/`、`/en/` 兩套頁面，Pagefind 於建置後建立搜尋索引。

**Tech Stack:** Node 24、TypeScript、Astro 7、zod 4、Vitest 5（+ coverage-v8）、Playwright 1.64、Pagefind 1.5、tsx 4。

**Spec:** `docs/superpowers/specs/2026-10-10-mcd2-wiki-design.md`

## Global Constraints

- Node ≥ 24（本機 v24.13.0）；`package.json` 設 `"type": "module"`。
- 套件主版本：`astro@^7`、`zod@^4`、`vitest@^5`、`@vitest/coverage-v8@^5`、`@playwright/test@^1.64`、`pagefind@^1.5`、`tsx@^4`、`typescript@^7`、`@types/node@^24`。若 Astro 7／zod 4 API 與本計畫程式碼不符，查官方文件（context7）調整寫法，但保持行為不變。
- `source-data/` 唯讀、永不提交（已在 `.gitignore`）。
- 語言固定兩種：`zh`（來源 culture `zh-Hant`，HTML `lang="zh-TW"`）與 `en`（culture `en`，HTML `lang="en"`）。
- 只為 `release: "base"` 條目產生頁面；任何連結只能指向 `release: "base"` 條目。
- 佔位符顯示：zh `{數值}`、en `{value}`。
- slug 格式 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，**同一分類內**唯一。
- 頁尾聲明（zh）逐字使用：「非官方粉絲網站，與 Mojang Studios／Microsoft 無關。遊戲文字與圖像版權歸原權利人所有。」
- 對照模式 localStorage key：`mcd2-compare`，值 `on`／`off`，預設 `on`。
- 圖示輸出路徑 `public/icons/<category>/<slug>.png`，資料中存 `icons/<category>/<slug>.png`，頁面一律經 `assetUrl()` 加上 base。
- 抽取錯誤訊息一律繁體中文且包含檔案路徑或條目位置。
- 檔案 ≤ 400 行、函式 < 50 行；不就地修改傳入的物件。
- 不建立 GitHub repo、不推送、不公開部署。
- 每個 commit 使用 conventional commits，訊息最後一行為 `Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm`。

## Review Focus

1. **不規則 key**：實際資料有小寫前綴 `Sw_Effect_Taunter_...` 與沒有 Id 的 `SW_Enchantment_SW_TextEntry_Name_Tiered` → 前者正常解析，後者略過並列入報告，絕不產生空 slug 條目。（Task 3）
2. **只有佔位符的欄位**：`Description` 若整段只是 `{0}` → 不輸出該欄位，而不是頁面上孤零零一個「{數值}」。（Task 3）
3. **連結到不存在的頁面**：一般版是 base、獨特版是 upcoming（R3/R4），或套裝缺部位 → 不產生指向 upcoming 的連結；套裝頁只列實際存在的部位。（Task 7）
4. **瀏覽器儲存被封鎖**（無痕模式、存取 `localStorage` 直接 throw）→ 對照模式仍預設開啟、按鈕仍可切換、無 JS 錯誤。（Task 14）
5. **網站部署在子路徑**（GitHub Pages `/<repo>/`）→ 所有內部連結、圖示與 Pagefind 搜尋結果網址都要帶 base。（Task 13、Task 15）

---

## File Structure

```
mcd2-wiki/
├─ package.json / tsconfig.json / astro.config.mjs / vitest.config.ts / playwright.config.ts
├─ scripts/extract/
│   ├─ config.ts          語言、分類、資料表清單、路徑常數
│   ├─ schemas.ts         zod schema 與型別（Entry、ArmorSet、LocaleFile）
│   ├─ issues.ts          Issue 型別、ExtractError、formatZodIssue
│   ├─ read-json.ts       讀 JSON 檔（BOM、ENOENT、錯誤訊息）
│   ├─ parse-locale.ts    讀取並驗證語系檔
│   ├─ keys.ts            key 解析、slug、variant、armor piece
│   ├─ group-entries.ts   key → RawEntry
│   ├─ render-markup.ts   遊戲標記 → 安全 HTML
│   ├─ match-icons.ts     圖示名稱正規化與配對（純函式）
│   ├─ icon-files.ts      列出圖示檔、讀 overrides（IO）
│   ├─ icon-overrides.json
│   ├─ assemble.ts        RawEntry → Entry、slug 唯一檢查
│   ├─ link-entries.ts    variant／附魔書／護甲套裝連結
│   ├─ output.ts          排序、輸出驗證、寫檔、複製圖示
│   ├─ report.ts          extract-report.md
│   ├─ pipeline.ts        runExtract()
│   └─ index.ts           CLI
├─ src/
│   ├─ data/entries.json, armor-sets.json     （抽取產物，進 git）
│   ├─ lib/i18n.ts, url.ts, data.ts, related.ts
│   ├─ layouts/Base.astro
│   ├─ components/LangText, EntryIcon, EntryCard, EntryTable, ListFilter, EntryDetail (.astro)
│   ├─ styles/global.css
│   └─ pages/index.astro, [lang]/index.astro, [lang]/search.astro,
│       [lang]/[category]/index.astro, [lang]/[category]/[slug].astro,
│       [lang]/armor/index.astro, [lang]/armor/[set].astro, [lang]/armor/piece/[slug].astro
├─ public/icons/…                              （抽取產物，進 git）
├─ tests/helpers/locales.ts, entries.ts
├─ tests/unit/extract/*.test.ts, tests/unit/site/*.test.ts
├─ tests/integration/pipeline.test.ts
├─ tests/e2e/wiki.spec.ts
└─ .github/workflows/deploy.yml, README.md
```

---

### Task 1: 專案骨架

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `src/pages/index.astro`

**Interfaces:**
- Produces: npm scripts `dev`、`extract`、`build`、`preview`、`test`、`test:coverage`、`test:e2e`；環境變數 `BASE_PATH` 控制 Astro `base`。

- [ ] **Step 1: 建立 `package.json`**

```json
{
  "name": "mcd2-wiki",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "extract": "tsx scripts/extract/index.ts",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview --port 4321",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "npm run build && playwright test"
  }
}
```

- [ ] **Step 2: 安裝套件**

Run:
```bash
npm install astro@^7 zod@^4
npm install -D vitest@^5 @vitest/coverage-v8@^5 @playwright/test@^1.64 pagefind@^1.5 tsx@^4 typescript@^7 @types/node@^24
```
Expected: `package.json` 出現 `dependencies` 與 `devDependencies`，無 ERR。

- [ ] **Step 3: 建立 `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "source-data", "node_modules"],
  "compilerOptions": {
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 4: 建立 `astro.config.mjs`**

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "always",
  build: { format: "directory" },
});
```

- [ ] **Step 5: 建立 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["scripts/extract/**/*.ts"],
      exclude: ["scripts/extract/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 6: 建立根目錄導向頁 `src/pages/index.astro`**

```astro
---
const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const target = `${base}zh/`;
---
<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content={`0; url=${target}`} />
    <link rel="canonical" href={target} />
    <title>Minecraft Dungeons II 中文 Wiki</title>
  </head>
  <body>
    <a href={target}>前往繁體中文版</a>
  </body>
</html>
```

- [ ] **Step 7: 驗證建置**

Run: `npx astro build`
Expected: 成功；`dist/index.html` 存在且含 `url=/zh/`（`grep "url=/zh/" dist/index.html` 有輸出）。

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs vitest.config.ts src/pages/index.astro
git commit -m "chore: scaffold Astro project with test tooling" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 2: 設定、Schema 與語系檔讀取

**Files:**
- Create: `scripts/extract/config.ts`, `scripts/extract/schemas.ts`, `scripts/extract/issues.ts`, `scripts/extract/read-json.ts`, `scripts/extract/parse-locale.ts`
- Test: `tests/unit/extract/parse-locale.test.ts`

**Interfaces:**
- Produces:
  - `config.ts`：`LANGS: readonly ["zh","en"]`、`type Lang`、`CULTURE: Record<Lang,string>`、`CATEGORIES`、`type Category`、`type Release = "base"|"upcoming"`、`interface TableSource { namespace; category; release }`、`TABLES: readonly TableSource[]`、`ICON_CATEGORIES: ReadonlySet<Category>`、`PATHS.iconRootRel: string`、`PATHS.localeFile(sourceRoot, culture): string`
  - `schemas.ts`：`LocaleFileSchema`、`type LocaleFile`、`LocalizedSchema`、`type Localized = {zh,en}`、`ARMOR_PIECES`、`type ArmorPiece`、`EntrySchema`、`type Entry`、`ArmorSetSchema`、`type ArmorSet`
  - `issues.ts`：`type IssueType`、`interface Issue {type; detail}`、`issue(type, detail): Issue`、`class ExtractError extends Error`、`formatZodIssue(i): string`
  - `read-json.ts`：`readJsonFile(filePath, label): Promise<unknown | undefined>`（檔案不存在回 `undefined`）
  - `parse-locale.ts`：`loadLocaleFile(filePath): Promise<LocaleFile>`、`loadLocales(sourceRoot): Promise<Record<Lang, LocaleFile>>`

- [ ] **Step 1: 寫失敗測試 `tests/unit/extract/parse-locale.test.ts`**

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { loadLocaleFile, loadLocales } from "../../../scripts/extract/parse-locale";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mcd2-locale-"));
});

async function write(relative: string, content: string): Promise<string> {
  const file = path.join(dir, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return file;
}

describe("loadLocaleFile", () => {
  it("returns namespaces mapped to key/text records", async () => {
    const file = await write("All.json", JSON.stringify({ "Text/Release/A.csv": { K: "v" } }));
    await expect(loadLocaleFile(file)).resolves.toEqual({ "Text/Release/A.csv": { K: "v" } });
  });

  it("strips a UTF-8 BOM", async () => {
    const file = await write("All.json", `﻿${JSON.stringify({ N: { K: "v" } })}`);
    await expect(loadLocaleFile(file)).resolves.toEqual({ N: { K: "v" } });
  });

  it("fails with the path when the file is missing", async () => {
    const file = path.join(dir, "missing.json");
    await expect(loadLocaleFile(file)).rejects.toThrow(ExtractError);
    await expect(loadLocaleFile(file)).rejects.toThrow(`找不到語系檔：${file}`);
  });

  it("fails on invalid JSON", async () => {
    const file = await write("All.json", "{ nope");
    await expect(loadLocaleFile(file)).rejects.toThrow("語系檔不是合法 JSON");
  });

  it("fails with the offending key path when a value is not a string", async () => {
    const file = await write("All.json", JSON.stringify({ N: { K: 1 } }));
    await expect(loadLocaleFile(file)).rejects.toThrow(/語系檔格式錯誤：.*N › K/);
  });
});

describe("loadLocales", () => {
  it("reads the zh-Hant and en culture files", async () => {
    await write("Localization/All/en/All.json", JSON.stringify({ N: { K: "Sword" } }));
    await write("Localization/All/zh-Hant/All.json", JSON.stringify({ N: { K: "劍" } }));
    await expect(loadLocales(dir)).resolves.toEqual({
      en: { N: { K: "Sword" } },
      zh: { N: { K: "劍" } },
    });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/parse-locale.test.ts`
Expected: FAIL（找不到模組 `scripts/extract/issues`）。

- [ ] **Step 3: 建立 `scripts/extract/config.ts`**

```ts
import path from "node:path";

export const LANGS = ["zh", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const CULTURE: Readonly<Record<Lang, string>> = { zh: "zh-Hant", en: "en" };

export const CATEGORIES = [
  "melee",
  "ranged",
  "armor",
  "artifact",
  "enchantment",
  "enchantment-book",
  "effect",
  "status",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Release = "base" | "upcoming";

export interface TableSource {
  readonly namespace: string;
  readonly category: Category;
  readonly release: Release;
}

const table = (name: string, category: Category, release: Release): TableSource => ({
  namespace: `Text/Release/${name}.csv`,
  category,
  release,
});

export const TABLES: readonly TableSource[] = [
  table("DT_ItemDefinitionMelee", "melee", "base"),
  table("DT_R3ItemDefinitionMelee", "melee", "upcoming"),
  table("DT_R4ItemDefinitionMelee", "melee", "upcoming"),
  table("DT_ItemDefinitionRanged", "ranged", "base"),
  table("DT_R4ItemDefinitionRanged", "ranged", "upcoming"),
  table("DT_ItemDefinitionArmor", "armor", "base"),
  table("DT_R3ItemDefinitionArmor", "armor", "upcoming"),
  table("DT_R4ItemDefinitionArmor", "armor", "upcoming"),
  table("DT_ItemDefinitionArtifact", "artifact", "base"),
  table("DT_R3ItemDefinitionArtifact", "artifact", "upcoming"),
  table("DT_R4ItemDefinitionArtifact", "artifact", "upcoming"),
  table("DT_EnchantmentDefinition", "enchantment", "base"),
  table("DT_R4EnchantmentDefinition", "enchantment", "upcoming"),
  table("DT_ItemDefinitionEnchantmentBook", "enchantment-book", "base"),
  table("DT_R4ItemDefinitionEnchantmentBook", "enchantment-book", "upcoming"),
  table("DT_EffectDefinition", "effect", "base"),
  table("DT_R3EffectDefinition", "effect", "upcoming"),
  table("DT_StatusDefinition", "status", "base"),
  table("DT_R3StatusEffectDefinition", "status", "upcoming"),
  table("DT_R4StatusEffectDefinition", "status", "upcoming"),
];

export const ICON_CATEGORIES: ReadonlySet<Category> = new Set(["melee", "ranged", "armor", "artifact"]);

export const PATHS = {
  iconRootRel: "Assets/Art/Characters/Player/Equipment",
  localeFile: (sourceRoot: string, culture: string): string =>
    path.join(sourceRoot, "Localization", "All", culture, "All.json"),
} as const;
```

- [ ] **Step 4: 建立 `scripts/extract/schemas.ts`**

```ts
import { z } from "zod";
import { CATEGORIES, LANGS } from "./config";

export const LocaleFileSchema = z.record(z.string(), z.record(z.string(), z.string()));
export type LocaleFile = z.infer<typeof LocaleFileSchema>;

export const LocalizedSchema = z.object({ zh: z.string(), en: z.string() });
export type Localized = z.infer<typeof LocalizedSchema>;

export const ARMOR_PIECES = ["helmet", "chest", "leggings", "boots"] as const;
export type ArmorPiece = (typeof ARMOR_PIECES)[number];

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const VariantSchema = z.enum(["normal", "unique"]);

export const EntrySchema = z.object({
  id: z.string().min(1),
  slug: SlugSchema,
  category: z.enum(CATEGORIES),
  variant: VariantSchema,
  release: z.enum(["base", "upcoming"]),
  name: LocalizedSchema,
  description: LocalizedSchema.optional(),
  descriptionLong: LocalizedSchema.optional(),
  icon: z.string().optional(),
  armorPiece: z.enum(ARMOR_PIECES).optional(),
  untranslated: z.array(z.enum(LANGS)).optional(),
  links: z.object({
    variants: z.array(SlugSchema).optional(),
    enchantmentBook: SlugSchema.optional(),
    enchantment: SlugSchema.optional(),
    armorSet: SlugSchema.optional(),
  }),
});
export type Entry = z.infer<typeof EntrySchema>;

export const ArmorSetSchema = z.object({
  id: z.string().min(1),
  slug: SlugSchema,
  variant: VariantSchema,
  name: LocalizedSchema,
  pieces: z.object({
    helmet: SlugSchema.optional(),
    chest: SlugSchema.optional(),
    leggings: SlugSchema.optional(),
    boots: SlugSchema.optional(),
  }),
});
export type ArmorSet = z.infer<typeof ArmorSetSchema>;
```

- [ ] **Step 5: 建立 `scripts/extract/issues.ts`**

```ts
export type IssueType =
  | "missing-namespace"
  | "skipped-key"
  | "ignored-field"
  | "missing-text"
  | "placeholder-only"
  | "missing-name"
  | "untranslated"
  | "markup-warning"
  | "missing-icon-root"
  | "missing-icon"
  | "ambiguous-icon"
  | "override-missing-file"
  | "unlinked-enchantment"
  | "armor-set-name-fallback";

export interface Issue {
  readonly type: IssueType;
  readonly detail: string;
}

export const issue = (type: IssueType, detail: string): Issue => ({ type, detail });

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}

export function formatZodIssue(zodIssue: { path: readonly PropertyKey[]; message: string }): string {
  const location = zodIssue.path.map(String).join(" › ") || "(root)";
  return `${location}：${zodIssue.message}`;
}
```

- [ ] **Step 6: 建立 `scripts/extract/read-json.ts`**

```ts
import { readFile } from "node:fs/promises";
import { ExtractError } from "./issues";

const isNotFound = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

export async function readJsonFile(filePath: string, label: string): Promise<unknown | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw new ExtractError(`無法讀取${label}：${filePath}（${(error as Error).message}）`);
  }
  try {
    return JSON.parse(raw.replace(/^﻿/, ""));
  } catch (error) {
    throw new ExtractError(`${label}不是合法 JSON：${filePath}（${(error as Error).message}）`);
  }
}
```

- [ ] **Step 7: 建立 `scripts/extract/parse-locale.ts`**

```ts
import { CULTURE, LANGS, PATHS, type Lang } from "./config";
import { ExtractError, formatZodIssue } from "./issues";
import { readJsonFile } from "./read-json";
import { LocaleFileSchema, type LocaleFile } from "./schemas";

export async function loadLocaleFile(filePath: string): Promise<LocaleFile> {
  const json = await readJsonFile(filePath, "語系檔");
  if (json === undefined) throw new ExtractError(`找不到語系檔：${filePath}`);
  const parsed = LocaleFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractError(`語系檔格式錯誤：${filePath} ${formatZodIssue(parsed.error.issues[0])}`);
  }
  return parsed.data;
}

export async function loadLocales(sourceRoot: string): Promise<Record<Lang, LocaleFile>> {
  const [zh, en] = await Promise.all(
    LANGS.map((lang) => loadLocaleFile(PATHS.localeFile(sourceRoot, CULTURE[lang]))),
  );
  return { zh, en };
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run tests/unit/extract/parse-locale.test.ts`
Expected: PASS（6 tests）。

- [ ] **Step 9: Commit**

```bash
git add scripts/extract tests/unit/extract/parse-locale.test.ts
git commit -m "feat: add extract config, schemas and locale loader" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 3: Key 解析與條目分組

**Files:**
- Create: `scripts/extract/keys.ts`, `scripts/extract/group-entries.ts`, `tests/helpers/locales.ts`
- Test: `tests/unit/extract/keys.test.ts`, `tests/unit/extract/group-entries.test.ts`

**Interfaces:**
- Consumes: `TableSource`、`CATEGORIES`、`Lang`、`LocaleFile`、`Localized`、`ArmorPiece`、`issue()`
- Produces:
  - `keys.ts`：`parseKey(key): { kind: string; id: string; field: string } | null`、`toSlug(id): string`、`baseId(id): string`、`variantOf(id): "normal" | "unique"`、`armorPieceOf(id): ArmorPiece | undefined`
  - `group-entries.ts`：`interface RawEntry { id; category; release; name: Localized; description?: Localized; descriptionLong?: Localized; untranslated: Lang[] }`、`resolveText(key, en, zh): { text?: Localized; untranslated: Lang[] }`、`groupEntries(locales, tables): { entries: RawEntry[]; issues: Issue[] }`
  - `tests/helpers/locales.ts`：`ns(table): string`、`makeLocales(rows): Record<Lang, LocaleFile>`

- [ ] **Step 1: 建立測試輔助 `tests/helpers/locales.ts`**

```ts
import type { Lang } from "../../scripts/extract/config";
import type { LocaleFile } from "../../scripts/extract/schemas";

export const ns = (table: string): string => `Text/Release/${table}.csv`;

type Rows = Record<string, Record<string, readonly [en: string, zh: string]>>;

export function makeLocales(rows: Rows): Record<Lang, LocaleFile> {
  const pick = (index: 0 | 1): LocaleFile =>
    Object.fromEntries(
      Object.entries(rows).map(([namespace, keys]) => [
        namespace,
        Object.fromEntries(Object.entries(keys).map(([key, pair]) => [key, pair[index]])),
      ]),
    );
  return { en: pick(0), zh: pick(1) };
}
```

- [ ] **Step 2: 寫失敗測試 `tests/unit/extract/keys.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { armorPieceOf, baseId, parseKey, toSlug, variantOf } from "../../../scripts/extract/keys";

describe("parseKey", () => {
  it("splits kind, id and field", () => {
    expect(parseKey("SW_Item_Sword_Unique1_SW_TextEntry_Name")).toEqual({
      kind: "Item",
      id: "Sword_Unique1",
      field: "Name",
    });
  });

  it("keeps multi-part field names", () => {
    expect(parseKey("SW_Effect_Vivify_SW_TextEntry_Description_Long")?.field).toBe("Description_Long");
  });

  it("accepts the lowercase Sw_ prefix found in real data", () => {
    expect(parseKey("Sw_Effect_Taunter_SW_TextEntry_Name")).toEqual({ kind: "Effect", id: "Taunter", field: "Name" });
  });

  it("rejects keys without an id", () => {
    expect(parseKey("SW_Enchantment_SW_TextEntry_Name_Tiered")).toBeNull();
  });

  it("rejects unrelated keys", () => {
    expect(parseKey("AccountLink.Title")).toBeNull();
  });
});

describe("toSlug", () => {
  it.each([
    ["Sword", "sword"],
    ["Sword_Unique1", "sword-unique1"],
    ["MoonSword", "moon-sword"],
    ["Artifact_FireBracelet", "fire-bracelet"],
    ["EnchantmentBook_SoulInfusedPotion", "soul-infused-potion"],
    ["TotemOfRegeneration", "totem-of-regeneration"],
    ["DiscipleBoots_Unique", "disciple-boots-unique"],
    ["Artifact_Buff_FireBracelet", "buff-fire-bracelet"],
    ["XPGain", "xp-gain"],
  ])("%s → %s", (id, slug) => {
    expect(toSlug(id)).toBe(slug);
  });
});

describe("baseId / variantOf", () => {
  it("removes unique suffixes", () => {
    expect(baseId("Sword_Unique1")).toBe("Sword");
    expect(baseId("DiscipleBoots_Unique")).toBe("DiscipleBoots");
    expect(baseId("Sword")).toBe("Sword");
  });

  it("detects unique variants", () => {
    expect(variantOf("Sword_Unique1")).toBe("unique");
    expect(variantOf("DiscipleBoots_Unique")).toBe("unique");
    expect(variantOf("Sword")).toBe("normal");
  });
});

describe("armorPieceOf", () => {
  it.each([
    ["DiscipleHelmet", "helmet"],
    ["WellspringChest_Unique", "chest"],
    ["SifterLeggings", "leggings"],
    ["DiscipleBoots", "boots"],
    ["Sword", undefined],
  ])("%s → %s", (id, piece) => {
    expect(armorPieceOf(id)).toBe(piece);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/keys.test.ts`
Expected: FAIL（找不到模組 `scripts/extract/keys`）。

- [ ] **Step 4: 建立 `scripts/extract/keys.ts`**

```ts
import type { ArmorPiece } from "./schemas";

const KEY_PATTERN = /^SW_(Item|Enchantment|Effect|Status)_(.+?)_SW_TextEntry_(.+)$/i;
const SLUG_PREFIX = /^(?:Artifact_|EnchantmentBook_)/;
const UNIQUE_SUFFIX = /_Unique\d*$/i;
const PIECE_PATTERN = /(Helmet|Chest|Leggings|Boots)/;

export interface ParsedKey {
  readonly kind: string;
  readonly id: string;
  readonly field: string;
}

export function parseKey(key: string): ParsedKey | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  return { kind: match[1], id: match[2], field: match[3] };
}

export function toSlug(id: string): string {
  return id
    .replace(SLUG_PREFIX, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const baseId = (id: string): string => id.replace(UNIQUE_SUFFIX, "");

export const variantOf = (id: string): "normal" | "unique" => (UNIQUE_SUFFIX.test(id) ? "unique" : "normal");

export function armorPieceOf(id: string): ArmorPiece | undefined {
  const match = PIECE_PATTERN.exec(id);
  return match ? (match[1].toLowerCase() as ArmorPiece) : undefined;
}
```

- [ ] **Step 5: 執行 keys 測試確認通過**

Run: `npx vitest run tests/unit/extract/keys.test.ts`
Expected: PASS。

- [ ] **Step 6: 寫失敗測試 `tests/unit/extract/group-entries.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { TableSource } from "../../../scripts/extract/config";
import { groupEntries, resolveText } from "../../../scripts/extract/group-entries";
import { makeLocales, ns } from "../../helpers/locales";

const MELEE: TableSource = { namespace: ns("DT_ItemDefinitionMelee"), category: "melee", release: "base" };
const R3_MELEE: TableSource = { namespace: ns("DT_R3ItemDefinitionMelee"), category: "melee", release: "upcoming" };
const ENCHANT: TableSource = { namespace: ns("DT_EnchantmentDefinition"), category: "enchantment", release: "base" };
const EFFECT: TableSource = { namespace: ns("DT_EffectDefinition"), category: "effect", release: "base" };

describe("groupEntries", () => {
  it("merges the name and description of one id into one entry", () => {
    const locales = makeLocales({
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
        SW_Item_Sword_SW_TextEntry_Description: ["A classic sword.", "經典的劍。"],
      },
    });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries).toEqual([
      {
        id: "Sword",
        category: "melee",
        release: "base",
        name: { en: "Sword", zh: "劍" },
        description: { en: "A classic sword.", zh: "經典的劍。" },
        untranslated: [],
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("keeps unique variants as separate entries", () => {
    const locales = makeLocales({
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
        SW_Item_Sword_Unique1_SW_TextEntry_Name: ["The Burning Blade", "燃燒之刃"],
      },
    });
    expect(groupEntries(locales, [MELEE]).entries.map((e) => e.id)).toEqual(["Sword", "Sword_Unique1"]);
  });

  it("takes the release from the table", () => {
    const locales = makeLocales({ [R3_MELEE.namespace]: { SW_Item_Halberd_SW_TextEntry_Name: ["Halberd", "戟"] } });
    expect(groupEntries(locales, [R3_MELEE]).entries[0].release).toBe("upcoming");
  });

  it("falls back to English and flags zh as untranslated when zh is empty", () => {
    const locales = makeLocales({ [MELEE.namespace]: { SW_Item_Sword_SW_TextEntry_Name: ["Sword", ""] } });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries[0].name).toEqual({ en: "Sword", zh: "Sword" });
    expect(entries[0].untranslated).toEqual(["zh"]);
    expect(issues).toContainEqual({ type: "untranslated", detail: "melee:Sword (zh)" });
  });

  it("treats a zh text equal to its key as untranslated", () => {
    const key = "SW_Item_Sword_SW_TextEntry_Name";
    const locales = makeLocales({ [MELEE.namespace]: { [key]: ["Sword", key] } });
    expect(groupEntries(locales, [MELEE]).entries[0].untranslated).toEqual(["zh"]);
  });

  it("skips keys without an id and reports them", () => {
    const locales = makeLocales({
      [ENCHANT.namespace]: { SW_Enchantment_SW_TextEntry_Name_Tiered: ["{0} {1}", "{0} {1}"] },
    });
    const { entries, issues } = groupEntries(locales, [ENCHANT]);
    expect(entries).toEqual([]);
    expect(issues).toContainEqual({
      type: "skipped-key",
      detail: `${ENCHANT.namespace} › SW_Enchantment_SW_TextEntry_Name_Tiered`,
    });
  });

  it("parses keys with a lowercase Sw_ prefix", () => {
    const locales = makeLocales({ [EFFECT.namespace]: { Sw_Effect_Taunter_SW_TextEntry_Name: ["Taunter", "嘲諷者"] } });
    expect(groupEntries(locales, [EFFECT]).entries.map((e) => e.id)).toEqual(["Taunter"]);
  });

  it("ignores EffectTotal fields", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_CriticalEdge_SW_TextEntry_Name: ["Critical Edge", "致命鋒刃"],
        SW_Effect_CriticalEdge_SW_TextEntry_Description_EffectTotal: ["{0}", "{0}"],
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(Object.keys(entries[0])).toEqual(["id", "category", "release", "untranslated", "name"]);
    expect(issues).toContainEqual({ type: "ignored-field", detail: "CriticalEdge.Description_EffectTotal" });
  });

  it("drops descriptions that contain only placeholders", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_Aim_SW_TextEntry_Name: ["Aim", "瞄準"],
        SW_Effect_Aim_SW_TextEntry_Description: ["{0}", " {0} "],
      },
    });
    const { entries, issues } = groupEntries(locales, [EFFECT]);
    expect(entries[0].description).toBeUndefined();
    expect(issues).toContainEqual({ type: "placeholder-only", detail: "Aim.Description" });
  });

  it("keeps descriptions that mix text and placeholders", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: {
        SW_Effect_CriticalEdge_SW_TextEntry_Name: ["Critical Edge", "致命鋒刃"],
        SW_Effect_CriticalEdge_SW_TextEntry_Description: ["Deal {0} more.", "提高 {0}。"],
      },
    });
    expect(groupEntries(locales, [EFFECT]).entries[0].description).toEqual({ en: "Deal {0} more.", zh: "提高 {0}。" });
  });

  it("skips entries that have no name", () => {
    const locales = makeLocales({
      [MELEE.namespace]: { SW_Item_Ghost_SW_TextEntry_Description: ["Boo.", "嚇。"] },
    });
    const { entries, issues } = groupEntries(locales, [MELEE]);
    expect(entries).toEqual([]);
    expect(issues).toContainEqual({ type: "missing-name", detail: "melee:Ghost" });
  });

  it("reports a missing namespace", () => {
    const { entries, issues } = groupEntries(makeLocales({}), [MELEE]);
    expect(entries).toEqual([]);
    expect(issues).toEqual([{ type: "missing-namespace", detail: MELEE.namespace }]);
  });

  it("sorts entries by category order, then id", () => {
    const locales = makeLocales({
      [EFFECT.namespace]: { SW_Effect_Aim_SW_TextEntry_Name: ["Aim", "瞄準"] },
      [MELEE.namespace]: {
        SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
        SW_Item_Axe_SW_TextEntry_Name: ["Axe", "斧"],
      },
    });
    const { entries } = groupEntries(locales, [EFFECT, MELEE]);
    expect(entries.map((e) => `${e.category}:${e.id}`)).toEqual(["melee:Axe", "melee:Sword", "effect:Aim"]);
  });
});

describe("resolveText", () => {
  it("returns no text when both languages are missing", () => {
    expect(resolveText("K", "", undefined)).toEqual({ untranslated: [] });
  });

  it("falls back to zh when en is missing", () => {
    expect(resolveText("K", "", "劍")).toEqual({ text: { zh: "劍", en: "劍" }, untranslated: ["en"] });
  });
});
```

- [ ] **Step 7: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/group-entries.test.ts`
Expected: FAIL（找不到模組 `scripts/extract/group-entries`）。

- [ ] **Step 8: 建立 `scripts/extract/group-entries.ts`**

```ts
import { CATEGORIES, type Category, type Lang, type Release, type TableSource } from "./config";
import { issue, type Issue } from "./issues";
import { parseKey } from "./keys";
import type { LocaleFile, Localized } from "./schemas";

export interface RawEntry {
  readonly id: string;
  readonly category: Category;
  readonly release: Release;
  readonly untranslated: Lang[];
  readonly name: Localized;
  readonly description?: Localized;
  readonly descriptionLong?: Localized;
}

type TextField = "name" | "description" | "descriptionLong";
type Draft = Omit<RawEntry, "name"> & { readonly name?: Localized };

interface Cell {
  readonly category: Category;
  readonly release: Release;
  readonly id: string;
  readonly field: TextField;
  readonly text: Localized;
  readonly untranslated: Lang[];
}

const FIELD_MAP: Readonly<Record<string, TextField>> = {
  name: "name",
  description: "description",
  description_long: "descriptionLong",
};
const PLACEHOLDER_ONLY = /^\s*(?:\{\w+\}\s*)+$/;

const isMissing = (value: string | undefined, key: string): boolean =>
  value === undefined || value.trim() === "" || value === key;

const isPlaceholderOnly = (text: Localized): boolean =>
  PLACEHOLDER_ONLY.test(text.en) && PLACEHOLDER_ONLY.test(text.zh);

export function resolveText(
  key: string,
  en: string | undefined,
  zh: string | undefined,
): { text?: Localized; untranslated: Lang[] } {
  const enMissing = isMissing(en, key);
  const zhMissing = isMissing(zh, key);
  if (enMissing && zhMissing) return { untranslated: [] };
  const enText = (enMissing ? zh : en) as string;
  const zhText = (zhMissing ? en : zh) as string;
  const untranslated: Lang[] = [...(zhMissing ? (["zh"] as const) : []), ...(enMissing ? (["en"] as const) : [])];
  return { text: { zh: zhText, en: enText }, untranslated };
}

function readCell(table: TableSource, key: string, en: string, zh: string | undefined): { cell?: Cell; issues: Issue[] } {
  const parsed = parseKey(key);
  if (!parsed) return { issues: [issue("skipped-key", `${table.namespace} › ${key}`)] };
  const field = FIELD_MAP[parsed.field.toLowerCase()];
  if (!field) return { issues: [issue("ignored-field", `${parsed.id}.${parsed.field}`)] };
  const { text, untranslated } = resolveText(key, en, zh);
  if (!text) return { issues: [issue("missing-text", `${table.namespace} › ${key}`)] };
  if (field !== "name" && isPlaceholderOnly(text)) {
    return { issues: [issue("placeholder-only", `${parsed.id}.${parsed.field}`)] };
  }
  const cell: Cell = { category: table.category, release: table.release, id: parsed.id, field, text, untranslated };
  return { cell, issues: [] };
}

function readTable(table: TableSource, locales: Record<Lang, LocaleFile>): { cells: Cell[]; issues: Issue[] } {
  const enTable = locales.en[table.namespace];
  if (!enTable) return { cells: [], issues: [issue("missing-namespace", table.namespace)] };
  const zhTable = locales.zh[table.namespace] ?? {};
  const results = Object.entries(enTable).map(([key, en]) => readCell(table, key, en, zhTable[key]));
  return {
    cells: results.flatMap((result) => (result.cell ? [result.cell] : [])),
    issues: results.flatMap((result) => result.issues),
  };
}

function mergeCells(cells: readonly Cell[]): Draft[] {
  const drafts = new Map<string, Draft>();
  for (const cell of cells) {
    const key = `${cell.category}:${cell.id}`;
    const previous: Draft = drafts.get(key) ?? {
      id: cell.id,
      category: cell.category,
      release: cell.release,
      untranslated: [],
    };
    const untranslated = [...new Set([...previous.untranslated, ...cell.untranslated])];
    drafts.set(key, { ...previous, [cell.field]: cell.text, untranslated });
  }
  return [...drafts.values()];
}

const compareRaw = (a: RawEntry, b: RawEntry): number =>
  CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.id.localeCompare(b.id, "en");

export function groupEntries(
  locales: Record<Lang, LocaleFile>,
  tables: readonly TableSource[],
): { entries: RawEntry[]; issues: Issue[] } {
  const read = tables.map((table) => readTable(table, locales));
  const drafts = mergeCells(read.flatMap((result) => result.cells));
  const named = drafts.filter((draft): draft is RawEntry => draft.name !== undefined);
  const missingName = drafts
    .filter((draft) => draft.name === undefined)
    .map((draft) => issue("missing-name", `${draft.category}:${draft.id}`));
  const untranslated = named
    .filter((entry) => entry.untranslated.length > 0)
    .map((entry) => issue("untranslated", `${entry.category}:${entry.id} (${entry.untranslated.join(", ")})`));
  return {
    entries: [...named].sort(compareRaw),
    issues: [...read.flatMap((result) => result.issues), ...missingName, ...untranslated],
  };
}
```

- [ ] **Step 9: 執行測試確認通過**

Run: `npx vitest run tests/unit/extract`
Expected: PASS（keys、group-entries、parse-locale 全過）。

- [ ] **Step 10: Commit**

```bash
git add scripts/extract/keys.ts scripts/extract/group-entries.ts tests/helpers/locales.ts tests/unit/extract/keys.test.ts tests/unit/extract/group-entries.test.ts
git commit -m "feat: parse localization keys and group them into entries" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 4: 遊戲標記轉安全 HTML

**Files:**
- Create: `scripts/extract/render-markup.ts`
- Test: `tests/unit/extract/render-markup.test.ts`

**Interfaces:**
- Consumes: `Lang`
- Produces: `escapeHtml(text): string`、`renderMarkup(text, lang): { html: string; warnings: string[] }`、`stripMarkup(text): string`。警告字串格式：`unknown tag <name>`、`invalid color "value"`。

- [ ] **Step 1: 寫失敗測試 `tests/unit/extract/render-markup.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { renderMarkup, stripMarkup } from "../../../scripts/extract/render-markup";

describe("renderMarkup", () => {
  it("escapes HTML special characters in plain text", () => {
    expect(renderMarkup(`say "hi" & 'bye'`, "en")).toEqual({
      html: "say &quot;hi&quot; &amp; &#39;bye&#39;",
      warnings: [],
    });
  });

  it("never emits script tags from injected markup", () => {
    const { html, warnings } = renderMarkup("<script>alert(1)</script>", "en");
    expect(html).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(warnings).toEqual(["unknown tag <script>"]);
  });

  it("renders emphasis in any case", () => {
    expect(renderMarkup("<emphasis>A</>", "en").html).toBe('<em class="emphasis">A</em>');
    expect(renderMarkup("<Emphasis>A</>", "en").html).toBe('<em class="emphasis">A</em>');
  });

  it("renders a valid decorator colour without alpha", () => {
    expect(renderMarkup('<SWDecorator Color="#E67740FF">警告</>：x', "zh").html).toBe(
      '<span style="color:#E67740">警告</span>：x',
    );
  });

  it("keeps only the text of a decorator with an invalid colour", () => {
    expect(renderMarkup('<SWDecorator Color="#FFF" onload="x">hi</>', "en")).toEqual({
      html: "hi",
      warnings: ['invalid color "#FFF"'],
    });
  });

  it("supports nesting", () => {
    expect(renderMarkup('<SWDecorator Color="#112233"><emphasis>A</></>', "en").html).toBe(
      '<span style="color:#112233"><em class="emphasis">A</em></span>',
    );
  });

  it("closes tags left open", () => {
    expect(renderMarkup("<emphasis>A", "en").html).toBe('<em class="emphasis">A</em>');
  });

  it("escapes a stray closing tag", () => {
    expect(renderMarkup("A</>", "en").html).toBe("A&lt;/&gt;");
  });

  it("keeps unknown tags and their closers as text", () => {
    expect(renderMarkup("<foo>x</>", "en")).toEqual({ html: "&lt;foo&gt;x&lt;/&gt;", warnings: ["unknown tag <foo>"] });
  });

  it("renders placeholders per language", () => {
    expect(renderMarkup("提高 {0}", "zh").html).toBe('提高 <span class="placeholder">{數值}</span>');
    expect(renderMarkup("deal {damage}", "en").html).toBe('deal <span class="placeholder">{value}</span>');
  });

  it("turns newlines into line breaks", () => {
    expect(renderMarkup("a\nb\r\nc", "en").html).toBe("a<br>b<br>c");
  });
});

describe("stripMarkup", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripMarkup("<emphasis>Sage</>   Belt ")).toBe("Sage Belt");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/render-markup.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 3: 建立 `scripts/extract/render-markup.ts`**

```ts
import type { Lang } from "./config";

const PLACEHOLDER_LABEL: Readonly<Record<Lang, string>> = { zh: "{數值}", en: "{value}" };
const HEX_COLOR = /^#([0-9A-Fa-f]{6})(?:[0-9A-Fa-f]{2})?$/;
const TOKEN = /<([A-Za-z]+)((?:\s+[A-Za-z]+="[^"]*")*)\s*>|<\/>|\{(\w+)\}|\r?\n/g;
const ATTRIBUTE = /([A-Za-z]+)="([^"]*)"/g;
const ANY_TAG = /<[A-Za-z]+(?:\s+[A-Za-z]+="[^"]*")*\s*>|<\/>/g;

type Frame = "em" | "span" | "none" | "literal";

const CLOSE: Readonly<Record<Frame, string>> = { em: "</em>", span: "</span>", none: "", literal: "&lt;/&gt;" };
const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export interface RenderResult {
  readonly html: string;
  readonly warnings: string[];
}

function parseAttributes(raw: string): Record<string, string> {
  return Object.fromEntries([...raw.matchAll(ATTRIBUTE)].map(([, key, value]) => [key.toLowerCase(), value]));
}

function openTag(name: string, rawAttributes: string, literal: string): { html: string; frame: Frame; warning?: string } {
  const tag = name.toLowerCase();
  if (tag === "emphasis") return { html: '<em class="emphasis">', frame: "em" };
  if (tag === "swdecorator") {
    const color = parseAttributes(rawAttributes).color ?? "";
    const match = HEX_COLOR.exec(color);
    return match
      ? { html: `<span style="color:#${match[1]}">`, frame: "span" }
      : { html: "", frame: "none", warning: `invalid color "${color}"` };
  }
  return { html: escapeHtml(literal), frame: "literal", warning: `unknown tag <${name}>` };
}

export function renderMarkup(text: string, lang: Lang): RenderResult {
  const stack: Frame[] = [];
  const warnings: string[] = [];
  let html = "";
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [token, tagName, rawAttributes, placeholder] = match;
    html += escapeHtml(text.slice(last, match.index));
    last = match.index + token.length;
    if (tagName !== undefined) {
      const opened = openTag(tagName, rawAttributes ?? "", token);
      html += opened.html;
      stack.push(opened.frame);
      if (opened.warning) warnings.push(opened.warning);
    } else if (token === "</>") {
      const frame = stack.pop();
      html += frame ? CLOSE[frame] : "&lt;/&gt;";
    } else if (placeholder !== undefined) {
      html += `<span class="placeholder">${PLACEHOLDER_LABEL[lang]}</span>`;
    } else {
      html += "<br>";
    }
  }
  html += escapeHtml(text.slice(last));
  html += [...stack].reverse().map((frame) => (frame === "literal" ? "" : CLOSE[frame])).join("");
  return { html, warnings };
}

export const stripMarkup = (text: string): string => text.replace(ANY_TAG, "").replace(/\s+/g, " ").trim();
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/unit/extract/render-markup.test.ts`
Expected: PASS（12 tests）。

- [ ] **Step 5: Commit**

```bash
git add scripts/extract/render-markup.ts tests/unit/extract/render-markup.test.ts
git commit -m "feat: render game markup to sanitized HTML" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 5: 圖示配對

**Files:**
- Create: `scripts/extract/match-icons.ts`, `scripts/extract/icon-files.ts`, `scripts/extract/icon-overrides.json`
- Test: `tests/unit/extract/match-icons.test.ts`, `tests/unit/extract/icon-files.test.ts`

**Interfaces:**
- Consumes: `PATHS`、`ExtractError`、`formatZodIssue`、`readJsonFile`
- Produces:
  - `match-icons.ts`：`tokenize(name): string[]`、`type IconIndex = ReadonlyMap<string, readonly string[]>`、`buildIconIndex(files): IconIndex`、`type IconOverrides = Readonly<Record<string, string | null>>`、`type IconMatch = {kind:"matched"; file; via:"auto"|"override"} | {kind:"none"} | {kind:"missing"} | {kind:"ambiguous"; candidates}`、`matchIcon(id, index, overrides): IconMatch`
  - `icon-files.ts`：`listIconFiles(sourceRoot): Promise<string[] | null>`（回傳相對 `sourceRoot` 的 posix 路徑；圖示根目錄不存在時回 `null`）、`loadOverrides(filePath): Promise<IconOverrides>`（檔案不存在回 `{}`）

**配對規則**：檔名去副檔名後依 `_`、空白、`-` 與小寫→大寫邊界拆詞並轉小寫；丟掉 `t`、`ui`、`icon`、`png`；`chestplate→chest`、`gauntlets→gauntlet`；`unique\d*→unique`。圖示以「詞的所有排列串接」建索引（最多 6 個詞），Id 去掉 `Artifact_` 後以「詞依序串接」查詢。這樣能處理詞序不同（`Boots_Disciple`）、大小寫拆詞不同（`Moonsword`、`TotemofShielding`）與多餘尾碼（`_Icon_png`）。

- [ ] **Step 1: 寫失敗測試 `tests/unit/extract/match-icons.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildIconIndex, matchIcon, tokenize } from "../../../scripts/extract/match-icons";

const FILES = [
  "E/Weapons/Sword/T_UI_Sword_Icon.png",
  "E/Weapons/Sword/Sword_Unique/T_UI_Sword_Unique_Icon.png",
  "E/Weapons/Moonsword/T_UI_Moonsword_Icon.png",
  "E/Armor/Disciple_Armor/T_UI_Boots_Disciple_Icon.png",
  "E/Armor/Mystic_Armor/T_UI_MysticChestplate_Icon.png",
  "E/Armor/Stalwart_Armor/T_UI_Chest_Stalwart_Icon_png.png",
  "E/Armor/Realmreacher_Armor/T_UI_Helmet_Realmreacher.png",
  "E/Weapons/Gauntlets/T_UI_Gauntlets_Icon.png",
  "E/Artifacts/Satchels/T_UI_Icon_Satchel_Fire.png",
  "E/Artifacts/TotemOfShielding/T_UI_TotemofShielding_Icon.png",
  "E/Dupes/A/T_UI_Twin_Icon.png",
  "E/Dupes/B/T_UI_Twin_Icon.png",
];
const index = buildIconIndex(FILES);

describe("tokenize", () => {
  it("drops noise tokens and normalises aliases", () => {
    expect(tokenize("T_UI_Chest_Stalwart_Icon_png")).toEqual(["chest", "stalwart"]);
    expect(tokenize("T_UI_MysticChestplate_Icon")).toEqual(["mystic", "chest"]);
    expect(tokenize("Sword_Unique1")).toEqual(["sword", "unique"]);
  });
});

describe("matchIcon", () => {
  it.each([
    ["Sword", FILES[0]],
    ["Sword_Unique1", FILES[1]],
    ["MoonSword", FILES[2]],
    ["DiscipleBoots", FILES[3]],
    ["MysticChest", FILES[4]],
    ["StalwartChest", FILES[5]],
    ["RealmreacherHelmet", FILES[6]],
    ["Gauntlet", FILES[7]],
    ["Artifact_Satchel_Fire", FILES[8]],
    ["Artifact_TotemOfShielding", FILES[9]],
  ])("auto-matches %s", (id, file) => {
    expect(matchIcon(id, index, {})).toEqual({ kind: "matched", file, via: "auto" });
  });

  it("reports ambiguous candidates", () => {
    expect(matchIcon("Twin", index, {})).toEqual({ kind: "ambiguous", candidates: [FILES[10], FILES[11]] });
  });

  it("reports a missing icon", () => {
    expect(matchIcon("Nothing", index, {})).toEqual({ kind: "missing" });
  });

  it("prefers an override path", () => {
    expect(matchIcon("Sword", index, { Sword: "custom/x.png" })).toEqual({
      kind: "matched",
      file: "custom/x.png",
      via: "override",
    });
  });

  it("treats a null override as an explicit no-icon", () => {
    expect(matchIcon("Sword", index, { Sword: null })).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: 寫失敗測試 `tests/unit/extract/icon-files.test.ts`**

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { listIconFiles, loadOverrides } from "../../../scripts/extract/icon-files";
import { ExtractError } from "../../../scripts/extract/issues";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mcd2-icons-"));
});

async function touch(relative: string, content = "x"): Promise<string> {
  const file = path.join(dir, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return file;
}

describe("listIconFiles", () => {
  it("lists only T_UI_*.png files as source-relative posix paths", async () => {
    const root = "Assets/Art/Characters/Player/Equipment";
    await touch(`${root}/Weapons/Sword/T_UI_Sword_Icon.png`);
    await touch(`${root}/Weapons/Sword/T_Sword.png`);
    await touch(`${root}/Weapons/Sword/T_UI_Notes.txt`);
    await expect(listIconFiles(dir)).resolves.toEqual([`${root}/Weapons/Sword/T_UI_Sword_Icon.png`]);
  });

  it("returns null when the icon root does not exist", async () => {
    await expect(listIconFiles(dir)).resolves.toBeNull();
  });
});

describe("loadOverrides", () => {
  it("returns an empty object when the file is missing", async () => {
    await expect(loadOverrides(path.join(dir, "none.json"))).resolves.toEqual({});
  });

  it("reads string and null overrides", async () => {
    const file = await touch("o.json", JSON.stringify({ A: "x.png", B: null }));
    await expect(loadOverrides(file)).resolves.toEqual({ A: "x.png", B: null });
  });

  it("rejects values that are not strings or null", async () => {
    const file = await touch("o.json", JSON.stringify({ A: 1 }));
    await expect(loadOverrides(file)).rejects.toThrow(ExtractError);
    await expect(loadOverrides(file)).rejects.toThrow(/圖示對照檔格式錯誤/);
  });

  it("rejects invalid JSON", async () => {
    const file = await touch("o.json", "{");
    await expect(loadOverrides(file)).rejects.toThrow(/圖示對照檔不是合法 JSON/);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/match-icons.test.ts tests/unit/extract/icon-files.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 4: 建立 `scripts/extract/match-icons.ts`**

```ts
import path from "node:path";

const DROP_TOKENS: ReadonlySet<string> = new Set(["t", "ui", "icon", "png"]);
const TOKEN_ALIASES: Readonly<Record<string, string>> = { chestplate: "chest", gauntlets: "gauntlet" };
const MAX_PERMUTATION_TOKENS = 6;
const ID_PREFIX = /^Artifact_/;

export type IconIndex = ReadonlyMap<string, readonly string[]>;
export type IconOverrides = Readonly<Record<string, string | null>>;
export type IconMatch =
  | { readonly kind: "matched"; readonly file: string; readonly via: "auto" | "override" }
  | { readonly kind: "none" }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] };

export function tokenize(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[_\s-]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token !== "" && !DROP_TOKENS.has(token))
    .map((token) => TOKEN_ALIASES[token] ?? token)
    .map((token) => (/^unique\d*$/.test(token) ? "unique" : token));
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

export function buildIconIndex(files: readonly string[]): IconIndex {
  const index = new Map<string, string[]>();
  for (const file of files) {
    const tokens = tokenize(path.posix.basename(file, path.posix.extname(file)));
    if (tokens.length === 0 || tokens.length > MAX_PERMUTATION_TOKENS) continue;
    const keys = new Set(permutations(tokens).map((perm) => perm.join("")));
    for (const key of keys) index.set(key, [...(index.get(key) ?? []), file]);
  }
  return index;
}

export function matchIcon(id: string, index: IconIndex, overrides: IconOverrides): IconMatch {
  if (Object.hasOwn(overrides, id)) {
    const file = overrides[id];
    return file === null ? { kind: "none" } : { kind: "matched", file, via: "override" };
  }
  const key = tokenize(id.replace(ID_PREFIX, "")).join("");
  const candidates = [...new Set(index.get(key) ?? [])];
  if (candidates.length === 1) return { kind: "matched", file: candidates[0], via: "auto" };
  if (candidates.length === 0) return { kind: "missing" };
  return { kind: "ambiguous", candidates };
}
```

- [ ] **Step 5: 建立 `scripts/extract/icon-files.ts`**

```ts
import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PATHS } from "./config";
import { ExtractError, formatZodIssue } from "./issues";
import type { IconOverrides } from "./match-icons";
import { readJsonFile } from "./read-json";

const ICON_FILE = /(?:^|\/)T_UI_[^/]*\.png$/i;
const OverridesSchema = z.record(z.string(), z.string().nullable());

export async function listIconFiles(sourceRoot: string): Promise<string[] | null> {
  const root = path.join(sourceRoot, ...PATHS.iconRootRel.split("/"));
  try {
    const names = await readdir(root, { recursive: true });
    return names
      .map((name) => name.split(path.sep).join("/"))
      .filter((name) => ICON_FILE.test(name))
      .map((name) => `${PATHS.iconRootRel}/${name}`)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ExtractError(`無法讀取圖示目錄：${root}（${(error as Error).message}）`);
  }
}

export async function loadOverrides(filePath: string): Promise<IconOverrides> {
  const json = await readJsonFile(filePath, "圖示對照檔");
  if (json === undefined) return {};
  const parsed = OverridesSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractError(`圖示對照檔格式錯誤：${filePath} ${formatZodIssue(parsed.error.issues[0])}`);
  }
  return parsed.data;
}
```

- [ ] **Step 6: 建立 `scripts/extract/icon-overrides.json`（已對真實資料確認的 7 筆）**

```json
{
  "Artifact_FlameQuiver": "Assets/Art/Characters/Player/Equipment/Artifacts/ElementalQuivers/Quiver_Fire/T_UI_Quiver_Burning_Icon.png",
  "Artifact_FrostBracelet": "Assets/Art/Characters/Player/Equipment/Artifacts/Bracelet/Bracelet_Freezing/T_UI_BraceletFreezing_Icon.png",
  "Artifact_FrostQuiver": "Assets/Art/Characters/Player/Equipment/Artifacts/ElementalQuivers/Quiver_Freezing/T_UI_Quiver_Freezing_Icon.png",
  "Artifact_LightningQuiver": "Assets/Art/Characters/Player/Equipment/Artifacts/ElementalQuivers/Quiver_Conductive/T_UI_Quiver_Conductor_Icon.png",
  "Artifact_PoisonQuiver": "Assets/Art/Characters/Player/Equipment/Artifacts/ElementalQuivers/Quiver_Poison/T_UI_Quiver_Poisoned_Icon.png",
  "Artifact_RedstoneMines": "Assets/Art/Characters/Player/Equipment/Artifacts/RedstoneMineLauncher/T_UI_RedstoneMinelauncher_Icon.png",
  "Artifact_WarriorsDrums": "Assets/Art/Characters/Player/Equipment/Artifacts/Instruments/WarriorsDrum/T_UI_Icon_WarriorsDrum.png"
}
```

- [ ] **Step 7: 執行測試確認通過**

Run: `npx vitest run tests/unit/extract/match-icons.test.ts tests/unit/extract/icon-files.test.ts`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add scripts/extract/match-icons.ts scripts/extract/icon-files.ts scripts/extract/icon-overrides.json tests/unit/extract/match-icons.test.ts tests/unit/extract/icon-files.test.ts
git commit -m "feat: match item ids to icon files with overrides" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 6: 組裝條目與 slug 唯一性

**Files:**
- Create: `scripts/extract/assemble.ts`, `tests/helpers/entries.ts`
- Test: `tests/unit/extract/assemble.test.ts`

**Interfaces:**
- Consumes: `RawEntry`、`renderMarkup`、`stripMarkup`、`toSlug`、`variantOf`、`armorPieceOf`、`Entry`
- Produces:
  - `assembleEntry(raw: RawEntry, icon?: string): { entry: Entry; issues: Issue[] }`（`links` 一律為 `{}`）
  - `assertUniqueSlugs(entries: readonly Entry[]): void`（同分類重複時丟 `ExtractError`，訊息以 `slug 衝突：` 開頭）
  - `tests/helpers/entries.ts`：`makeEntry(id, category, extra?): Entry`

- [ ] **Step 1: 建立 `tests/helpers/entries.ts`**

```ts
import type { Category } from "../../scripts/extract/config";
import { armorPieceOf, toSlug, variantOf } from "../../scripts/extract/keys";
import type { Entry } from "../../scripts/extract/schemas";

export function makeEntry(id: string, category: Category, extra: Partial<Entry> = {}): Entry {
  const armorPiece = category === "armor" ? armorPieceOf(id) : undefined;
  return {
    id,
    slug: toSlug(id),
    category,
    variant: variantOf(id),
    release: "base",
    name: { zh: id, en: id },
    ...(armorPiece ? { armorPiece } : {}),
    links: {},
    ...extra,
  };
}
```

- [ ] **Step 2: 寫失敗測試 `tests/unit/extract/assemble.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { assembleEntry, assertUniqueSlugs } from "../../../scripts/extract/assemble";
import type { RawEntry } from "../../../scripts/extract/group-entries";
import { ExtractError } from "../../../scripts/extract/issues";
import { makeEntry } from "../../helpers/entries";

const raw = (overrides: Partial<RawEntry> = {}): RawEntry => ({
  id: "Sword_Unique1",
  category: "melee",
  release: "base",
  untranslated: [],
  name: { zh: "燃燒之刃", en: "The Burning Blade" },
  ...overrides,
});

describe("assembleEntry", () => {
  it("derives slug and variant and renders descriptions per language", () => {
    const { entry, issues } = assembleEntry(
      raw({ description: { zh: "造成 {0} 傷害。\n好用", en: "Deals {0} damage.\nNice" } }),
    );
    expect(entry).toMatchObject({ slug: "sword-unique1", variant: "unique", links: {} });
    expect(entry.description).toEqual({
      zh: '造成 <span class="placeholder">{數值}</span> 傷害。<br>好用',
      en: 'Deals <span class="placeholder">{value}</span> damage.<br>Nice',
    });
    expect(issues).toEqual([]);
  });

  it("strips markup from names", () => {
    const { entry } = assembleEntry(raw({ name: { zh: "<emphasis>賢者</>腰帶", en: "<emphasis>Sage</> Belt" } }));
    expect(entry.name).toEqual({ zh: "賢者腰帶", en: "Sage Belt" });
  });

  it("includes the icon only when given", () => {
    expect(assembleEntry(raw(), "icons/melee/sword-unique1.png").entry.icon).toBe("icons/melee/sword-unique1.png");
    expect("icon" in assembleEntry(raw()).entry).toBe(false);
  });

  it("sets the armor piece for armor entries only", () => {
    expect(assembleEntry(raw({ id: "DiscipleBoots", category: "armor" })).entry.armorPiece).toBe("boots");
    expect("armorPiece" in assembleEntry(raw()).entry).toBe(false);
  });

  it("copies untranslated languages only when present", () => {
    expect(assembleEntry(raw({ untranslated: ["zh"] })).entry.untranslated).toEqual(["zh"]);
    expect("untranslated" in assembleEntry(raw()).entry).toBe(false);
  });

  it("reports markup warnings with the entry location", () => {
    const { issues } = assembleEntry(raw({ id: "Sword", description: { zh: "<foo>x</>", en: "<foo>x</>" } }));
    expect(issues).toEqual([{ type: "markup-warning", detail: "melee:Sword: unknown tag <foo>" }]);
  });
});

describe("assertUniqueSlugs", () => {
  it("allows the same slug in different categories", () => {
    expect(() => assertUniqueSlugs([makeEntry("Arcane", "enchantment"), makeEntry("Arcane", "status")])).not.toThrow();
  });

  it("throws on a slug collision inside one category", () => {
    const entries = [makeEntry("A", "melee", { slug: "x" }), makeEntry("B", "melee", { slug: "x" })];
    expect(() => assertUniqueSlugs(entries)).toThrow(ExtractError);
    expect(() => assertUniqueSlugs(entries)).toThrow("slug 衝突：melee/x（A、B）");
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/assemble.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 4: 建立 `scripts/extract/assemble.ts`**

```ts
import type { RawEntry } from "./group-entries";
import { ExtractError, issue, type Issue } from "./issues";
import { armorPieceOf, toSlug, variantOf } from "./keys";
import { renderMarkup, stripMarkup } from "./render-markup";
import type { Entry, Localized } from "./schemas";

interface Rendered {
  readonly value: Localized;
  readonly issues: Issue[];
}

function renderLocalized(value: Localized, where: string): Rendered {
  const zh = renderMarkup(value.zh, "zh");
  const en = renderMarkup(value.en, "en");
  const warnings = [...new Set([...zh.warnings, ...en.warnings])];
  return {
    value: { zh: zh.html, en: en.html },
    issues: warnings.map((warning) => issue("markup-warning", `${where}: ${warning}`)),
  };
}

export function assembleEntry(raw: RawEntry, icon?: string): { entry: Entry; issues: Issue[] } {
  const where = `${raw.category}:${raw.id}`;
  const description = raw.description ? renderLocalized(raw.description, where) : undefined;
  const descriptionLong = raw.descriptionLong ? renderLocalized(raw.descriptionLong, where) : undefined;
  const armorPiece = raw.category === "armor" ? armorPieceOf(raw.id) : undefined;
  const entry: Entry = {
    id: raw.id,
    slug: toSlug(raw.id),
    category: raw.category,
    variant: variantOf(raw.id),
    release: raw.release,
    name: { zh: stripMarkup(raw.name.zh), en: stripMarkup(raw.name.en) },
    ...(description ? { description: description.value } : {}),
    ...(descriptionLong ? { descriptionLong: descriptionLong.value } : {}),
    ...(icon ? { icon } : {}),
    ...(armorPiece ? { armorPiece } : {}),
    ...(raw.untranslated.length > 0 ? { untranslated: [...raw.untranslated] } : {}),
    links: {},
  };
  return { entry, issues: [...(description?.issues ?? []), ...(descriptionLong?.issues ?? [])] };
}

export function assertUniqueSlugs(entries: readonly Entry[]): void {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const entry of entries) {
    const key = `${entry.category}/${entry.slug}`;
    const previous = seen.get(key);
    if (previous) duplicates.push(`${key}（${previous}、${entry.id}）`);
    else seen.set(key, entry.id);
  }
  if (duplicates.length > 0) throw new ExtractError(`slug 衝突：${duplicates.join("；")}`);
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run tests/unit/extract/assemble.test.ts`
Expected: PASS（8 tests）。

- [ ] **Step 6: Commit**

```bash
git add scripts/extract/assemble.ts tests/helpers/entries.ts tests/unit/extract/assemble.test.ts
git commit -m "feat: assemble entries and enforce per-category slug uniqueness" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 7: 條目連結與護甲套裝

**Files:**
- Create: `scripts/extract/link-entries.ts`
- Test: `tests/unit/extract/link-entries.test.ts`

**Interfaces:**
- Consumes: `Entry`、`ArmorSet`、`ARMOR_PIECES`、`baseId`、`toSlug`、`issue()`、`makeEntry`（測試）
- Produces: `commonPrefix(values): string`、`setNameFor(lang, names): string | undefined`、`linkEntries(entries): { entries: Entry[]; armorSets: ArmorSet[]; issues: Issue[] }`

**規則**：
- 只在 `release: "base"` 條目之間建立連結；upcoming 條目的 `links` 一律為 `{}`。
- variant：同分類、同 `baseId` 的其他條目 slug。
- 附魔書 → 附魔：先比 Id（去掉 `EnchantmentBook_`），再比正規化的英文名稱；都找不到時發出 `unlinked-enchantment`。
- 護甲套裝：Id 去掉 unique 後綴與部位字（Helmet/Chest/Leggings/Boots）得到套裝基底；獨特版另成一套（`<base>_Unique`、slug 加 `-unique`）。
- 套裝名稱：各部位名稱的最長共同前綴；en 退到詞邊界，zh 去掉結尾「之」；少於 2 個部位或結果短於 2 字時，改用套裝 Id（獨特版為 `<base> (Unique)`）並發出 `armor-set-name-fallback`。
- `pieces` 只放實際存在的部位。

- [ ] **Step 1: 寫失敗測試 `tests/unit/extract/link-entries.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { commonPrefix, linkEntries, setNameFor } from "../../../scripts/extract/link-entries";
import { makeEntry } from "../../helpers/entries";

const find = (entries: ReturnType<typeof linkEntries>["entries"], id: string) => entries.find((e) => e.id === id);

describe("linkEntries — variants", () => {
  it("links normal and unique variants both ways", () => {
    const { entries } = linkEntries([makeEntry("Sword", "melee"), makeEntry("Sword_Unique1", "melee")]);
    expect(find(entries, "Sword")?.links).toEqual({ variants: ["sword-unique1"] });
    expect(find(entries, "Sword_Unique1")?.links).toEqual({ variants: ["sword"] });
  });

  it("never links to upcoming entries", () => {
    const { entries } = linkEntries([
      makeEntry("Halberd", "melee"),
      makeEntry("Halberd_Unique1", "melee", { release: "upcoming" }),
    ]);
    expect(find(entries, "Halberd")?.links).toEqual({});
    expect(find(entries, "Halberd_Unique1")?.links).toEqual({});
  });
});

describe("linkEntries — enchantment books", () => {
  it("links books and enchantments by id", () => {
    const { entries } = linkEntries([makeEntry("Arcane", "enchantment"), makeEntry("EnchantmentBook_Arcane", "enchantment-book")]);
    expect(find(entries, "Arcane")?.links).toEqual({ enchantmentBook: "arcane" });
    expect(find(entries, "EnchantmentBook_Arcane")?.links).toEqual({ enchantment: "arcane" });
  });

  it("falls back to the English name when ids differ", () => {
    const name = { zh: "靈魂火焰", en: "Soul Fire Aspect" };
    const { entries, issues } = linkEntries([
      makeEntry("SoulFireAspect", "enchantment", { name }),
      makeEntry("EnchantmentBook_SoulAspect", "enchantment-book", { name: { ...name, en: " soul fire aspect " } }),
    ]);
    expect(find(entries, "EnchantmentBook_SoulAspect")?.links).toEqual({ enchantment: "soul-fire-aspect" });
    expect(issues).toEqual([]);
  });

  it("reports books without an enchantment", () => {
    const { issues } = linkEntries([makeEntry("EnchantmentBook_Lonely", "enchantment-book")]);
    expect(issues).toEqual([{ type: "unlinked-enchantment", detail: "EnchantmentBook_Lonely" }]);
  });
});

describe("linkEntries — armor sets", () => {
  const disciple = [
    makeEntry("DiscipleHelmet", "armor", { name: { zh: "修行者面具", en: "Disciple mask" } }),
    makeEntry("DiscipleChest", "armor", { name: { zh: "修行者長袍", en: "Disciple Robe" } }),
    makeEntry("DiscipleHelmet_Unique", "armor", { name: { zh: "賢者頭帶", en: "Sage Headband" } }),
    makeEntry("DiscipleChest_Unique", "armor", { name: { zh: "賢者短袍", en: "Sage Tunic" } }),
  ];

  it("groups pieces into normal and unique sets named by their common prefix", () => {
    const { armorSets, issues } = linkEntries(disciple);
    expect(armorSets).toEqual([
      {
        id: "Disciple",
        slug: "disciple",
        variant: "normal",
        name: { zh: "修行者", en: "Disciple" },
        pieces: { helmet: "disciple-helmet", chest: "disciple-chest" },
      },
      {
        id: "Disciple_Unique",
        slug: "disciple-unique",
        variant: "unique",
        name: { zh: "賢者", en: "Sage" },
        pieces: { helmet: "disciple-helmet-unique", chest: "disciple-chest-unique" },
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("links each piece to its set", () => {
    const { entries } = linkEntries(disciple);
    expect(find(entries, "DiscipleChest_Unique")?.links).toMatchObject({ armorSet: "disciple-unique" });
  });

  it("lists only pieces that exist", () => {
    const { armorSets } = linkEntries(disciple);
    expect(Object.keys(armorSets[0].pieces)).toEqual(["helmet", "chest"]);
  });

  it("falls back to the set id for a single-piece set", () => {
    const { armorSets, issues } = linkEntries([
      makeEntry("WolfclutchHelmet_Unique", "armor", { name: { zh: "狼爪頭盔", en: "Wolf Helm" } }),
    ]);
    expect(armorSets[0].name).toEqual({ zh: "Wolfclutch (Unique)", en: "Wolfclutch (Unique)" });
    expect(issues).toEqual([{ type: "armor-set-name-fallback", detail: "Wolfclutch_Unique" }]);
  });

  it("leaves upcoming armor out of sets", () => {
    const { armorSets } = linkEntries([makeEntry("TimewornHelmet", "armor", { release: "upcoming" })]);
    expect(armorSets).toEqual([]);
  });
});

describe("set naming helpers", () => {
  it("computes the common prefix", () => {
    expect(commonPrefix([])).toBe("");
    expect(commonPrefix(["abc", "abd"])).toBe("ab");
  });

  it("cuts English names back to a word boundary", () => {
    expect(setNameFor("en", ["Scamp Hat", "Scamp Hood"])).toBe("Scamp");
    expect(setNameFor("en", ["Hat", "Hood"])).toBeUndefined();
  });

  it("drops a trailing 之 in Chinese names", () => {
    expect(setNameFor("zh", ["狂化隙浮特之爪", "狂化隙浮特之牙"])).toBe("狂化隙浮特");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/link-entries.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 3: 建立 `scripts/extract/link-entries.ts`**

```ts
import type { Lang } from "./config";
import { issue, type Issue } from "./issues";
import { baseId, toSlug } from "./keys";
import { ARMOR_PIECES, type ArmorSet, type Entry } from "./schemas";

export interface LinkResult {
  readonly entries: Entry[];
  readonly armorSets: ArmorSet[];
  readonly issues: Issue[];
}

interface SetDraft {
  readonly id: string;
  readonly slug: string;
  readonly variant: Entry["variant"];
  readonly members: readonly Entry[];
}

const BOOK_PREFIX = /^EnchantmentBook_/;
const PIECE_PATTERN = /(Helmet|Chest|Leggings|Boots)/;
const entryKey = (entry: Entry): string => `${entry.category}:${entry.id}`;
const normalizeName = (name: string): string => name.trim().toLowerCase();

export function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  return values.reduce((prefix, value) => {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    return prefix.slice(0, i);
  });
}

function trimToWordBoundary(prefix: string, names: readonly string[]): string {
  const atBoundary =
    /\s$/.test(prefix) || names.every((name) => name.length === prefix.length || /\s/.test(name.charAt(prefix.length)));
  return atBoundary ? prefix : prefix.slice(0, prefix.lastIndexOf(" ") + 1);
}

export function setNameFor(lang: Lang, names: readonly string[]): string | undefined {
  if (names.length < 2) return undefined;
  const prefix = commonPrefix(names);
  const cut = lang === "en" ? trimToWordBoundary(prefix, names) : prefix.replace(/之$/, "");
  const trimmed = cut.trim();
  return [...trimmed].length >= 2 ? trimmed : undefined;
}

function variantLinks(published: readonly Entry[]): Map<string, string[]> {
  const groups = new Map<string, Entry[]>();
  for (const entry of published) {
    const key = `${entry.category}:${baseId(entry.id)}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return new Map(
    published.map((entry) => {
      const group = groups.get(`${entry.category}:${baseId(entry.id)}`) ?? [];
      return [entryKey(entry), group.filter((other) => other !== entry).map((other) => other.slug)];
    }),
  );
}

function bookLinks(published: readonly Entry[]) {
  const enchantments = published.filter((entry) => entry.category === "enchantment");
  const byId = new Map(enchantments.map((entry) => [entry.id, entry]));
  const byName = new Map(enchantments.map((entry) => [normalizeName(entry.name.en), entry]));
  const pairs = published
    .filter((entry) => entry.category === "enchantment-book")
    .map((book) => ({
      book,
      target: byId.get(book.id.replace(BOOK_PREFIX, "")) ?? byName.get(normalizeName(book.name.en)),
    }));
  const linked = pairs.flatMap((pair) => (pair.target ? [{ book: pair.book, target: pair.target }] : []));
  return {
    bookToEnchantment: new Map(linked.map((pair) => [pair.book.id, pair.target.slug])),
    enchantmentToBook: new Map(linked.map((pair) => [pair.target.id, pair.book.slug])),
    issues: pairs.filter((pair) => !pair.target).map((pair) => issue("unlinked-enchantment", pair.book.id)),
  };
}

function setIdentity(entry: Entry): { id: string; slug: string } | undefined {
  const match = PIECE_PATTERN.exec(baseId(entry.id));
  if (!match) return undefined;
  const setBase = baseId(entry.id).replace(match[1], "");
  if (setBase === "") return undefined;
  return entry.variant === "unique"
    ? { id: `${setBase}_Unique`, slug: `${toSlug(setBase)}-unique` }
    : { id: setBase, slug: toSlug(setBase) };
}

function toArmorSet(draft: SetDraft): { set: ArmorSet; issues: Issue[] } {
  const fallback = draft.variant === "unique" ? `${draft.id.replace(/_Unique$/, "")} (Unique)` : draft.id;
  const zh = setNameFor("zh", draft.members.map((member) => member.name.zh));
  const en = setNameFor("en", draft.members.map((member) => member.name.en));
  const pieces = Object.fromEntries(
    ARMOR_PIECES.flatMap((piece) => {
      const member = draft.members.find((candidate) => candidate.armorPiece === piece);
      return member ? [[piece, member.slug]] : [];
    }),
  ) as ArmorSet["pieces"];
  return {
    set: { id: draft.id, slug: draft.slug, variant: draft.variant, name: { zh: zh ?? fallback, en: en ?? fallback }, pieces },
    issues: zh && en ? [] : [issue("armor-set-name-fallback", draft.id)],
  };
}

function buildArmorSets(published: readonly Entry[]) {
  const drafts = new Map<string, SetDraft>();
  for (const entry of published.filter((candidate) => candidate.category === "armor" && candidate.armorPiece)) {
    const identity = setIdentity(entry);
    if (!identity) continue;
    const previous = drafts.get(identity.slug);
    drafts.set(identity.slug, { ...identity, variant: entry.variant, members: [...(previous?.members ?? []), entry] });
  }
  const built = [...drafts.values()].map(toArmorSet);
  return {
    sets: built.map((result) => result.set).sort((a, b) => a.slug.localeCompare(b.slug, "en")),
    pieceToSet: new Map([...drafts.values()].flatMap((draft) => draft.members.map((member) => [member.id, draft.slug] as const))),
    issues: built.flatMap((result) => result.issues),
  };
}

function compactLinks(links: Entry["links"]): Entry["links"] {
  return Object.fromEntries(
    Object.entries(links).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)),
  );
}

export function linkEntries(entries: readonly Entry[]): LinkResult {
  const published = entries.filter((entry) => entry.release === "base");
  const variants = variantLinks(published);
  const books = bookLinks(published);
  const armor = buildArmorSets(published);
  const linked = entries.map((entry): Entry => {
    if (entry.release !== "base") return { ...entry, links: {} };
    return {
      ...entry,
      links: compactLinks({
        variants: variants.get(entryKey(entry)),
        enchantment: entry.category === "enchantment-book" ? books.bookToEnchantment.get(entry.id) : undefined,
        enchantmentBook: entry.category === "enchantment" ? books.enchantmentToBook.get(entry.id) : undefined,
        armorSet: entry.category === "armor" ? armor.pieceToSet.get(entry.id) : undefined,
      }),
    };
  });
  return { entries: linked, armorSets: armor.sets, issues: [...books.issues, ...armor.issues] };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/unit/extract/link-entries.test.ts`
Expected: PASS（13 tests）。

- [ ] **Step 5: Commit**

```bash
git add scripts/extract/link-entries.ts tests/unit/extract/link-entries.test.ts
git commit -m "feat: link variants, enchantment books and armor sets" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 8: 管線串接、輸出、報告與 CLI

**Files:**
- Create: `scripts/extract/output.ts`, `scripts/extract/report.ts`, `scripts/extract/pipeline.ts`, `scripts/extract/index.ts`
- Test: `tests/unit/extract/output.test.ts`, `tests/unit/extract/report.test.ts`, `tests/integration/pipeline.test.ts`

**Interfaces:**
- Consumes: 前述所有模組
- Produces:
  - `output.ts`：`iconWebPath(category, slug): string`、`sortEntries(entries): Entry[]`、`validateOutput(entries, armorSets): { entries: Entry[]; armorSets: ArmorSet[] }`、`writeOutputs(outRoot, output, report): Promise<void>`、`interface IconCopy { from; to }`、`copyIcons(copies, iconsDir): Promise<void>`
  - `report.ts`：`renderReport({ entries, armorSets, issues }): string`
  - `pipeline.ts`：`interface ExtractOptions { sourceRoot; outRoot; overridesPath }`、`interface ExtractSummary { entries: number; armorSets: number; icons: number; issues: Issue[] }`、`runExtract(options): Promise<ExtractSummary>`
  - 產物：`<outRoot>/src/data/entries.json`、`<outRoot>/src/data/armor-sets.json`、`<outRoot>/public/icons/<category>/<slug>.png`、`<outRoot>/extract-report.md`

- [ ] **Step 1: 寫失敗測試 `tests/unit/extract/output.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ExtractError } from "../../../scripts/extract/issues";
import { iconWebPath, sortEntries, validateOutput } from "../../../scripts/extract/output";
import { makeEntry } from "../../helpers/entries";

describe("output helpers", () => {
  it("builds icon web paths", () => {
    expect(iconWebPath("melee", "sword")).toBe("icons/melee/sword.png");
  });

  it("sorts by category order then slug without mutating the input", () => {
    const input = [makeEntry("Aim", "effect"), makeEntry("Sword", "melee"), makeEntry("Axe", "melee")];
    expect(sortEntries(input).map((e) => e.slug)).toEqual(["axe", "sword", "aim"]);
    expect(input.map((e) => e.slug)).toEqual(["aim", "sword", "axe"]);
  });

  it("rejects invalid output", () => {
    expect(() => validateOutput([makeEntry("Sword", "melee", { slug: "Bad Slug" })], [])).toThrow(ExtractError);
    expect(() => validateOutput([makeEntry("Sword", "melee", { slug: "Bad Slug" })], [])).toThrow(/輸出條目驗證失敗/);
  });

  it("returns validated data", () => {
    const entries = [makeEntry("Sword", "melee")];
    expect(validateOutput(entries, [])).toEqual({ entries, armorSets: [] });
  });
});
```

- [ ] **Step 2: 寫失敗測試 `tests/unit/extract/report.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { issue } from "../../../scripts/extract/issues";
import { renderReport } from "../../../scripts/extract/report";
import { makeEntry } from "../../helpers/entries";

describe("renderReport", () => {
  const entries = [makeEntry("Sword", "melee"), makeEntry("Halberd", "melee", { release: "upcoming" })];

  it("counts entries per category and release", () => {
    expect(renderReport({ entries, armorSets: [], issues: [] })).toContain("| melee | 1 | 1 |");
  });

  it("says there are no issues", () => {
    expect(renderReport({ entries, armorSets: [], issues: [] })).toContain("無問題");
  });

  it("lists issue details grouped by type", () => {
    const report = renderReport({ entries, armorSets: [], issues: [issue("missing-icon", "armor:DiscipleChest")] });
    expect(report).toContain("| missing-icon | 1 |");
    expect(report).toContain("### missing-icon (1)\n\n- armor:DiscipleChest");
  });

  it("only counts noisy issue types", () => {
    const report = renderReport({ entries, armorSets: [], issues: [issue("ignored-field", "A.Description_EffectTotal")] });
    expect(report).toContain("| ignored-field | 1 |");
    expect(report).not.toContain("A.Description_EffectTotal");
  });
});
```

- [ ] **Step 3: 寫失敗整合測試 `tests/integration/pipeline.test.ts`**

```ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtractError } from "../../scripts/extract/issues";
import { runExtract } from "../../scripts/extract/pipeline";
import type { ArmorSet, Entry } from "../../scripts/extract/schemas";
import { makeLocales, ns } from "../helpers/locales";

const ICON_ROOT = "Assets/Art/Characters/Player/Equipment";
const QUIVER = `${ICON_ROOT}/Artifacts/Quivers/T_UI_Quiver_Freezing_Icon.png`;

let sourceRoot: string;
let outRoot: string;
let overridesPath: string;

async function put(root: string, relative: string, content: string): Promise<void> {
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-src-"));
  outRoot = await mkdtemp(path.join(tmpdir(), "mcd2-out-"));
  overridesPath = path.join(sourceRoot, "overrides.json");
  const locales = makeLocales({
    [ns("DT_ItemDefinitionMelee")]: {
      SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
      SW_Item_Sword_SW_TextEntry_Description: ["A classic sword.", "經典的劍。"],
      SW_Item_Sword_Unique1_SW_TextEntry_Name: ["The Burning Blade", "燃燒之刃"],
    },
    [ns("DT_R3ItemDefinitionMelee")]: { SW_Item_Halberd_SW_TextEntry_Name: ["Halberd", "戟"] },
    [ns("DT_ItemDefinitionArmor")]: {
      SW_Item_DiscipleHelmet_SW_TextEntry_Name: ["Disciple mask", "修行者面具"],
      SW_Item_DiscipleChest_SW_TextEntry_Name: ["Disciple Robe", "修行者長袍"],
    },
    [ns("DT_ItemDefinitionArtifact")]: { SW_Item_Artifact_FrostQuiver_SW_TextEntry_Name: ["Frost Quiver", "冰霜箭袋"] },
    [ns("DT_EnchantmentDefinition")]: {
      SW_Enchantment_Arcane_SW_TextEntry_Name: ["Artifact Amplifier", "神器增幅"],
      SW_Enchantment_Arcane_SW_TextEntry_Description_EffectTotal: ["{0}", "{0}"],
    },
    [ns("DT_ItemDefinitionEnchantmentBook")]: {
      SW_Item_EnchantmentBook_Arcane_SW_TextEntry_Name: ["Artifact Amplifier", "神器增幅"],
    },
    [ns("DT_EffectDefinition")]: {
      SW_Effect_CriticalEdge_SW_TextEntry_Name: ["Critical Edge", "致命鋒刃"],
      SW_Effect_CriticalEdge_SW_TextEntry_Description: ["All critical hits deal {0} more damage.", "暴擊造成的傷害提高 {0}。"],
    },
  });
  await put(sourceRoot, "Localization/All/en/All.json", JSON.stringify(locales.en));
  await put(sourceRoot, "Localization/All/zh-Hant/All.json", JSON.stringify(locales.zh));
  await put(sourceRoot, `${ICON_ROOT}/Weapons/Sword/T_UI_Sword_Icon.png`, "png:sword");
  await put(sourceRoot, `${ICON_ROOT}/Weapons/Sword/Sword_Unique/T_UI_Sword_Unique_Icon.png`, "png:sword-unique");
  await put(sourceRoot, `${ICON_ROOT}/Armor/Disciple_Armor/T_UI_Helmet_Disciple_Icon.png`, "png:helmet");
  await put(sourceRoot, QUIVER, "png:quiver");
  await writeFile(overridesPath, JSON.stringify({ Artifact_FrostQuiver: QUIVER }), "utf8");
});

const readJson = async <T>(relative: string): Promise<T> =>
  JSON.parse(await readFile(path.join(outRoot, ...relative.split("/")), "utf8")) as T;

describe("runExtract", () => {
  it("writes entries, armor sets, icons and a report", async () => {
    await put(outRoot, "public/icons/stale.png", "old");
    const summary = await runExtract({ sourceRoot, outRoot, overridesPath });
    const entries = await readJson<Entry[]>("src/data/entries.json");
    const find = (category: string, slug: string) => entries.find((e) => e.category === category && e.slug === slug);

    expect(find("melee", "sword")).toMatchObject({
      name: { zh: "劍", en: "Sword" },
      icon: "icons/melee/sword.png",
      links: { variants: ["sword-unique1"] },
    });
    expect(await readFile(path.join(outRoot, "public", "icons", "melee", "sword.png"), "utf8")).toBe("png:sword");
    expect(existsSync(path.join(outRoot, "public", "icons", "stale.png"))).toBe(false);
    expect(find("melee", "halberd")).toMatchObject({ release: "upcoming", links: {} });
    expect(find("melee", "halberd")?.icon).toBeUndefined();
    expect(find("artifact", "frost-quiver")?.icon).toBe("icons/artifact/frost-quiver.png");
    expect(find("enchantment", "arcane")?.links).toEqual({ enchantmentBook: "arcane" });
    expect(find("effect", "critical-edge")?.description?.zh).toContain('<span class="placeholder">{數值}</span>');

    expect(await readJson<ArmorSet[]>("src/data/armor-sets.json")).toEqual([
      {
        id: "Disciple",
        slug: "disciple",
        variant: "normal",
        name: { zh: "修行者", en: "Disciple" },
        pieces: { helmet: "disciple-helmet", chest: "disciple-chest" },
      },
    ]);
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-icon (1)\n\n- armor:DiscipleChest");
    expect(summary).toMatchObject({ entries: 9, armorSets: 1, icons: 4 });
  });

  it("produces identical output on a second run", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const first = await readFile(path.join(outRoot, "src", "data", "entries.json"), "utf8");
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readFile(path.join(outRoot, "src", "data", "entries.json"), "utf8")).toBe(first);
  });

  it("fails clearly when the locale files are missing", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "mcd2-empty-"));
    await expect(runExtract({ sourceRoot: empty, outRoot, overridesPath })).rejects.toThrow(ExtractError);
    await expect(runExtract({ sourceRoot: empty, outRoot, overridesPath })).rejects.toThrow("找不到語系檔");
  });
});
```

（條目數 9 = Sword、Sword_Unique1、Halberd、DiscipleHelmet、DiscipleChest、FrostQuiver、Arcane、Arcane 附魔書、CriticalEdge。）

- [ ] **Step 4: 執行測試確認失敗**

Run: `npx vitest run tests/unit/extract/output.test.ts tests/unit/extract/report.test.ts tests/integration/pipeline.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 5: 建立 `scripts/extract/output.ts`**

```ts
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CATEGORIES, type Category } from "./config";
import { ExtractError, formatZodIssue } from "./issues";
import { ArmorSetSchema, EntrySchema, type ArmorSet, type Entry } from "./schemas";

export interface IconCopy {
  readonly from: string;
  readonly to: string;
}

export interface ExtractOutput {
  readonly entries: Entry[];
  readonly armorSets: ArmorSet[];
}

export const iconWebPath = (category: Category, slug: string): string => `icons/${category}/${slug}.png`;

export function sortEntries(entries: readonly Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.slug.localeCompare(b.slug, "en"),
  );
}

export function validateOutput(entries: readonly Entry[], armorSets: readonly ArmorSet[]): ExtractOutput {
  const parsedEntries = z.array(EntrySchema).safeParse(entries);
  if (!parsedEntries.success) {
    throw new ExtractError(`輸出條目驗證失敗：${formatZodIssue(parsedEntries.error.issues[0])}`);
  }
  const parsedSets = z.array(ArmorSetSchema).safeParse(armorSets);
  if (!parsedSets.success) {
    throw new ExtractError(`輸出護甲套裝驗證失敗：${formatZodIssue(parsedSets.error.issues[0])}`);
  }
  return { entries: parsedEntries.data, armorSets: parsedSets.data };
}

const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export async function writeOutputs(outRoot: string, output: ExtractOutput, report: string): Promise<void> {
  const dataDir = path.join(outRoot, "src", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "entries.json"), toJson(output.entries), "utf8");
  await writeFile(path.join(dataDir, "armor-sets.json"), toJson(output.armorSets), "utf8");
  await writeFile(path.join(outRoot, "extract-report.md"), report, "utf8");
}

export async function copyIcons(copies: readonly IconCopy[], iconsDir: string): Promise<void> {
  await rm(iconsDir, { recursive: true, force: true });
  for (const copy of copies) {
    await mkdir(path.dirname(copy.to), { recursive: true });
    await copyFile(copy.from, copy.to);
  }
}
```

- [ ] **Step 6: 建立 `scripts/extract/report.ts`**

```ts
import { CATEGORIES, type Category, type Release } from "./config";
import type { Issue, IssueType } from "./issues";
import type { ArmorSet, Entry } from "./schemas";

const COUNT_ONLY: ReadonlySet<IssueType> = new Set(["ignored-field", "placeholder-only"]);

interface ReportInput {
  readonly entries: readonly Entry[];
  readonly armorSets: readonly ArmorSet[];
  readonly issues: readonly Issue[];
}

const count = (entries: readonly Entry[], category: Category, release: Release): number =>
  entries.filter((entry) => entry.category === category && entry.release === release).length;

function groupByType(issues: readonly Issue[]): Map<IssueType, Issue[]> {
  const groups = new Map<IssueType, Issue[]>();
  for (const item of issues) groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
  return groups;
}

function summaryLines(groups: Map<IssueType, Issue[]>): string[] {
  if (groups.size === 0) return ["無問題"];
  return ["| 類型 | 數量 |", "|---|---|", ...[...groups].map(([type, items]) => `| ${type} | ${items.length} |`)];
}

function detailLines(groups: Map<IssueType, Issue[]>): string[] {
  return [...groups]
    .filter(([type]) => !COUNT_ONLY.has(type))
    .flatMap(([type, items]) => [`### ${type} (${items.length})`, "", ...items.map((item) => `- ${item.detail}`), ""]);
}

export function renderReport(input: ReportInput): string {
  const groups = groupByType(input.issues);
  const lines = [
    "# Extract Report",
    "",
    "## 條目數",
    "",
    "| 分類 | base | upcoming |",
    "|---|---|---|",
    ...CATEGORIES.map((c) => `| ${c} | ${count(input.entries, c, "base")} | ${count(input.entries, c, "upcoming")} |`),
    "",
    `護甲套裝：${input.armorSets.length}`,
    "",
    "## 問題摘要",
    "",
    ...summaryLines(groups),
    "",
    "## 詳細",
    "",
    ...detailLines(groups),
  ];
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 7: 建立 `scripts/extract/pipeline.ts`**

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { assembleEntry, assertUniqueSlugs } from "./assemble";
import { ICON_CATEGORIES, PATHS, TABLES } from "./config";
import { groupEntries, type RawEntry } from "./group-entries";
import { listIconFiles, loadOverrides } from "./icon-files";
import { issue, type Issue } from "./issues";
import { toSlug } from "./keys";
import { linkEntries } from "./link-entries";
import { buildIconIndex, matchIcon, type IconIndex, type IconOverrides } from "./match-icons";
import { copyIcons, iconWebPath, sortEntries, validateOutput, writeOutputs } from "./output";
import { loadLocales } from "./parse-locale";
import { renderReport } from "./report";

export interface ExtractOptions {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly overridesPath: string;
}

export interface ExtractSummary {
  readonly entries: number;
  readonly armorSets: number;
  readonly icons: number;
  readonly issues: Issue[];
}

interface IconPlan {
  readonly raw: RawEntry;
  readonly source?: string;
  readonly issues: Issue[];
}

function planIcon(raw: RawEntry, index: IconIndex, overrides: IconOverrides, sourceRoot: string): IconPlan {
  if (!ICON_CATEGORIES.has(raw.category) || raw.release !== "base") return { raw, issues: [] };
  const where = `${raw.category}:${raw.id}`;
  const match = matchIcon(raw.id, index, overrides);
  switch (match.kind) {
    case "matched": {
      const source = path.join(sourceRoot, ...match.file.split("/"));
      return existsSync(source)
        ? { raw, source, issues: [] }
        : { raw, issues: [issue("override-missing-file", `${where} → ${match.file}`)] };
    }
    case "ambiguous":
      return { raw, issues: [issue("ambiguous-icon", `${where}: ${match.candidates.join(", ")}`)] };
    case "missing":
      return { raw, issues: [issue("missing-icon", where)] };
    case "none":
      return { raw, issues: [] };
  }
}

const webPathOf = (raw: RawEntry): string => iconWebPath(raw.category, toSlug(raw.id));

export async function runExtract(options: ExtractOptions): Promise<ExtractSummary> {
  const grouped = groupEntries(await loadLocales(options.sourceRoot), TABLES);
  const overrides = await loadOverrides(options.overridesPath);
  const iconFiles = await listIconFiles(options.sourceRoot);
  const index = buildIconIndex(iconFiles ?? []);
  const plans = grouped.entries.map((raw) => planIcon(raw, index, overrides, options.sourceRoot));
  const assembled = plans.map((plan) => assembleEntry(plan.raw, plan.source ? webPathOf(plan.raw) : undefined));
  const entries = assembled.map((result) => result.entry);
  assertUniqueSlugs(entries);
  const linked = linkEntries(entries);
  const output = validateOutput(sortEntries(linked.entries), linked.armorSets);
  const copies = plans.flatMap((plan) =>
    plan.source ? [{ from: plan.source, to: path.join(options.outRoot, "public", ...webPathOf(plan.raw).split("/")) }] : [],
  );
  await copyIcons(copies, path.join(options.outRoot, "public", "icons"));
  const issues = [
    ...(iconFiles === null ? [issue("missing-icon-root", PATHS.iconRootRel)] : []),
    ...grouped.issues,
    ...plans.flatMap((plan) => plan.issues),
    ...assembled.flatMap((result) => result.issues),
    ...linked.issues,
  ];
  await writeOutputs(options.outRoot, output, renderReport({ ...output, issues }));
  return { entries: output.entries.length, armorSets: output.armorSets.length, icons: copies.length, issues };
}
```

- [ ] **Step 8: 建立 `scripts/extract/index.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ExtractError } from "./issues";
import { runExtract } from "./pipeline";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function main(): Promise<void> {
  const sourceRoot = path.resolve(process.argv[2] ?? path.join(projectRoot, "source-data"));
  const summary = await runExtract({
    sourceRoot,
    outRoot: projectRoot,
    overridesPath: path.join(projectRoot, "scripts", "extract", "icon-overrides.json"),
  });
  console.log(
    `抽取完成：${summary.entries} 個條目、${summary.armorSets} 個護甲套裝、${summary.icons} 張圖示、${summary.issues.length} 個問題（詳見 extract-report.md）`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof ExtractError ? `抽取失敗：${error.message}` : error);
  process.exitCode = 1;
});
```

- [ ] **Step 9: 執行全部單元與整合測試**

Run: `npx vitest run`
Expected: PASS（全部）。

- [ ] **Step 10: 檢查覆蓋率**

Run: `npm run test:coverage`
Expected: PASS，`scripts/extract` 的 lines/functions/branches/statements 皆 ≥ 80%。若未達標，補測試覆蓋未測分支（報告會列出檔案與行號）。

- [ ] **Step 11: Commit**

```bash
git add scripts/extract tests/unit/extract/output.test.ts tests/unit/extract/report.test.ts tests/integration/pipeline.test.ts
git commit -m "feat: wire extract pipeline with outputs, report and CLI" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 9: 對真實資料執行抽取

**Files:**
- Modify: `scripts/extract/icon-overrides.json`（僅在報告有缺圖時）
- Create（產物）: `src/data/entries.json`, `src/data/armor-sets.json`, `public/icons/**`

**Interfaces:**
- Consumes: `npm run extract`
- Produces: 網站用的真實資料，後續所有網站任務都依賴它。

- [ ] **Step 1: 執行抽取**

Run: `npm run extract`
Expected: 輸出 `抽取完成：…`，exit code 0。

- [ ] **Step 2: 檢查報告**

Run: `cat extract-report.md`
Expected:
- 條目數表中 base 欄大致為：melee 58、ranged 22、armor 152、artifact 40、enchantment 40、enchantment-book 41、effect 約 78、status 約 40。
- `missing-icon`、`ambiguous-icon`、`override-missing-file` 三類**應為 0**。
- `untranslated` 應為 0。
- `unlinked-enchantment` 為 0（`EnchantmentBook_SoulAspect` 會以英文名稱連到 `SoulFireAspect`；若沒有，記錄在 Step 4 的 commit 訊息，不阻擋）。

- [ ] **Step 3: 若有缺圖，補 override 後重跑**

對報告中每一筆 `missing-icon`／`ambiguous-icon`（例如 `artifact:Artifact_Xxx`）：
Run: `find source-data/Assets/Art/Characters/Player/Equipment -iname 'T_UI_*xxx*'`（`xxx` 換成 Id 中的關鍵字）
把找到的路徑（相對 `source-data`、正斜線）加入 `scripts/extract/icon-overrides.json`；確定沒有圖示的寫 `null`。然後重跑 Step 1–2，直到這三類皆為 0。

- [ ] **Step 4: 抽查產物**

Run: `node -e "const e=require('./src/data/entries.json');const s=e.find(x=>x.category==='melee'&&x.slug==='sword');console.log(s.name,s.icon,s.links)"`
Expected: `{ zh: '劍', en: 'Sword' } icons/melee/sword.png { variants: [ 'sword-unique1' ] }`

Run: `node -e "const s=require('./src/data/armor-sets.json');console.log(s.length, s.find(x=>x.slug==='disciple'))"`
Expected: 套裝數約 38，`disciple` 的名稱為 `{ zh: '修行者', en: 'Disciple' }`，四個部位齊全。

- [ ] **Step 5: Commit**

```bash
git add src/data public/icons scripts/extract/icon-overrides.json
git commit -m "chore: extract equipment and enchantment data from game files" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 10: 網站基礎（i18n、網址、資料、版面、首頁）

**Files:**
- Create: `src/lib/i18n.ts`, `src/lib/url.ts`, `src/lib/data.ts`, `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/LangText.astro`, `src/components/EntryIcon.astro`, `src/pages/[lang]/index.astro`
- Test: `tests/unit/site/url.test.ts`, `tests/unit/site/i18n.test.ts`, `tests/unit/site/data.test.ts`

**Interfaces:**
- Consumes: `LANGS`、`Lang`、`Category`、`Entry`、`ArmorSet`、`ArmorPiece`、`Localized`、`EntrySchema`、`ArmorSetSchema`、`src/data/*.json`
- Produces:
  - `i18n.ts`：`HTML_LANG`、`otherLang(lang)`、`type UiKey`、`t(lang, key)`、`CATEGORY_LABEL`、`PIECE_LABEL`、`NAV_GROUPS`、`GRID_CATEGORIES`、`TABLE_CATEGORIES`
  - `url.ts`：`withBase(base, path)`、`href(lang, ...segments)`、`assetUrl(path)`、`swapLangPath(pathname, base, target)`、`entryHref(lang, entry)`
  - `data.ts`：`publishedEntries`、`entriesIn(category)`、`findEntry(category, slug)`、`allArmorSets`、`findArmorSet(slug)`
  - 元件：`<Base lang title>`、`<LangText lang value html? as? class?>`、`<EntryIcon icon? alt size?>`

- [ ] **Step 1: 寫失敗測試 `tests/unit/site/url.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { makeEntry } from "../../helpers/entries";
import { entryHref, href, swapLangPath, withBase } from "../../../src/lib/url";

describe("url helpers", () => {
  it("joins a base and a path", () => {
    expect(withBase("/", "icons/a.png")).toBe("/icons/a.png");
    expect(withBase("/mcd2-wiki", "/icons/a.png")).toBe("/mcd2-wiki/icons/a.png");
  });

  it("builds language-prefixed links with a trailing slash", () => {
    expect(href("zh")).toBe("/zh/");
    expect(href("en", "melee", "sword")).toBe("/en/melee/sword/");
  });

  it("swaps the language segment", () => {
    expect(swapLangPath("/zh/melee/sword/", "/", "en")).toBe("/en/melee/sword/");
    expect(swapLangPath("/zh/", "/", "en")).toBe("/en/");
    expect(swapLangPath("/mcd2-wiki/en/armor/disciple/", "/mcd2-wiki/", "zh")).toBe("/mcd2-wiki/zh/armor/disciple/");
  });

  it("routes entries by category", () => {
    expect(entryHref("zh", makeEntry("Sword", "melee"))).toBe("/zh/melee/sword/");
    expect(entryHref("zh", makeEntry("DiscipleBoots", "armor"))).toBe("/zh/armor/piece/disciple-boots/");
    expect(entryHref("en", makeEntry("CriticalEdge", "effect"))).toBe("/en/effect/#critical-edge");
  });
});
```

- [ ] **Step 2: 寫失敗測試 `tests/unit/site/i18n.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../../scripts/extract/config";
import { CATEGORY_LABEL, GRID_CATEGORIES, NAV_GROUPS, TABLE_CATEGORIES, otherLang, t } from "../../../src/lib/i18n";

describe("i18n", () => {
  it("swaps languages", () => {
    expect(otherLang("zh")).toBe("en");
    expect(otherLang("en")).toBe("zh");
  });

  it("translates UI keys", () => {
    expect(t("zh", "switchLang")).toBe("English");
    expect(t("en", "switchLang")).toBe("繁體中文");
  });

  it("labels every category in both languages", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABEL[category].zh).not.toBe("");
      expect(CATEGORY_LABEL[category].en).not.toBe("");
    }
  });

  it("puts every category in the navigation and every non-armor category in a page group", () => {
    expect(NAV_GROUPS.flatMap((group) => group.categories).sort()).toEqual([...CATEGORIES].sort());
    expect([...GRID_CATEGORIES, ...TABLE_CATEGORIES, "armor"].sort()).toEqual([...CATEGORIES].sort());
  });
});
```

- [ ] **Step 3: 寫失敗測試 `tests/unit/site/data.test.ts`（使用 Task 9 的真實資料）**

```ts
import { describe, expect, it } from "vitest";
import { allArmorSets, entriesIn, findArmorSet, findEntry, publishedEntries } from "../../../src/lib/data";

describe("site data", () => {
  it("publishes only base entries", () => {
    expect(publishedEntries.length).toBeGreaterThan(0);
    expect(publishedEntries.every((entry) => entry.release === "base")).toBe(true);
  });

  it("finds entries by category and slug", () => {
    expect(findEntry("melee", "sword")?.name).toEqual({ zh: "劍", en: "Sword" });
    expect(findEntry("melee", "does-not-exist")).toBeUndefined();
    expect(entriesIn("melee").every((entry) => entry.category === "melee")).toBe(true);
  });

  it("finds armor sets", () => {
    expect(allArmorSets.length).toBeGreaterThan(0);
    expect(findArmorSet("disciple")?.name.en).toBe("Disciple");
  });
});
```

- [ ] **Step 4: 執行測試確認失敗**

Run: `npx vitest run tests/unit/site`
Expected: FAIL（找不到 `src/lib/*`）。

- [ ] **Step 5: 建立 `src/lib/i18n.ts`**

```ts
import type { Category, Lang } from "../../scripts/extract/config";
import type { ArmorPiece } from "../../scripts/extract/schemas";

export type { Lang };

export const HTML_LANG: Readonly<Record<Lang, string>> = { zh: "zh-TW", en: "en" };

export const otherLang = (lang: Lang): Lang => (lang === "zh" ? "en" : "zh");

const UI = {
  zh: {
    siteTitle: "Minecraft Dungeons II 中文 Wiki",
    home: "首頁",
    search: "搜尋",
    compare: "中英對照",
    switchLang: "English",
    all: "全部",
    normal: "一般",
    unique: "獨特",
    filterPlaceholder: "篩選名稱…",
    noResults: "沒有符合的條目",
    untranslated: "未翻譯",
    related: "相關條目",
    relatedVariant: "另一版本",
    enchantmentBook: "對應附魔書",
    enchantment: "對應附魔",
    armorSet: "所屬套裝",
    name: "名稱",
    description: "描述",
    equipment: "裝備",
    enchanting: "附魔與效果",
    placeholderNote: "「{數值}」表示遊戲內會顯示實際數值，原始資料未提供。",
    disclaimer: "非官方粉絲網站，與 Mojang Studios／Microsoft 無關。遊戲文字與圖像版權歸原權利人所有。",
    source: "資料來源：Minecraft Dungeons II 遊戲語系檔（繁體中文／英文）。",
  },
  en: {
    siteTitle: "Minecraft Dungeons II Wiki (zh-TW)",
    home: "Home",
    search: "Search",
    compare: "Bilingual",
    switchLang: "繁體中文",
    all: "All",
    normal: "Normal",
    unique: "Unique",
    filterPlaceholder: "Filter by name…",
    noResults: "No matching entries",
    untranslated: "Untranslated",
    related: "Related",
    relatedVariant: "Other variant",
    enchantmentBook: "Enchantment book",
    enchantment: "Enchantment",
    armorSet: "Armor set",
    name: "Name",
    description: "Description",
    equipment: "Equipment",
    enchanting: "Enchantments & Effects",
    placeholderNote: "\"{value}\" marks a number the game fills in; it is not in the source data.",
    disclaimer: "Unofficial fan site, not affiliated with Mojang Studios or Microsoft. Game text and images belong to their respective owners.",
    source: "Source: Minecraft Dungeons II localization files (Traditional Chinese / English).",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type UiKey = keyof (typeof UI)["zh"];

export const t = (lang: Lang, key: UiKey): string => UI[lang][key];

export const CATEGORY_LABEL: Readonly<Record<Category, Readonly<Record<Lang, string>>>> = {
  melee: { zh: "近戰武器", en: "Melee Weapons" },
  ranged: { zh: "遠程武器", en: "Ranged Weapons" },
  armor: { zh: "護甲", en: "Armor" },
  artifact: { zh: "神器", en: "Artifacts" },
  enchantment: { zh: "附魔", en: "Enchantments" },
  "enchantment-book": { zh: "附魔書", en: "Enchantment Books" },
  effect: { zh: "效果", en: "Effects" },
  status: { zh: "狀態", en: "Statuses" },
};

export const PIECE_LABEL: Readonly<Record<ArmorPiece, Readonly<Record<Lang, string>>>> = {
  helmet: { zh: "頭盔", en: "Helmet" },
  chest: { zh: "胸甲", en: "Chest" },
  leggings: { zh: "護腿", en: "Leggings" },
  boots: { zh: "靴子", en: "Boots" },
};

export const NAV_GROUPS: readonly { key: UiKey; categories: readonly Category[] }[] = [
  { key: "equipment", categories: ["melee", "ranged", "armor", "artifact"] },
  { key: "enchanting", categories: ["enchantment", "enchantment-book", "effect", "status"] },
];

export const GRID_CATEGORIES = ["melee", "ranged", "artifact", "enchantment", "enchantment-book"] as const satisfies readonly Category[];
export const TABLE_CATEGORIES = ["effect", "status"] as const satisfies readonly Category[];
```

- [ ] **Step 6: 建立 `src/lib/url.ts`**

```ts
import type { Lang } from "../../scripts/extract/config";
import type { Entry } from "../../scripts/extract/schemas";

const TABLE_CATEGORIES: ReadonlySet<Entry["category"]> = new Set(["effect", "status"]);
const ensureSlash = (base: string): string => (base.endsWith("/") ? base : `${base}/`);

export const withBase = (base: string, path: string): string => `${ensureSlash(base)}${path.replace(/^\//, "")}`;

export const href = (lang: Lang, ...segments: string[]): string =>
  withBase(import.meta.env.BASE_URL, `${[lang, ...segments].map(encodeURIComponent).join("/")}/`);

export const assetUrl = (path: string): string => withBase(import.meta.env.BASE_URL, path);

export function swapLangPath(pathname: string, base: string, target: Lang): string {
  const prefix = ensureSlash(base);
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, "");
  const [, ...tail] = rest.split("/");
  return `${prefix}${[target, ...tail].join("/")}`;
}

export function entryHref(lang: Lang, entry: Entry): string {
  if (entry.category === "armor") return href(lang, "armor", "piece", entry.slug);
  if (TABLE_CATEGORIES.has(entry.category)) return `${href(lang, entry.category)}#${entry.slug}`;
  return href(lang, entry.category, entry.slug);
}
```

- [ ] **Step 7: 建立 `src/lib/data.ts`**

```ts
import { z } from "zod";
import type { Category } from "../../scripts/extract/config";
import { ArmorSetSchema, EntrySchema, type ArmorSet, type Entry } from "../../scripts/extract/schemas";
import rawSets from "../data/armor-sets.json";
import rawEntries from "../data/entries.json";

const entries: readonly Entry[] = z.array(EntrySchema).parse(rawEntries);

export const publishedEntries: readonly Entry[] = entries.filter((entry) => entry.release === "base");

export const allArmorSets: readonly ArmorSet[] = z.array(ArmorSetSchema).parse(rawSets);

export const entriesIn = (category: Category): Entry[] =>
  publishedEntries.filter((entry) => entry.category === category);

export const findEntry = (category: Category, slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

export const findArmorSet = (slug: string): ArmorSet | undefined => allArmorSets.find((set) => set.slug === slug);
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run tests/unit/site`
Expected: PASS。

- [ ] **Step 9: 建立 `src/styles/global.css`**

```css
:root {
  color-scheme: dark;
  --bg: #15121c;
  --surface: #221d2b;
  --surface-2: #2d2638;
  --border: #3d3448;
  --text: #ece6f2;
  --muted: #a79fb3;
  --accent: #f2b33d;
  --accent-2: #7fd1c7;
  --unique: #f08a3c;
  --danger: #e06666;
  --radius: 10px;
  --max: 1100px;
  font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.6; }
a { color: var(--accent-2); }
h1, h2 { line-height: 1.3; }

.site-header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
.brand { font-weight: 700; color: var(--accent); text-decoration: none; }
.site-nav { display: flex; flex-wrap: wrap; gap: 4px 12px; flex: 1; }
.site-nav a { color: var(--text); text-decoration: none; font-size: 0.95rem; }
.site-nav a:hover { color: var(--accent); }
.site-tools { display: flex; gap: 8px; }
button, .lang-switch { font: inherit; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; text-decoration: none; }
button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
.site-main { max-width: var(--max); margin: 0 auto; padding: 24px 16px 48px; }
.site-footer { border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; padding: 16px; text-align: center; }

.lang-text { display: inline-flex; flex-direction: column; }
.lang-text .alt { color: var(--muted); font-size: 0.85em; font-weight: 400; }
h1.lang-text .alt { font-size: 0.5em; }
[data-compare="off"] .lang-text .alt { display: none; }

.home-search { display: flex; gap: 8px; margin: 16px 0 24px; }
.home-search input, .filter-text { flex: 1 1 220px; font: inherit; padding: 6px 10px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; }
.category-grid { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.category-grid a { display: flex; justify-content: space-between; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); text-decoration: none; }
.count { color: var(--muted); font-weight: 400; }

.list-filter { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.filter-variant { display: flex; gap: 6px; }
.entry-grid { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.entry-card a { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; height: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); text-decoration: none; text-align: center; }
.entry-card a:hover { border-color: var(--accent); }
.entry-card[data-variant="unique"] a { border-color: color-mix(in srgb, var(--unique) 50%, var(--border)); }
.entry-icon { object-fit: contain; }
.placeholder-icon { display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); border-radius: 8px; color: var(--muted); font-size: 1.5rem; }

.entry-table { width: 100%; border-collapse: collapse; }
.entry-table th, .entry-table td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid var(--border); }
.entry-table tr:target { background: var(--surface-2); }

.entry-head { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.tag { background: var(--surface-2); border-radius: 999px; padding: 2px 10px; font-size: 0.8rem; }
.tag.warn { background: var(--danger); color: #fff; }
.description { font-size: 1.05rem; }
.emphasis { color: var(--accent); font-style: normal; font-weight: 700; }
.placeholder { color: var(--accent); font-family: ui-monospace, monospace; }
.note { color: var(--muted); font-size: 0.9rem; }

.related ul, .set-pieces { list-style: none; padding: 0; display: grid; gap: 8px; }
.related li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.related-label { color: var(--muted); font-size: 0.85rem; }
.set-pieces { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.set-piece { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; }
.set-piece a { display: flex; gap: 10px; align-items: center; color: var(--text); text-decoration: none; }
.piece-label { color: var(--muted); font-size: 0.8rem; }
```

- [ ] **Step 10: 建立 `src/components/LangText.astro`**

```astro
---
import type { Localized } from "../../scripts/extract/schemas";
import { HTML_LANG, otherLang, type Lang } from "../lib/i18n";

interface Props {
  lang: Lang;
  value: Localized;
  html?: boolean;
  as?: string;
  class?: string;
}

const { lang, value, html = false, as: Tag = "span", class: className } = Astro.props;
const alt = otherLang(lang);
const showAlt = value[alt] !== value[lang];
---
<Tag class:list={["lang-text", className]}>
  {html ? <span class="primary" set:html={value[lang]} /> : <span class="primary">{value[lang]}</span>}
  {showAlt &&
    (html ? (
      <span class="alt" lang={HTML_LANG[alt]} set:html={value[alt]} />
    ) : (
      <span class="alt" lang={HTML_LANG[alt]}>{value[alt]}</span>
    ))}
</Tag>
```

（`description` 等欄位的 HTML 已在抽取時跳脫並白名單化，所以這裡可以安全使用 `set:html`。）

- [ ] **Step 11: 建立 `src/components/EntryIcon.astro`**

```astro
---
import { assetUrl } from "../lib/url";

interface Props {
  icon?: string;
  alt: string;
  size?: number;
}

const { icon, alt, size = 64 } = Astro.props;
---
{icon ? (
  <img class="entry-icon" src={assetUrl(icon)} alt={alt} width={size} height={size} loading="lazy" decoding="async" />
) : (
  <span class="entry-icon placeholder-icon" style={`width:${size}px;height:${size}px`} role="img" aria-label={alt}>?</span>
)}
```

- [ ] **Step 12: 建立 `src/layouts/Base.astro`**

```astro
---
import "../styles/global.css";
import { CATEGORY_LABEL, HTML_LANG, NAV_GROUPS, otherLang, t, type Lang } from "../lib/i18n";
import { href, swapLangPath } from "../lib/url";

interface Props {
  lang: Lang;
  title: string;
}

const { lang, title } = Astro.props;
const alt = otherLang(lang);
const switchHref = swapLangPath(Astro.url.pathname, import.meta.env.BASE_URL, alt);
const categories = NAV_GROUPS.flatMap((group) => group.categories);
---
<!doctype html>
<html lang={HTML_LANG[lang]} data-compare="on">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{`${title} | ${t(lang, "siteTitle")}`}</title>
    <script is:inline>
      (function () {
        try {
          if (localStorage.getItem("mcd2-compare") === "off") document.documentElement.dataset.compare = "off";
        } catch (error) {
          // Storage unavailable (private mode or blocked): keep the default "on".
        }
      })();
    </script>
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href={href(lang)}>{t(lang, "siteTitle")}</a>
      <nav class="site-nav" aria-label={t(lang, "home")}>
        {categories.map((category) => <a href={href(lang, category)}>{CATEGORY_LABEL[category][lang]}</a>)}
        <a href={href(lang, "search")}>{t(lang, "search")}</a>
      </nav>
      <div class="site-tools">
        <button type="button" class="compare-toggle" aria-pressed="true" data-testid="compare-toggle">
          {t(lang, "compare")}
        </button>
        <a class="lang-switch" href={switchHref} hreflang={HTML_LANG[alt]} data-testid="lang-switch">
          {t(lang, "switchLang")}
        </a>
      </div>
    </header>
    <main class="site-main"><slot /></main>
    <footer class="site-footer">
      <p>{t(lang, "disclaimer")}</p>
      <p>{t(lang, "source")}</p>
    </footer>
    <script>
      const STORAGE_KEY = "mcd2-compare";
      const root = document.documentElement;
      const button = document.querySelector<HTMLButtonElement>(".compare-toggle");
      const sync = () => button?.setAttribute("aria-pressed", String(root.dataset.compare !== "off"));
      sync();
      button?.addEventListener("click", () => {
        const next = root.dataset.compare === "off" ? "on" : "off";
        root.dataset.compare = next;
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Storage unavailable: the choice lasts for this page view only.
        }
        sync();
      });
    </script>
  </body>
</html>
```

- [ ] **Step 13: 建立首頁 `src/pages/[lang]/index.astro`**

```astro
---
import { LANGS, type Category } from "../../../scripts/extract/config";
import Base from "../../layouts/Base.astro";
import { allArmorSets, entriesIn } from "../../lib/data";
import { CATEGORY_LABEL, NAV_GROUPS, t, type Lang } from "../../lib/i18n";
import { href } from "../../lib/url";

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

const lang = Astro.params.lang as Lang;
const countOf = (category: Category): number =>
  category === "armor" ? allArmorSets.length : entriesIn(category).length;
---
<Base lang={lang} title={t(lang, "home")}>
  <h1>{t(lang, "siteTitle")}</h1>
  <form class="home-search" action={href(lang, "search")} method="get" role="search">
    <input type="search" name="q" placeholder={t(lang, "search")} aria-label={t(lang, "search")} />
    <button type="submit">{t(lang, "search")}</button>
  </form>
  {NAV_GROUPS.map((group) => (
    <section>
      <h2>{t(lang, group.key)}</h2>
      <ul class="category-grid">
        {group.categories.map((category) => (
          <li>
            <a href={href(lang, category)}>
              <span>{CATEGORY_LABEL[category][lang]}</span>
              <span class="count">{countOf(category)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  ))}
</Base>
```

- [ ] **Step 14: 建置驗證**

Run: `npx astro build`
Expected: 成功；`dist/zh/index.html` 與 `dist/en/index.html` 存在；`grep -c "近戰武器" dist/zh/index.html` ≥ 1；`grep -c 'lang="zh-TW"' dist/zh/index.html` = 1。

- [ ] **Step 15: Commit**

```bash
git add src/lib src/styles src/layouts src/components/LangText.astro src/components/EntryIcon.astro "src/pages/[lang]/index.astro" tests/unit/site
git commit -m "feat: add site layout, i18n, data access and home page" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 11: 分類列表頁（圖示網格、表格、護甲套裝列表、篩選）

**Files:**
- Create: `src/components/EntryCard.astro`, `src/components/EntryTable.astro`, `src/components/ListFilter.astro`, `src/pages/[lang]/[category]/index.astro`, `src/pages/[lang]/armor/index.astro`

**Interfaces:**
- Consumes: `entriesIn`、`allArmorSets`、`findEntry`、`entryHref`、`href`、`GRID_CATEGORIES`、`TABLE_CATEGORIES`、`LangText`、`EntryIcon`、`Base`
- Produces: 網址 `/{lang}/{melee|ranged|artifact|enchantment|enchantment-book|effect|status}/`、`/{lang}/armor/`。每個可篩選項目帶 `data-names`（中英名稱小寫）與 `data-variant`；表格列帶 `id={slug}`。

- [ ] **Step 1: 建立 `src/components/EntryCard.astro`**

```astro
---
import type { Entry } from "../../scripts/extract/schemas";
import type { Lang } from "../lib/i18n";
import { entryHref } from "../lib/url";
import EntryIcon from "./EntryIcon.astro";
import LangText from "./LangText.astro";

interface Props {
  lang: Lang;
  entry: Entry;
}

const { lang, entry } = Astro.props;
---
<li class="entry-card" data-variant={entry.variant} data-names={`${entry.name.zh} ${entry.name.en}`.toLowerCase()}>
  <a href={entryHref(lang, entry)}>
    <EntryIcon icon={entry.icon} alt={entry.name[lang]} />
    <LangText lang={lang} value={entry.name} class="card-name" />
  </a>
</li>
```

- [ ] **Step 2: 建立 `src/components/EntryTable.astro`**

```astro
---
import type { Entry } from "../../scripts/extract/schemas";
import { t, type Lang } from "../lib/i18n";
import LangText from "./LangText.astro";

interface Props {
  lang: Lang;
  entries: readonly Entry[];
}

const { lang, entries } = Astro.props;
---
<table class="entry-table" data-pagefind-body>
  <thead>
    <tr><th>{t(lang, "name")}</th><th>{t(lang, "description")}</th></tr>
  </thead>
  <tbody>
    {entries.map((entry) => (
      <tr id={entry.slug} data-variant={entry.variant} data-names={`${entry.name.zh} ${entry.name.en}`.toLowerCase()}>
        <th scope="row"><LangText lang={lang} value={entry.name} /></th>
        <td>{entry.description ? <LangText lang={lang} value={entry.description} html /> : "—"}</td>
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 3: 建立 `src/components/ListFilter.astro`**

```astro
---
import { t, type Lang } from "../lib/i18n";

interface Props {
  lang: Lang;
  showVariant: boolean;
}

const { lang, showVariant } = Astro.props;
const VARIANTS = ["all", "normal", "unique"] as const;
---
<div class="list-filter" data-testid="list-filter">
  <input type="search" class="filter-text" placeholder={t(lang, "filterPlaceholder")} aria-label={t(lang, "filterPlaceholder")} />
  {showVariant && (
    <div class="filter-variant" role="group">
      {VARIANTS.map((variant) => (
        <button type="button" data-variant={variant} aria-pressed={variant === "all" ? "true" : "false"}>
          {t(lang, variant)}
        </button>
      ))}
    </div>
  )}
</div>
<p class="no-results" hidden>{t(lang, "noResults")}</p>
<script>
  const filter = document.querySelector<HTMLElement>(".list-filter");
  const input = filter?.querySelector<HTMLInputElement>(".filter-text");
  const buttons = [...(filter?.querySelectorAll<HTMLButtonElement>("button[data-variant]") ?? [])];
  const items = [...document.querySelectorAll<HTMLElement>("[data-names]")];
  const noResults = document.querySelector<HTMLElement>(".no-results");
  let variant = "all";

  const apply = () => {
    const text = input?.value.trim().toLowerCase() ?? "";
    let visible = 0;
    for (const item of items) {
      const show = (variant === "all" || item.dataset.variant === variant) && (item.dataset.names ?? "").includes(text);
      item.hidden = !show;
      if (show) visible += 1;
    }
    if (noResults) noResults.hidden = visible > 0;
  };

  input?.addEventListener("input", apply);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      variant = button.dataset.variant ?? "all";
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
      apply();
    });
  }
</script>
```

- [ ] **Step 4: 建立 `src/pages/[lang]/[category]/index.astro`**

```astro
---
import { LANGS, type Category } from "../../../../scripts/extract/config";
import EntryCard from "../../../components/EntryCard.astro";
import EntryTable from "../../../components/EntryTable.astro";
import ListFilter from "../../../components/ListFilter.astro";
import Base from "../../../layouts/Base.astro";
import { entriesIn } from "../../../lib/data";
import { CATEGORY_LABEL, GRID_CATEGORIES, TABLE_CATEGORIES, t, type Lang } from "../../../lib/i18n";

export function getStaticPaths() {
  return LANGS.flatMap((lang) =>
    [...GRID_CATEGORIES, ...TABLE_CATEGORIES].map((category) => ({ params: { lang, category } })),
  );
}

const lang = Astro.params.lang as Lang;
const category = Astro.params.category as Category;
const entries = entriesIn(category);
const isTable = (TABLE_CATEGORIES as readonly Category[]).includes(category);
---
<Base lang={lang} title={CATEGORY_LABEL[category][lang]}>
  <h1>{CATEGORY_LABEL[category][lang]} <span class="count">({entries.length})</span></h1>
  <ListFilter lang={lang} showVariant={!isTable} />
  {isTable ? (
    <>
      <p class="note">{t(lang, "placeholderNote")}</p>
      <EntryTable lang={lang} entries={entries} />
    </>
  ) : (
    <ul class="entry-grid">
      {entries.map((entry) => <EntryCard lang={lang} entry={entry} />)}
    </ul>
  )}
</Base>
```

- [ ] **Step 5: 建立 `src/pages/[lang]/armor/index.astro`**

```astro
---
import { LANGS } from "../../../../scripts/extract/config";
import { ARMOR_PIECES } from "../../../../scripts/extract/schemas";
import EntryIcon from "../../../components/EntryIcon.astro";
import LangText from "../../../components/LangText.astro";
import ListFilter from "../../../components/ListFilter.astro";
import Base from "../../../layouts/Base.astro";
import { allArmorSets, findEntry } from "../../../lib/data";
import { CATEGORY_LABEL, type Lang } from "../../../lib/i18n";
import { href } from "../../../lib/url";

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

const lang = Astro.params.lang as Lang;
const cards = allArmorSets.map((set) => {
  const firstSlug = ARMOR_PIECES.map((piece) => set.pieces[piece]).find((slug) => slug !== undefined);
  return { set, icon: firstSlug ? findEntry("armor", firstSlug)?.icon : undefined };
});
---
<Base lang={lang} title={CATEGORY_LABEL.armor[lang]}>
  <h1>{CATEGORY_LABEL.armor[lang]} <span class="count">({cards.length})</span></h1>
  <ListFilter lang={lang} showVariant={true} />
  <ul class="entry-grid">
    {cards.map(({ set, icon }) => (
      <li class="entry-card" data-variant={set.variant} data-names={`${set.name.zh} ${set.name.en}`.toLowerCase()}>
        <a href={href(lang, "armor", set.slug)}>
          <EntryIcon icon={icon} alt={set.name[lang]} />
          <LangText lang={lang} value={set.name} class="card-name" />
        </a>
      </li>
    ))}
  </ul>
</Base>
```

- [ ] **Step 6: 建置驗證**

Run: `npx astro build`
Expected: 成功；下列檔案存在：`dist/zh/melee/index.html`、`dist/en/enchantment-book/index.html`、`dist/zh/effect/index.html`、`dist/zh/armor/index.html`。
Run: `grep -c 'data-names=' dist/zh/melee/index.html`
Expected: 約 58。
Run: `grep -c 'class="placeholder"' dist/zh/effect/index.html`
Expected: ≥ 1。

- [ ] **Step 7: Commit**

```bash
git add src/components/EntryCard.astro src/components/EntryTable.astro src/components/ListFilter.astro "src/pages/[lang]/[category]/index.astro" "src/pages/[lang]/armor/index.astro"
git commit -m "feat: add category list pages with filtering" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 12: 條目頁、護甲套裝頁與護甲單件頁

**Files:**
- Create: `src/lib/related.ts`, `src/components/EntryDetail.astro`, `src/pages/[lang]/[category]/[slug].astro`, `src/pages/[lang]/armor/[set].astro`, `src/pages/[lang]/armor/piece/[slug].astro`
- Test: `tests/unit/site/related.test.ts`

**Interfaces:**
- Consumes: `findEntry`、`findArmorSet`、`entriesIn`、`allArmorSets`、`entryHref`、`href`、`UiKey`
- Produces: `relatedLinks(lang, entry): { labelKey: UiKey; href: string; name: Localized }[]`；網址 `/{lang}/{category}/{slug}/`、`/{lang}/armor/{set}/`、`/{lang}/armor/piece/{slug}/`；詳細頁主內容加 `data-pagefind-body`。

- [ ] **Step 1: 寫失敗測試 `tests/unit/site/related.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { findEntry } from "../../../src/lib/data";
import { relatedLinks } from "../../../src/lib/related";
import { makeEntry } from "../../helpers/entries";

describe("relatedLinks", () => {
  it("links a weapon to its other variant", () => {
    const sword = findEntry("melee", "sword");
    expect(sword).toBeDefined();
    expect(relatedLinks("zh", sword!)).toContainEqual({
      labelKey: "relatedVariant",
      href: "/zh/melee/sword-unique1/",
      name: { zh: "燃燒之刃", en: "The Burning Blade" },
    });
  });

  it("links an armor piece to its set", () => {
    const helmet = findEntry("armor", "disciple-helmet");
    expect(relatedLinks("en", helmet!)).toContainEqual(
      expect.objectContaining({ labelKey: "armorSet", href: "/en/armor/disciple/" }),
    );
  });

  it("drops links whose target does not exist", () => {
    const orphan = makeEntry("Ghost", "melee", { links: { variants: ["no-such-slug"], armorSet: "nope" } });
    expect(relatedLinks("zh", orphan)).toEqual([]);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/site/related.test.ts`
Expected: FAIL（找不到 `src/lib/related`）。

- [ ] **Step 3: 建立 `src/lib/related.ts`**

```ts
import type { Lang } from "../../scripts/extract/config";
import type { Entry, Localized } from "../../scripts/extract/schemas";
import { findArmorSet, findEntry } from "./data";
import type { UiKey } from "./i18n";
import { entryHref, href } from "./url";

export interface RelatedLink {
  readonly labelKey: UiKey;
  readonly href: string;
  readonly name: Localized;
}

const toLink = (lang: Lang, labelKey: UiKey, target: Entry | undefined): RelatedLink[] =>
  target ? [{ labelKey, href: entryHref(lang, target), name: target.name }] : [];

export function relatedLinks(lang: Lang, entry: Entry): RelatedLink[] {
  const { variants = [], enchantmentBook, enchantment, armorSet } = entry.links;
  const set = armorSet ? findArmorSet(armorSet) : undefined;
  return [
    ...variants.flatMap((slug) => toLink(lang, "relatedVariant", findEntry(entry.category, slug))),
    ...toLink(lang, "enchantmentBook", enchantmentBook ? findEntry("enchantment-book", enchantmentBook) : undefined),
    ...toLink(lang, "enchantment", enchantment ? findEntry("enchantment", enchantment) : undefined),
    ...(set ? [{ labelKey: "armorSet" as const, href: href(lang, "armor", set.slug), name: set.name }] : []),
  ];
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/unit/site/related.test.ts`
Expected: PASS。

- [ ] **Step 5: 建立 `src/components/EntryDetail.astro`**

```astro
---
import type { Entry } from "../../scripts/extract/schemas";
import { CATEGORY_LABEL, PIECE_LABEL, t, type Lang } from "../lib/i18n";
import { relatedLinks } from "../lib/related";
import EntryIcon from "./EntryIcon.astro";
import LangText from "./LangText.astro";

interface Props {
  lang: Lang;
  entry: Entry;
}

const { lang, entry } = Astro.props;
const related = relatedLinks(lang, entry);
---
<article class="entry-detail" data-pagefind-body>
  <header class="entry-head">
    <EntryIcon icon={entry.icon} alt={entry.name[lang]} size={128} />
    <div>
      <LangText as="h1" lang={lang} value={entry.name} />
      <p class="tags">
        <span class="tag">{CATEGORY_LABEL[entry.category][lang]}</span>
        <span class="tag">{t(lang, entry.variant)}</span>
        {entry.armorPiece && <span class="tag">{PIECE_LABEL[entry.armorPiece][lang]}</span>}
        {entry.untranslated?.includes(lang) && <span class="tag warn">{t(lang, "untranslated")}</span>}
      </p>
    </div>
  </header>
  {entry.description && <LangText as="p" class="description" lang={lang} value={entry.description} html />}
  {entry.descriptionLong && <LangText as="p" class="description-long" lang={lang} value={entry.descriptionLong} html />}
  {related.length > 0 && (
    <section class="related">
      <h2>{t(lang, "related")}</h2>
      <ul>
        {related.map((link) => (
          <li>
            <span class="related-label">{t(lang, link.labelKey)}</span>
            <a href={link.href}><LangText lang={lang} value={link.name} /></a>
          </li>
        ))}
      </ul>
    </section>
  )}
</article>
```

- [ ] **Step 6: 建立 `src/pages/[lang]/[category]/[slug].astro`**

```astro
---
import { LANGS } from "../../../../scripts/extract/config";
import type { Entry } from "../../../../scripts/extract/schemas";
import EntryDetail from "../../../components/EntryDetail.astro";
import Base from "../../../layouts/Base.astro";
import { entriesIn } from "../../../lib/data";
import { GRID_CATEGORIES, type Lang } from "../../../lib/i18n";

export function getStaticPaths() {
  return LANGS.flatMap((lang) =>
    GRID_CATEGORIES.flatMap((category) =>
      entriesIn(category).map((entry) => ({ params: { lang, category, slug: entry.slug }, props: { entry } })),
    ),
  );
}

const lang = Astro.params.lang as Lang;
const { entry } = Astro.props as { entry: Entry };
---
<Base lang={lang} title={entry.name[lang]}>
  <EntryDetail lang={lang} entry={entry} />
</Base>
```

- [ ] **Step 7: 建立 `src/pages/[lang]/armor/piece/[slug].astro`**

```astro
---
import { LANGS } from "../../../../../scripts/extract/config";
import type { Entry } from "../../../../../scripts/extract/schemas";
import EntryDetail from "../../../../components/EntryDetail.astro";
import Base from "../../../../layouts/Base.astro";
import { entriesIn } from "../../../../lib/data";
import type { Lang } from "../../../../lib/i18n";

export function getStaticPaths() {
  return LANGS.flatMap((lang) =>
    entriesIn("armor").map((entry) => ({ params: { lang, slug: entry.slug }, props: { entry } })),
  );
}

const lang = Astro.params.lang as Lang;
const { entry } = Astro.props as { entry: Entry };
---
<Base lang={lang} title={entry.name[lang]}>
  <EntryDetail lang={lang} entry={entry} />
</Base>
```

- [ ] **Step 8: 建立 `src/pages/[lang]/armor/[set].astro`**

```astro
---
import { LANGS } from "../../../../scripts/extract/config";
import { ARMOR_PIECES, type ArmorSet } from "../../../../scripts/extract/schemas";
import EntryIcon from "../../../components/EntryIcon.astro";
import LangText from "../../../components/LangText.astro";
import Base from "../../../layouts/Base.astro";
import { allArmorSets, findEntry } from "../../../lib/data";
import { CATEGORY_LABEL, PIECE_LABEL, t, type Lang } from "../../../lib/i18n";
import { entryHref } from "../../../lib/url";

export function getStaticPaths() {
  return LANGS.flatMap((lang) => allArmorSets.map((set) => ({ params: { lang, set: set.slug }, props: { set } })));
}

const lang = Astro.params.lang as Lang;
const { set } = Astro.props as { set: ArmorSet };
const pieces = ARMOR_PIECES.flatMap((piece) => {
  const slug = set.pieces[piece];
  const entry = slug ? findEntry("armor", slug) : undefined;
  return entry ? [{ piece, entry }] : [];
});
---
<Base lang={lang} title={set.name[lang]}>
  <article class="armor-set" data-pagefind-body>
    <LangText as="h1" lang={lang} value={set.name} />
    <p class="tags">
      <span class="tag">{CATEGORY_LABEL.armor[lang]}</span>
      <span class="tag">{t(lang, set.variant)}</span>
    </p>
    <ul class="set-pieces">
      {pieces.map(({ piece, entry }) => (
        <li class="set-piece" data-testid="set-piece">
          <a href={entryHref(lang, entry)}>
            <EntryIcon icon={entry.icon} alt={entry.name[lang]} />
            <span>
              <span class="piece-label">{PIECE_LABEL[piece][lang]}</span>
              <LangText lang={lang} value={entry.name} />
            </span>
          </a>
          {entry.description && <LangText as="p" lang={lang} value={entry.description} html />}
        </li>
      ))}
    </ul>
  </article>
</Base>
```

- [ ] **Step 9: 建置驗證**

Run: `npx astro build`
Expected: 成功；下列檔案存在：`dist/zh/melee/sword/index.html`、`dist/en/melee/sword-unique1/index.html`、`dist/zh/armor/disciple/index.html`、`dist/zh/armor/piece/disciple-helmet/index.html`、`dist/zh/enchantment/arcane/index.html`。
Run: `grep -c 'data-testid="set-piece"' dist/zh/armor/disciple/index.html`
Expected: 4。
Run: `grep -o 'href="/zh/melee/sword-unique1/"' dist/zh/melee/sword/index.html`
Expected: 有輸出。

- [ ] **Step 10: Commit**

```bash
git add src/lib/related.ts src/components/EntryDetail.astro "src/pages/[lang]/[category]/[slug].astro" "src/pages/[lang]/armor/[set].astro" "src/pages/[lang]/armor/piece/[slug].astro" tests/unit/site/related.test.ts
git commit -m "feat: add entry, armor set and armor piece pages" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 13: 全站搜尋（Pagefind）

**Files:**
- Create: `src/pages/[lang]/search.astro`

**Interfaces:**
- Consumes: `npm run build`（`astro build && pagefind --site dist`）、`assetUrl`、`t`
- Produces: `/{lang}/search/`；支援 `?q=` 預填；Pagefind 結果網址帶 base。

- [ ] **Step 1: 建立 `src/pages/[lang]/search.astro`**

```astro
---
import { LANGS } from "../../../scripts/extract/config";
import Base from "../../layouts/Base.astro";
import { t, type Lang } from "../../lib/i18n";
import { assetUrl } from "../../lib/url";

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

const lang = Astro.params.lang as Lang;
const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const placeholder = t(lang, "search");
---
<Base lang={lang} title={t(lang, "search")}>
  <link rel="stylesheet" href={assetUrl("pagefind/pagefind-ui.css")} />
  <h1>{t(lang, "search")}</h1>
  <div id="search" data-testid="search"></div>
  <script is:inline src={assetUrl("pagefind/pagefind-ui.js")}></script>
  <script is:inline define:vars={{ base, placeholder }}>
    window.addEventListener("DOMContentLoaded", () => {
      const ui = new PagefindUI({
        element: "#search",
        baseUrl: base,
        showSubResults: false,
        showImages: false,
        translations: { placeholder },
      });
      const query = new URLSearchParams(window.location.search).get("q");
      if (query) ui.triggerSearch(query);
    });
  </script>
</Base>
```

- [ ] **Step 2: 完整建置（含 Pagefind）**

Run: `npm run build`
Expected: 成功；Pagefind 輸出顯示索引了兩種語言（`zh-tw`／`en`，或類似代碼）與數百頁；`dist/pagefind/pagefind-ui.js` 存在。

- [ ] **Step 3: 手動確認中文搜尋**

Run: `npm run preview`，瀏覽器開 `http://localhost:4321/zh/search/?q=劍`
Expected: 出現結果（含「劍」條目）。再試 `?q=sword`，也有結果（中文頁含英文對照文字）。
若「劍」沒有結果：執行 `npx pagefind --site dist --verbose` 檢查偵測到的語言；若 zh 頁被當成未知語言，把 `src/lib/i18n.ts` 的 `HTML_LANG.zh` 改為 `"zh"`，重建再試。結果寫入 commit 訊息。

- [ ] **Step 4: Commit**

```bash
git add "src/pages/[lang]/search.astro"
git commit -m "feat: add Pagefind-powered site search" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 14: E2E 測試

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/wiki.spec.ts`

**Interfaces:**
- Consumes: `npm run build`、`npm run preview`（port 4321）、`data-testid`：`compare-toggle`、`lang-switch`、`list-filter`、`set-piece`、`search`
- Produces: `npm run test:e2e` 全綠。

- [ ] **Step 1: 安裝瀏覽器**

Run: `npx playwright install chromium`
Expected: 下載完成。

- [ ] **Step 2: 建立 `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:4321" },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4321/zh/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

- [ ] **Step 3: 建立 `tests/e2e/wiki.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("home lists categories and links to them", async ({ page }) => {
  await page.goto("/zh/");
  await expect(page.locator("h1")).toContainText("Minecraft Dungeons II");
  await page.locator(".category-grid a", { hasText: "近戰武器" }).click();
  await expect(page).toHaveURL(/\/zh\/melee\/$/);
});

test("entry page shows bilingual name and icon", async ({ page }) => {
  await page.goto("/zh/melee/");
  await page.locator(".entry-card a", { has: page.locator(".primary", { hasText: /^劍$/ }) }).click();
  await expect(page).toHaveURL(/\/zh\/melee\/sword\/$/);
  await expect(page.locator("h1 .primary")).toHaveText("劍");
  await expect(page.locator("h1 .alt")).toHaveText("Sword");
  await expect(page.locator(".entry-head img")).toBeVisible();
});

test("language switch keeps the same entry", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await page.getByTestId("lang-switch").click();
  await expect(page).toHaveURL(/\/en\/melee\/sword\/$/);
  await expect(page.locator("h1 .primary")).toHaveText("Sword");
});

test("compare mode toggles and persists across reloads", async ({ page }) => {
  await page.goto("/zh/melee/sword/");
  await expect(page.locator("h1 .alt")).toBeVisible();
  await page.getByTestId("compare-toggle").click();
  await expect(page.locator("h1 .alt")).toBeHidden();
  await page.reload();
  await expect(page.locator("h1 .alt")).toBeHidden();
  await page.getByTestId("compare-toggle").click();
  await expect(page.locator("h1 .alt")).toBeVisible();
});

test("compare mode still works when storage is blocked", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/zh/melee/sword/");
  await expect(page.locator("h1 .alt")).toBeVisible();
  await page.getByTestId("compare-toggle").click();
  await expect(page.locator("h1 .alt")).toBeHidden();
  expect(errors).toEqual([]);
});

test("list filter narrows by text and variant", async ({ page }) => {
  await page.goto("/zh/melee/");
  const cards = page.locator(".entry-card");
  const total = await cards.count();
  await page.getByTestId("list-filter").locator(".filter-text").fill("劍");
  const visible = page.locator(".entry-card:visible");
  const shown = await visible.count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(total);
  for (const names of await visible.evaluateAll((els) => els.map((el) => el.getAttribute("data-names") ?? ""))) {
    expect(names).toContain("劍");
  }
  await page.getByTestId("list-filter").locator("button[data-variant='unique']").click();
  for (const variant of await visible.evaluateAll((els) => els.map((el) => el.getAttribute("data-variant")))) {
    expect(variant).toBe("unique");
  }
});

test("armor set page lists its pieces and links back", async ({ page }) => {
  await page.goto("/zh/armor/disciple/");
  await expect(page.getByTestId("set-piece")).toHaveCount(4);
  await page.getByTestId("set-piece").first().locator("a").click();
  await expect(page).toHaveURL(/\/zh\/armor\/piece\/disciple-[a-z]+\/$/);
  await expect(page.locator(".related a[href='/zh/armor/disciple/']")).toBeVisible();
});

test("effect table shows placeholder markers", async ({ page }) => {
  await page.goto("/zh/effect/");
  await expect(page.locator(".placeholder").first()).toHaveText("{數值}");
});

test("search finds entries by Chinese and English terms", async ({ page }) => {
  for (const term of ["劍", "sword"]) {
    await page.goto(`/zh/search/?q=${encodeURIComponent(term)}`);
    await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
  }
});

test("all internal links and images resolve", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "crawl once");
  test.setTimeout(300_000);
  const queue = ["/zh/", "/en/"];
  const seen = new Set(queue);
  const broken: string[] = [];
  while (queue.length > 0) {
    const url = queue.shift() as string;
    const response = await request.get(url);
    if (!response.ok()) {
      broken.push(`${url} → ${response.status()}`);
      continue;
    }
    if (!(response.headers()["content-type"] ?? "").includes("text/html")) continue;
    const html = await response.text();
    for (const [, link] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      if (link.startsWith("/pagefind/") || link.startsWith("/_astro/") || seen.has(link)) continue;
      seen.add(link);
      queue.push(link);
    }
  }
  expect(broken).toEqual([]);
});
```

- [ ] **Step 4: 執行 E2E**

Run: `npm run test:e2e`
Expected: 全部 PASS（mobile project 會略過 crawl 測試）。若 search 測試失敗，回到 Task 13 Step 3 的排查步驟。

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/wiki.spec.ts
git commit -m "test: add end-to-end coverage for navigation, compare mode and search" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

---

### Task 15: CI 工作流程、README 與子路徑驗證

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `npm ci`、`npm test`、`npm run build`、`BASE_PATH`
- Produces: 推送到 `main` 時可建置並發布 GitHub Pages 的工作流程（本任務**不推送**）。

- [ ] **Step 1: 建立 `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 建立 `README.md`**

````markdown
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
npm run test:e2e     # build 後執行 Playwright
npm run build        # 產生 dist/ 與 Pagefind 索引
```

## 部署

`.github/workflows/deploy.yml` 在推送到 `main` 時建置並發布到 GitHub Pages，`BASE_PATH` 自動設為 `/<repo>/`。
若 repo 是 `<user>.github.io`，請把 `BASE_PATH` 改成 `/`。
````

- [ ] **Step 3: 驗證子路徑建置**

Run（Git Bash，`MSYS_NO_PATHCONV=1` 避免路徑被轉換）：
```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/mcd2-wiki/ npm run build
grep -o 'href="/mcd2-wiki/zh/melee/"' dist/zh/index.html | head -1
grep -o 'src="/mcd2-wiki/icons/melee/sword.png"' dist/zh/melee/sword/index.html | head -1
grep -o 'baseUrl.\{0,20\}mcd2-wiki' dist/zh/search/index.html | head -1
```
Expected: 三個 grep 都有輸出。

- [ ] **Step 4: 還原預設建置並跑完整測試**

Run: `npm run build && npm test && npx playwright test`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: add GitHub Pages workflow and README" -m "Claude-Session: https://claude.ai/code/session_01GW32G12FziESRLVmVw85qm"
```

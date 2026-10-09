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

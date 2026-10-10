import type { Category, Lang } from "../../scripts/extract/config";
import type { ArmorPiece } from "../../scripts/extract/schemas";

export type { Lang };

export const HTML_LANG: Readonly<Record<Lang, string>> = { zh: "zh-TW", en: "en" };

export const otherLang = (lang: Lang): Lang => (lang === "zh" ? "en" : "zh");

export const UI_STRINGS = {
  zh: {
    siteTitle: "Minecraft Dungeons II 中文 Wiki",
    siteShort: "MCD2 中文 Wiki",
    tagline: "收錄武器、護甲、神器、護符、附魔與效果，遊戲內文字中英對照。",
    skipToContent: "跳到主要內容",
    compareShort: "對照",
    switchLangShort: "EN",
    browse: "瀏覽分類",
    notFoundTitle: "找不到這個頁面",
    notFoundBody: "這一格是空的。網址可能打錯了，或這個條目尚未收錄。",
    backHome: "回到首頁",
    home: "首頁",
    search: "搜尋",
    siteSearch: "全站搜尋",
    compare: "中英對照",
    switchLang: "English",
    all: "全部",
    normal: "一般",
    unique: "獨特",
    rarityCommon: "普通",
    rarityRare: "稀有",
    raritySpecial: "特殊",
    possibleRarity: "可能為",
    filterPlaceholder: "篩選名稱…",
    noResults: "沒有符合的條目",
    untranslated: "未翻譯",
    related: "相關條目",
    relatedVariant: "另一版本",
    enchantmentBook: "附魔書",
    obtainedFromBook: "附魔書可用來為物品附上特殊力量與能力。若要使用附魔書，你必須前往英雄港與附魔匠交談。附魔書可無限次使用。",
    armorSet: "所屬套裝",
    name: "名稱",
    description: "描述",
    equipment: "裝備",
    enchanting: "附魔與效果",
    unlock: "解鎖",
    searchPlaceholder: "搜尋物品、附魔、效果…",
    categories: "分類",
    fontCredit: "字型：Noto Serif TC、Geist（SIL OFL 1.1）",
    view: "查看",
    close: "關閉",
    itemDetails: "物品說明",
    category: "分類",
    rarity: "稀有度",
    armorPiece: "部位",
    translation: "翻譯",
    details: "詳細說明",
    pieces: "部位數",
    setPieces: "套裝部位",
    placeholderNote: "「{數值}」表示遊戲內會顯示實際數值，原始資料未提供。",
    disclaimer: "非官方粉絲網站，與 Mojang Studios／Microsoft 無關。遊戲文字與圖像版權歸原權利人所有。",
    source: "資料來源：Minecraft Dungeons II 遊戲語系檔（繁體中文／英文）。",
  },
  en: {
    siteTitle: "Minecraft Dungeons II Wiki (zh-TW)",
    siteShort: "MCD2 Wiki",
    tagline: "Weapons, armor, artifacts, talismans, enchantments and effects, with the game's own text in Chinese and English.",
    skipToContent: "Skip to main content",
    compareShort: "Dual",
    switchLangShort: "中文",
    browse: "Browse",
    notFoundTitle: "Page not found",
    notFoundBody: "This slot is empty. The address may be mistyped, or the entry is not in the wiki yet.",
    backHome: "Back to home",
    home: "Home",
    search: "Search",
    siteSearch: "Site search",
    compare: "Bilingual",
    switchLang: "繁體中文",
    all: "All",
    normal: "Normal",
    unique: "Unique",
    rarityCommon: "Common",
    rarityRare: "Rare",
    raritySpecial: "Special",
    possibleRarity: "Can be",
    filterPlaceholder: "Filter by name…",
    noResults: "No matching entries",
    untranslated: "Untranslated",
    related: "Related",
    relatedVariant: "Other variant",
    enchantmentBook: "Enchantment book",
    obtainedFromBook: "Enchantment books can be used to enchant your items with special powers and abilities. In order to use the enchantment books you will have to travel to Brave Haven and talk to the Enchantsmith. Enchantment books can be used unlimited times.",
    armorSet: "Armor set",
    name: "Name",
    description: "Description",
    equipment: "Equipment",
    enchanting: "Enchantments & Effects",
    unlock: "Unlock",
    searchPlaceholder: "Search items, enchantments, effects…",
    categories: "Categories",
    fontCredit: "Type: Noto Serif TC, Geist (SIL OFL 1.1)",
    view: "View",
    close: "Close",
    itemDetails: "Item details",
    category: "Category",
    rarity: "Rarity",
    armorPiece: "Slot",
    translation: "Translation",
    details: "Details",
    pieces: "Pieces",
    setPieces: "Set pieces",
    placeholderNote: "\"{value}\" marks a number the game fills in; it is not in the source data.",
    disclaimer: "Unofficial fan site, not affiliated with Mojang Studios or Microsoft. Game text and images belong to their respective owners.",
    source: "Source: Minecraft Dungeons II localization files (Traditional Chinese / English).",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type UiKey = keyof (typeof UI_STRINGS)["zh"];

export const t = (lang: Lang, key: UiKey): string => UI_STRINGS[lang][key];

export const CATEGORY_LABEL: Readonly<Record<Category, Readonly<Record<Lang, string>>>> = {
  melee: { zh: "近戰武器", en: "Melee Weapons" },
  ranged: { zh: "遠程武器", en: "Ranged Weapons" },
  armor: { zh: "護甲", en: "Armor" },
  artifact: { zh: "神器", en: "Artifacts" },
  talisman: { zh: "護符", en: "Talismans" },
  cape: { zh: "披風", en: "Capes" },
  pet: { zh: "寵物", en: "Pets" },
  skin: { zh: "外觀", en: "Skins" },
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
  { key: "equipment", categories: ["melee", "ranged", "armor", "artifact", "talisman"] },
  { key: "enchanting", categories: ["enchantment", "effect"] },
];

// Published categories. Enchantment books have no pages of their own: each one is shown on the
// enchantment it grants. Statuses, capes, pets and skins are still extracted but not published for now.
export const GRID_CATEGORIES = ["melee", "ranged", "artifact", "talisman", "enchantment"] as const satisfies readonly Category[];
export const TABLE_CATEGORIES = ["effect"] as const satisfies readonly Category[];

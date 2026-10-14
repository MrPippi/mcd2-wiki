/** The mechanics guides for the site: data from `npm run extract` and the helpers their pages format with. Server-side only. */
import { escapeHtml } from "../../scripts/extract/render-markup";
import {
  GuidesDataSchema, type DropRow, type GearType, type GuideText, type GuidesData, type Rarity, type TextId, type Vendor,
} from "../../scripts/extract/guides-schema";
import rawGuides from "../data/guides.json";
import { t, type Lang, type UiKey } from "./i18n";
import { htmlLang } from "./lang";
import { RARITY_LABEL } from "./rarity";

/** Guides data from `npm run extract`, validated at build time. */
export const guidesData: GuidesData = GuidesDataSchema.parse(rawGuides);

export interface GuideLink {
  /** Path segment after /<lang>/guides/. */
  readonly slug: string;
  readonly title: UiKey;
  readonly summary: UiKey;
}

/** The guides in hub order. */
export const GUIDES: readonly GuideLink[] = [
  { slug: "vendors", title: "guideVendors", summary: "guideVendorsSummary" },
  { slug: "enchanting", title: "guideEnchanting", summary: "guideEnchantingSummary" },
  { slug: "rarity", title: "guideRarity", summary: "guideRaritySummary" },
  { slug: "secret-talismans", title: "guideSecretTalismans", summary: "guideSecretTalismansSummary" },
  { slug: "progression", title: "guideProgression", summary: "guideProgressionSummary" },
];

export const guideBySlug = (slug: string): GuideLink | undefined => GUIDES.find((guide) => guide.slug === slug);

export interface ShownText {
  readonly html: string;
  readonly untranslated: boolean;
}

/** A game text in the page language and whether it fell back to English; undefined when the game has none. */
export function shown(text: GuideText | null | undefined, lang: Lang): ShownText | undefined {
  const html = text?.html[lang] ?? "";
  return html === "" ? undefined : { html, untranslated: text?.untranslated.includes(lang) === true };
}

export const textOf = (data: GuidesData, id: TextId, lang: Lang): ShownText | undefined => shown(data.texts[id], lang);

/** Whether any of the given texts fell back to English: a section shows one marker for all of them. */
export const anyUntranslated = (texts: readonly (ShownText | undefined)[]): boolean => texts.some((text) => text?.untranslated === true);

/** A number written the page language's way (99,999 / 99.999 / 99 999). */
export const formatNumber = (value: number, lang: Lang): string => new Intl.NumberFormat(htmlLang(lang), { maximumFractionDigits: 2 }).format(value);

/** A signed number: "+1", "−2", "0". */
export const formatSigned = (value: number, lang: Lang): string =>
  new Intl.NumberFormat(htmlLang(lang), { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(value);

export const formatShare = (share: number, lang: Lang): string =>
  new Intl.NumberFormat(htmlLang(lang), { style: "percent", maximumFractionDigits: 1 }).format(share);

/** A UI sentence as HTML: the template is escaped, each `{name}` takes the given HTML (already safe) or escaped plain text. */
export function fill(template: string, values: Readonly<Record<string, { html: string } | string>>): string {
  return escapeHtml(template).replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) return whole;
    return typeof value === "string" ? escapeHtml(value) : value.html;
  });
}

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** The plain text of rendered game HTML, for attributes such as aria-label. */
export const plainText = (html: string): string =>
  html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);

const ROMAN = ["I", "II", "III", "IV", "V"] as const;
/** 3 → "III", the way the game writes enchantment levels; plain digits beyond the table. */
export const roman = (level: number): string => ROMAN[level - 1] ?? String(level);

export const rarityName = (rarity: Rarity, lang: Lang): string => t(lang, RARITY_LABEL[rarity]);

const GEAR_KEY = {
  melee: "categoryMelee",
  ranged: "categoryRanged",
  helmet: "pieceHelmet",
  chest: "pieceChest",
  leggings: "pieceLeggings",
  boots: "pieceBoots",
  artifact: "categoryArtifact",
} as const satisfies Record<GearType, UiKey>;

export const gearName = (gear: GearType, lang: Lang): string => t(lang, GEAR_KEY[gear]);

/** The game texts that name and describe each vendor. */
export const VENDOR_TEXTS = {
  merchant: { name: "merchantName", intro: "merchantIntro", levels: { 2: "merchantLevel2", 3: "merchantLevel3" } },
  blacksmith: { name: "blacksmithName", intro: "blacksmithIntro", levels: { 2: "blacksmithLevel2", 3: "blacksmithLevel3" } },
  enchantsmith: { name: "enchantsmithName", intro: "enchantsmithIntro", levels: { 2: "enchantsmithLevel2", 3: "enchantsmithLevel3" } },
} as const satisfies Record<Vendor, { name: TextId; intro: TextId; levels: Record<number, TextId> }>;

/** The unlock text for a vendor level; undefined when the game has none for that level. */
export function unlockText(data: GuidesData, vendor: Vendor, level: number, lang: Lang): ShownText | undefined {
  const levels: Readonly<Record<number, TextId>> = VENDOR_TEXTS[vendor].levels;
  const id = levels[level];
  return id === undefined ? undefined : textOf(data, id, lang);
}

export interface ShareRow {
  readonly rarity: Rarity;
  /** "50" for a set weight, "×0" for a multiplier. */
  readonly weight: string;
  /** The weight's share of the row; null when the row's total cannot be read from the row alone. */
  readonly share: number | null;
}

/**
 * Each weight and its share of its own row. A multiplier only scales a weight set elsewhere, so the row alone gives a
 * share only when every multiplier is ×0 (that rarity then counts as 0); otherwise every share is null.
 */
export function dropShares(row: DropRow, lang: Lang): ShareRow[] {
  const readable = row.weights.every((entry) => entry.operation === "set" || entry.weight === 0);
  const effective = row.weights.map((entry) => (entry.operation === "set" ? entry.weight : 0));
  const total = effective.reduce((sum, weight) => sum + weight, 0);
  return row.weights.map((entry, index) => ({
    rarity: entry.rarity,
    weight: entry.operation === "set" ? formatNumber(entry.weight, lang) : `×${formatNumber(entry.weight, lang)}`,
    share: readable && total > 0 ? effective[index] / total : null,
  }));
}

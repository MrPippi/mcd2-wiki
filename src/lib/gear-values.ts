import type { Entry, Localized } from "../../scripts/extract/schemas";
import { ArtifactDataSchema, EnchantmentDataSchema, type ArtifactData, type EnchantmentData } from "../../scripts/extract/gear-schema";
import { z } from "zod";
import rawArtifacts from "../data/artifacts.json";
import rawEffects from "../data/effects.json";
import rawEnchantments from "../data/enchantments.json";
import { LANGS } from "../../scripts/extract/langs";
import type { Lang } from "./i18n";
import { htmlLang, mapLocalized } from "./lang";
import { t, type UiKey } from "./ui-strings";
import { blocksText, roundText, secondsText } from "./units";

/** Artifact numbers and enchantment description values read from the game's DataTables by `npm run extract`. */
export const artifactData: ArtifactData = ArtifactDataSchema.parse(rawArtifacts);
export const enchantmentData: EnchantmentData = EnchantmentDataSchema.parse(rawEnchantments);
/** Effect description values per tier (one template per tier, the same wherever the effect rolls). */
export const effectData: EnchantmentData = EnchantmentDataSchema.parse(rawEffects);

const SLOT = /<span class="(placeholder|plural)" data-slot="([^"]*)"(?: data-forms="([^"]*)")?>(?:\{[^}]*\})?<\/span>/g;
const TIER_LABELS = ["I", "II", "III"] as const;
const FormsSchema = z.record(z.string(), z.string());

const unescapeQuotes = (text: string): string => text.replace(/&quot;/g, '"');

const NUMBER_RUN = /\d+(?:\.\d+)?/g;

/** The number a plural agrees with: the last one in the value ("1~3" → 3, "20%" → 20), as nouns agree with the nearest numeral. */
const lastNumber = (value: string): number | undefined => {
  const runs = value.match(NUMBER_RUN);
  return runs ? Number(runs[runs.length - 1]) : undefined;
};

/** The plural form of `forms` (a JSON map) for a value; a value with no number takes "other". */
function pluralForm(forms: string, value: string, lang: Lang): string {
  const parsed = FormsSchema.safeParse(JSON.parse(unescapeQuotes(forms)));
  const map = parsed.success ? parsed.data : {};
  const number = lastNumber(value);
  const category = number === undefined ? "other" : new Intl.PluralRules(htmlLang(lang)).select(number);
  return map[category] ?? map.other ?? Object.values(map)[0] ?? "";
}

/** Game text with its placeholders filled by slot number (and plural forms chosen for the value); slots with no value stay as they are. */
export function fillPlaceholders(html: string, values: readonly string[], lang: Lang): string {
  return html.replace(SLOT, (match, kind: string, slot: string, forms: string | undefined) => {
    const value = /^\d+$/.test(slot) ? values[Number(slot)] : undefined;
    if (value === undefined) return match;
    return kind === "plural" ? `<span class="plural">${pluralForm(forms ?? "{}", value, lang)}</span>` : `<span class="value">${value}</span>`;
  });
}

const fill = (text: Localized, values: readonly string[]): Localized => mapLocalized(text, (html, lang) => fillPlaceholders(html, values, lang));

/** Each slot from tier I to tier III, e.g. "20%~50%"; one value when the tiers do not differ. */
const ranges = (tiers: readonly (readonly string[])[]): string[] =>
  (tiers[0] ?? []).map((low, slot) => {
    const high = tiers[tiers.length - 1]?.[slot] ?? low;
    return low === high ? low : `${low}~${high}`;
  });

/** The tier values that fill an entry's texts: its own, or for a book, its enchantment's. */
function tiersOf(entry: Entry): readonly (readonly string[])[] | undefined {
  if (entry.category === "effect") return effectData[entry.slug]?.tiers;
  if (entry.category === "enchantment") return enchantmentData[entry.slug]?.tiers;
  if (entry.category === "enchantment-book" && entry.links.enchantment) return enchantmentData[entry.links.enchantment]?.tiers;
  return undefined;
}

/** An entry's description with any values the game data gives filled in (as the tier I–III range). */
export function describedEntry(entry: Entry): Localized | undefined {
  const tiers = tiersOf(entry);
  return entry.description && tiers ? fill(entry.description, ranges(tiers)) : entry.description;
}

/** The long description, filled the same way. */
export function describedLong(entry: Entry): Localized | undefined {
  const tiers = tiersOf(entry);
  return entry.descriptionLong && tiers ? fill(entry.descriptionLong, ranges(tiers)) : entry.descriptionLong;
}

const UNFILLED = /class="placeholder" data-slot="/;

/** Whether every value in the entry's texts could be filled from the game data. */
export const isFullyDescribed = (entry: Entry): boolean =>
  !UNFILLED.test([describedEntry(entry), describedLong(entry)].flatMap((text) => LANGS.map((lang) => text?.[lang] ?? "")).join(""));

/** An enchantment's description filled at each tier (I–III), for a tier table; undefined without game values. */
export function enchantmentTiers(entry: Entry): { label: string; text: Localized }[] | undefined {
  const tiers = entry.category === "enchantment" ? enchantmentData[entry.slug]?.tiers : undefined;
  if (!tiers || tiers.length < TIER_LABELS.length || !entry.description) return undefined;
  const description = entry.description;
  return TIER_LABELS.map((label, i) => ({ label, text: fill(description, tiers[i] ?? []) }));
}

const ROW_KEY = {
  cooldownSeconds: "statLabelCooldownSeconds",
  soulCost: "statLabelSoulCost",
  lifetimeSeconds: "statLabelLifetimeSeconds",
  range: "statLabelAreaRange",
} as const satisfies Record<string, UiKey>;

/** An artifact's numbers ready to print; undefined when the game data has none for it. */
export function artifactStatsView(lang: Lang, artifact: Entry): { label: string; value: string }[] | undefined {
  const data = artifact.category === "artifact" ? artifactData[artifact.slug] : undefined;
  if (!data) return undefined;
  const rows: ({ label: string; value: string } | undefined)[] = [
    data.cooldownSeconds !== undefined ? { label: t(lang, ROW_KEY.cooldownSeconds), value: secondsText(lang, data.cooldownSeconds) } : undefined,
    data.soulCost !== undefined ? { label: t(lang, ROW_KEY.soulCost), value: roundText(data.soulCost) } : undefined,
    data.lifetimeSeconds !== undefined ? { label: t(lang, ROW_KEY.lifetimeSeconds), value: secondsText(lang, data.lifetimeSeconds) } : undefined,
    data.range !== undefined ? { label: t(lang, ROW_KEY.range), value: blocksText(lang, data.range) } : undefined,
  ];
  return rows.filter((row): row is { label: string; value: string } => row !== undefined);
}

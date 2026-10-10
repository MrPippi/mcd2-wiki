import type { Entry, Localized } from "../../scripts/extract/schemas";
import { ArtifactDataSchema, EnchantmentDataSchema, type ArtifactData, type EnchantmentData } from "../../scripts/extract/gear-schema";
import rawArtifacts from "../data/artifacts.json";
import rawEffects from "../data/effects.json";
import rawEnchantments from "../data/enchantments.json";
import type { Lang } from "./i18n";

/** Artifact numbers and enchantment description values read from the game's DataTables by `npm run extract`. */
export const artifactData: ArtifactData = ArtifactDataSchema.parse(rawArtifacts);
export const enchantmentData: EnchantmentData = EnchantmentDataSchema.parse(rawEnchantments);
/** Effect description values per tier (one template per tier, the same wherever the effect rolls). */
export const effectData: EnchantmentData = EnchantmentDataSchema.parse(rawEffects);

const PLACEHOLDER = /<span class="placeholder">\{[^}]*\}<\/span>/g;
const TIER_LABELS = ["I", "II", "III"] as const;

/** Game text with its placeholders filled in order; placeholders beyond the given values stay as they are. */
export function fillPlaceholders(html: string, values: readonly string[]): string {
  let next = 0;
  return html.replace(PLACEHOLDER, (placeholder) => {
    const value = values[next++];
    return value === undefined ? placeholder : `<span class="value">${value}</span>`;
  });
}

const fill = (text: Localized, values: readonly string[]): Localized => ({
  zh: fillPlaceholders(text.zh, values),
  en: fillPlaceholders(text.en, values),
});

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

const UNFILLED = /class="placeholder"/;

/** Whether every value in the entry's texts could be filled from the game data. */
export const isFullyDescribed = (entry: Entry): boolean =>
  !UNFILLED.test(`${describedEntry(entry)?.zh ?? ""}${describedEntry(entry)?.en ?? ""}${describedLong(entry)?.zh ?? ""}${describedLong(entry)?.en ?? ""}`);

/** An enchantment's description filled at each tier (I–III), for a tier table; undefined without game values. */
export function enchantmentTiers(entry: Entry): { label: string; text: Localized }[] | undefined {
  const tiers = entry.category === "enchantment" ? enchantmentData[entry.slug]?.tiers : undefined;
  if (!tiers || tiers.length < TIER_LABELS.length || !entry.description) return undefined;
  const description = entry.description;
  return TIER_LABELS.map((label, i) => ({ label, text: fill(description, tiers[i] ?? []) }));
}

const LABEL = {
  cooldownSeconds: { zh: "冷卻時間", en: "Cooldown" },
  soulCost: { zh: "靈魂消耗", en: "Soul cost" },
  lifetimeSeconds: { zh: "持續時間", en: "Duration" },
  range: { zh: "範圍", en: "Range" },
} as const satisfies Record<string, Localized>;

const round = (value: number): string => String(Math.round(value * 100) / 100);

/** An artifact's numbers ready to print; undefined when the game data has none for it. */
export function artifactStatsView(lang: Lang, artifact: Entry): { label: string; value: string }[] | undefined {
  const data = artifact.category === "artifact" ? artifactData[artifact.slug] : undefined;
  if (!data) return undefined;
  const seconds = (value: number) => (lang === "zh" ? `${round(value)} 秒` : `${round(value)} sec`);
  const blocks = (value: number) => (lang === "zh" ? `${round(value)} 格` : `${round(value)} ${value === 1 ? "block" : "blocks"}`);
  const rows = [
    data.cooldownSeconds !== undefined ? { label: LABEL.cooldownSeconds[lang], value: seconds(data.cooldownSeconds) } : undefined,
    data.soulCost !== undefined ? { label: LABEL.soulCost[lang], value: round(data.soulCost) } : undefined,
    data.lifetimeSeconds !== undefined ? { label: LABEL.lifetimeSeconds[lang], value: seconds(data.lifetimeSeconds) } : undefined,
    data.range !== undefined ? { label: LABEL.range[lang], value: blocks(data.range) } : undefined,
  ];
  return rows.filter((row): row is { label: string; value: string } => row !== undefined);
}

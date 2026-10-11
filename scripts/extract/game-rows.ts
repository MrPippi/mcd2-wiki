/** Helpers shared by the weapon, artifact and enchantment builders that read the game's DataTables. */
import type { Entry } from "./schemas";
import { matchesTagQuery } from "./tag-query";
import type { EffectFormat } from "./weapon-schema";
import type { GameTables, TextDataValue } from "./game-tables";

/** Game distances are in centimetres; a block is 100. */
const UNITS_PER_BLOCK = 100;
export const TIERS = ["I", "II", "III"] as const;
/** Every piece of gear carries this tag in game, though the DataTables leave it out of the item traits. */
export const GEAR_TAG = "SW.Item.Property.Gear";
// Case-insensitive: some real keys start with "sw_" (Wonderful Wheat is sw_Item_Talisman_Llama_SW_TextEntry_Name).
const LOC_ID = /"SW_(?:Item|Effect|Enchantment)_(.+?)_SW_TextEntry_(?:Name|Description)"/i;

export const blocks = (units: number): number => Math.round((units / UNITS_PER_BLOCK) * 100) / 100;

export const tagNames = (tags: { GameplayTags?: { TagName: string }[] } | undefined): string[] =>
  (tags?.GameplayTags ?? []).map((tag) => tag.TagName);

/** The localization id a row's texts use (SW_Item_<id>_SW_TextEntry_Name), which is also the entry id. */
export const locId = (texts: TextDataValue): string | undefined =>
  Object.values(texts?.Texts ?? {})
    .map((entry) => LOC_ID.exec(entry.Text)?.[1])
    .find((id) => id !== undefined);

/** Finds an entry by category and id, ignoring case (DataTable row names and loc ids differ in casing). */
export function entryIndex(entries: readonly Entry[]) {
  const byKey = new Map(entries.map((entry) => [`${entry.category}:${entry.id.toLowerCase()}`, entry]));
  return (category: Entry["category"], id: string | undefined): Entry | undefined =>
    id === undefined ? undefined : byKey.get(`${category}:${id.toLowerCase()}`);
}

/** The description text entry of a row, with its value getter and formatting. */
export const descriptionOf = (texts: TextDataValue) =>
  Object.entries(texts?.Texts ?? {}).find(([key]) => key.includes("Description"))?.[1];

export const toFormat = (formatting: {
  IsPercentage: boolean;
  Multiplier: number;
  Offset: number;
  MaxFractionalDigits: number;
}): EffectFormat => ({
  percent: formatting.IsPercentage,
  multiplier: formatting.Multiplier,
  offset: formatting.Offset,
  maxFractionDigits: formatting.MaxFractionalDigits,
});

/** A magnitude the way the game prints it: scaled, offset, as a percentage when the text says so. */
export function formatMagnitude(value: number, format: EffectFormat | undefined): string {
  if (!format) return String(value);
  const scaled = (value * format.multiplier + format.offset) * (format.percent ? 100 : 1);
  const factor = 10 ** format.maxFractionDigits;
  const rounded = Math.round(scaled * factor) / factor;
  return format.percent ? `${rounded}%` : String(rounded);
}

/**
 * The effects an item can roll and their tier I/II/III magnitudes, keyed by effect tag. Drop table rows matching the
 * item's tags pick effect template groups; each template's base templates exclude item kinds it cannot go on.
 */
export function effectPool(itemTags: ReadonlySet<string>, tables: GameTables): Map<string, number[]> {
  const groupTags = tables.dropTable
    .filter((row) => itemTags.has(row.TypeTag.TagName))
    .flatMap((row) => [...(row.PrimaryETG?.Tags ?? []), ...(row.SecondaryETG?.Tags ?? [])])
    .map((tag) => tag.TypeTag.TagName);
  const templateTags = new Set(
    tables.groups
      .filter((group) => groupTags.includes(group.TypeTag.TagName))
      .flatMap((group) => (group.TagList?.Tags ?? []).map((tag) => tag.TypeTag.TagName)),
  );
  const baseQueries = new Map(
    tables.templates.flatMap((template) =>
      template.TemplateData.IncompatibleTagsQuery ? [[template.TypeTag.TagName, template.TemplateData.IncompatibleTagsQuery] as const] : [],
    ),
  );
  const tierOf = (tag: string) => TIERS.findIndex((name) => tag.endsWith(`.${name}`));
  const allowed = tables.templates.filter((template) => {
    if (tierOf(template.TypeTag.TagName) === -1 || !templateTags.has(template.TypeTag.TagName)) return false;
    const bases = tagNames(template.Traits).flatMap((tag) => baseQueries.get(tag) ?? []);
    return !bases.some((query) => matchesTagQuery(query, itemTags));
  });
  return allowed.reduce((pool, template) => {
    const effect = template.TemplateData.Effect?.TagName;
    const value = template.TemplateData.FixedEffectValue;
    if (!effect || value === undefined) return pool;
    const tiers = [...(pool.get(effect) ?? [])];
    tiers[tierOf(template.TypeTag.TagName)] = value;
    return new Map(pool).set(effect, tiers);
  }, new Map<string, number[]>());
}

/** Effect rows mapped to their site entries, keyed by effect tag. */
export function effectEntries(tables: GameTables, find: ReturnType<typeof entryIndex>): Map<string, Entry> {
  return new Map(
    tables.effects.flatMap((row) => {
      const entry = find("effect", locId(row.TypeTextData));
      return entry ? [[row.TypeTag.TagName, entry] as const] : [];
    }),
  );
}

/** An item's rollable effects as site slugs with three tier values, sorted by English name; unmatched tags listed. */
export function compatibleEffects(itemTags: ReadonlySet<string>, tables: GameTables, effects: ReadonlyMap<string, Entry>) {
  const rows = [...effectPool(itemTags, tables)].map(([tag, tiers]) => ({ tag, tiers, entry: effects.get(tag) }));
  const compatible = rows
    .flatMap(({ entry, tiers }) =>
      entry && tiers.length === TIERS.length ? [{ entry, tiers: [tiers[0], tiers[1], tiers[2]] as [number, number, number] }] : [],
    )
    .sort((a, b) => a.entry.name.en.localeCompare(b.entry.name.en, "en"))
    .map(({ entry, tiers }) => ({ effect: entry.slug, tiers }));
  return { compatible, unmatched: rows.filter(({ entry }) => !entry).map(({ tag }) => tag) };
}

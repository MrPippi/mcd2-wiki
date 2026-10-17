/**
 * Per-item effect pools for the affix odds tables (affix-pool.ts says how a pool is assembled from the DataTables): which
 * random effects each melee weapon, ranged weapon, armor piece and artifact rolls, with the weights the page needs to
 * compute the odds for any threat, rarity and Soul Storm bonus. Items with the same pool share one model.
 */
import { createHash } from "node:crypto";
import { AFFIX_RARITIES, type AffixData, type AffixItem } from "./affix-schema";
import { groupTemplates, inheritedTags, poolGroups, poolTags } from "./affix-pool";
import { effectEntries, entryIndex, excludedFor, locId, tagNames, tierOf } from "./game-rows";
import type { GameTables } from "./game-tables";
import type { RarityTier, ThreatRow } from "./guides-schema";
import { issue, type Issue } from "./issues";
import type { Entry } from "./schemas";

type Rarity = (typeof AFFIX_RARITIES)[number];
type ItemRow = GameTables["items"][number];
type ModelEntry = AffixData["models"][string]["entries"][number];

/** Rarities an item can roll: normal items Rare and Special, a unique variant Unique (a Unique roll turns a base item into it). */
const RARITIES_OF: Readonly<Record<Entry["variant"], readonly Rarity[]>> = { normal: ["rare", "special"], unique: ["unique"] };
/** Every artifact is an artifact to the drop table, although the Well and Quiver rows leave the tag out. */
const ARTIFACT_TAG = "SW.Item.Property.Artifact";

interface Row {
  readonly item: ItemRow;
  readonly entry: Entry;
  /** Tags the item has in game without listing them. */
  readonly implied: readonly string[];
  /** The rows of the item's own table, which its tags may name as parents. */
  readonly siblings: readonly ItemRow[];
}

const hashOf = (entries: readonly ModelEntry[]): string => createHash("sha1").update(JSON.stringify(entries)).digest("hex").slice(0, 8);

function rowsOf(entries: readonly Entry[], tables: GameTables): Row[] {
  const find = entryIndex(entries);
  const kinds: readonly (readonly [readonly ItemRow[], readonly Entry["category"][], readonly string[]])[] = [
    [tables.items, ["melee", "ranged"], []],
    [tables.armor, ["armor"], []],
    [tables.artifacts, ["artifact"], [ARTIFACT_TAG]],
  ];
  return kinds.flatMap(([items, categories, implied]) =>
    items.flatMap((item) => {
      const id = locId(item.TypeTextData) ?? item.Name;
      const entry = categories.map((category) => find(category, id)).find((found) => found !== undefined);
      return entry ? [{ item, entry, implied, siblings: items }] : [];
    }),
  );
}

/** Things the model ignores that would change the odds if the game used them. */
function ignoredIssues(tables: GameTables): Issue[] {
  const secondary = tables.dropTable.filter((row) => (row.SecondaryETG?.Tags ?? []).length > 0);
  const power = tables.templates.filter((template) => tierOf(template.TypeTag.TagName) !== -1 && (template.TemplateData.MinimumRequiredItemPower ?? 0) !== 0);
  return [
    ...secondary.map((row) => issue("affix-ignored", `${row.TypeTag.TagName}: SecondaryETG is read like PrimaryETG`)),
    ...power.map((template) => issue("affix-ignored", `${template.TypeTag.TagName}: MinimumRequiredItemPower ${template.TemplateData.MinimumRequiredItemPower} is not applied`)),
  ];
}

/** Pool and built-in effects of an item, with effects named by their site slug (the effect tag when the site has no entry). */
function poolReader(entries: readonly Entry[], tables: GameTables) {
  const effects = effectEntries(tables, entryIndex(entries));
  const templates = new Map(tables.templates.map((template) => [template.TypeTag.TagName, template]));
  const excluded = excludedFor(tables);
  const effectOf = (templateTag: string): string | undefined => {
    const effect = templates.get(templateTag)?.TemplateData.Effect?.TagName;
    return effect && effect !== "None" ? (effects.get(effect)?.slug ?? effect) : undefined;
  };
  const modelOf = (itemTags: ReadonlySet<string>): ModelEntry[] =>
    groupTemplates(poolGroups(itemTags, tables), tables).flatMap(({ template: tag, ops }) => {
      const template = templates.get(tag);
      const effect = effectOf(tag);
      const tier = tierOf(tag) + 1;
      if (!template || !effect || tier < 1 || excluded(template, itemTags)) return [];
      return [{ effect, tier: tier as 1 | 2 | 3, ops: ops.map(([op, weight]) => [op, weight] as [typeof op, number]) }];
    });
  const fixedOf = (item: ItemRow): string[] => tagNames(item.Effects).flatMap((tag) => effectOf(tag) ?? []);
  return { modelOf, fixedOf };
}

function raritiesOf(variant: Entry["variant"], tiers: readonly RarityTier[]): AffixItem["rarities"] {
  return RARITIES_OF[variant].flatMap((rarity) => {
    const tier = tiers.find((found) => found.rarity === rarity);
    return tier && tier.rerollableEffects + (tier.stormExtraEffects ?? 0) > 0
      ? [{ rarity, slots: tier.rerollableEffects, bonusSlots: tier.stormExtraEffects ?? 0 }]
      : [];
  });
}

export function buildAffixModels(
  entries: readonly Entry[],
  tables: GameTables,
  threat: readonly ThreatRow[],
  rarities: readonly RarityTier[],
): { data: AffixData; issues: Issue[] } {
  const { modelOf, fixedOf } = poolReader(entries, tables);
  const built = rowsOf(entries, tables).map(({ item, entry, implied, siblings }) => {
    const model = modelOf(poolTags([...inheritedTags(item, siblings), ...implied]));
    return { slug: entry.slug, model, hash: hashOf(model), fixed: fixedOf(item), rarities: raritiesOf(entry.variant, rarities) };
  });
  const usable = built.filter(({ model, rarities: allowed }) => model.length > 0 && allowed.length > 0);
  const withFactors = threat.filter((row) => row.effectTiers);
  return {
    data: {
      levels: withFactors.map((row) => row.level),
      tierFactors: withFactors.flatMap((row) => (row.effectTiers ? [row.effectTiers] : [])),
      models: Object.fromEntries(usable.map(({ hash, model }) => [hash, { entries: model }])),
      items: Object.fromEntries(usable.map(({ slug, hash, fixed, rarities: allowed }) => [slug, { model: hash, fixed, rarities: allowed }])),
    },
    issues: [
      ...(withFactors.length === 0 ? [issue("guides-value-missing", "affix odds: no effect tier factors per threat level")] : []),
      ...ignoredIssues(tables),
    ],
  };
}

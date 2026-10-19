/**
 * Rarity facts: per-rarity effect counts and item power offset (DT_RarityDefinition), and the base drop weights of the
 * Default and Boss rows (DT_RarityChanceDefinition). How rows combine is engine logic, so no combined odds are built.
 */
import { DROP_SOURCES, RARITIES, type DropRow, type RarityTier } from "../../shared/guides-schema";
import { rarityOfTag } from "./guides-enchanting";
import type { GuideTables } from "./guides-tables";
import { issue, type Issue } from "./issues";

const STORM_REWARD = "SW.Item.Property.StorminatorReward";
const DROP_ROWS: Readonly<Record<(typeof DROP_SOURCES)[number], string>> = { default: "Default", boss: "Boss" };

export function buildRarityTiers(tables: GuideTables): { tiers: RarityTier[]; issues: Issue[] } {
  const rows = new Map(tables.rarity.flatMap((row) => {
    const rarity = rarityOfTag(row.TypeTag.TagName);
    return rarity ? [[rarity, row] as const] : [];
  }));
  const tiers = RARITIES.flatMap((rarity) => {
    const row = rows.get(rarity);
    if (!row) return [];
    const effects = row.RarityDefinition.NumberOfEffectsData;
    const storm = Object.entries(effects.AdditionalEffectChances ?? {}).find(([key]) => key === `(TagName="${STORM_REWARD}")`);
    return [{
      rarity,
      rerollableEffects: effects.BaseNumberOfRerollableEffects,
      stormExtraEffects: storm ? storm[1] : null,
      itemPowerOffset: row.RarityDefinition.ItemPowerGenerationOffset,
    }];
  });
  const missing = RARITIES.filter((rarity) => !rows.has(rarity));
  return { tiers, issues: missing.map((rarity) => issue("guides-value-missing", `DT_RarityDefinition: ${rarity}`)) };
}

const OPERATIONS = { set: "set", multiply: "multiply" } as const;
const operationOf = (raw: string) => {
  const key = raw.toLowerCase();
  return Object.hasOwn(OPERATIONS, key) ? OPERATIONS[key as keyof typeof OPERATIONS] : undefined;
};

/** The weights one rarity-chance row lists, lowest rarity first; a rarity with an operation this page cannot name is skipped and reported. */
function weightsOf(row: GuideTables["rarityChance"][number]): { weights: DropRow["weights"]; issues: Issue[] } {
  const tags = row.TagList.Tags ?? [];
  const found = RARITIES.flatMap((rarity) => {
    const tag = tags.find((entry) => rarityOfTag(entry.TypeTag.TagName) === rarity);
    return tag ? [{ rarity, tag, operation: operationOf(tag.Operation) }] : [];
  });
  return {
    weights: found.flatMap(({ rarity, tag, operation }) => (operation ? [{ rarity, weight: tag.Weight, operation }] : [])),
    issues: found.filter(({ operation }) => !operation).map(({ tag }) => issue("guides-value-missing", `${row.Name}: ${tag.TypeTag.TagName} ${tag.Operation}`)),
  };
}

export function buildDropWeights(tables: GuideTables): { drops: DropRow[]; issues: Issue[] } {
  const built = DROP_SOURCES.map((source) => {
    const row = tables.rarityChance.find((candidate) => candidate.Name === DROP_ROWS[source]);
    return { source, built: row ? weightsOf(row) : undefined };
  });
  return {
    drops: built.flatMap(({ source, built: one }) => (one ? [{ source, weights: one.weights }] : [])),
    issues: built.flatMap(({ source, built: one }) => one?.issues ?? [issue("guides-value-missing", `DT_RarityChanceDefinition: ${DROP_ROWS[source]}`)]),
  };
}

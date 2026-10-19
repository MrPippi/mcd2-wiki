/** Effect description values per tier, from DT_EffectTemplateDefinition (the same magnitudes everywhere the effect rolls). */
import { descriptionOf, effectEntries, entryIndex, formatMagnitude, TIERS, toFormat } from "./game-rows";
import type { GameTables } from "./game-tables";
import type { EnchantmentData } from "../../shared/gear-schema";
import type { Entry } from "../../shared/schemas";

const MAGNITUDE_GETTER = "SW.TextEntry.DataGetter.GetEffectMagnitude";

export function buildEffectData(entries: readonly Entry[], tables: GameTables): EnchantmentData {
  const effects = effectEntries(tables, entryIndex(entries));
  const rows = new Map(tables.effects.map((row) => [row.TypeTag.TagName, row]));
  return Object.fromEntries(
    [...effects].flatMap(([tag, entry]) => {
      const description = descriptionOf(rows.get(tag)?.TypeTextData);
      const formatting = description?.ValuesToGet?.[0]?.FormattingData;
      if (description?.DynamicDataGetterFunction?.TagName !== MAGNITUDE_GETTER || !formatting) return [];
      const tiers = TIERS.map((tier) =>
        tables.templates.find((template) => template.TemplateData.Effect?.TagName === tag && template.TypeTag.TagName.endsWith(`.${tier}`))?.TemplateData.FixedEffectValue,
      );
      if (!tiers.every((value): value is number => value !== undefined)) return [];
      return [[entry.slug, { tiers: tiers.map((value) => [formatMagnitude(value, toFormat(formatting))]) }] as const];
    }),
  );
}

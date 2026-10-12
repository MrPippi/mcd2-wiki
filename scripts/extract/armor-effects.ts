/**
 * The effects each armor piece can roll, the same way weapons and artifacts get theirs (drop table → template groups →
 * templates not excluded for the item's tags), and a unique piece's built-in effect from its Effects tags.
 */
import { compatibleEffects, effectEntries, entryIndex, GEAR_TAG, locId, tagNames } from "./game-rows";
import type { GameTables } from "./game-tables";
import type { ArmorEffectData } from "./gear-schema";
import { issue, type Issue } from "./issues";
import type { Entry } from "./schemas";

export function buildArmorEffects(entries: readonly Entry[], tables: GameTables): { data: ArmorEffectData; issues: Issue[] } {
  const find = entryIndex(entries);
  const effects = effectEntries(tables, find);
  const templates = new Map(tables.templates.map((template) => [template.TypeTag.TagName, template]));

  const fixedOf = (tags: readonly string[]) => {
    const template = tags.map((tag) => templates.get(tag)).find((found) => found?.TemplateData.Effect);
    const effect = effects.get(template?.TemplateData.Effect?.TagName ?? "");
    const value = template?.TemplateData.FixedEffectValue;
    return effect && value !== undefined ? { fixed: { effect: effect.slug, value } } : {};
  };

  const built = tables.armor.flatMap((row) => {
    const piece = find("armor", locId(row.TypeTextData) ?? row.Name);
    if (!piece) return [];
    const { compatible, unmatched } = compatibleEffects(new Set([...tagNames(row.Traits), GEAR_TAG]), tables, effects);
    return [{ slug: piece.slug, data: { compatible, ...fixedOf(tagNames(row.Effects)) }, issues: unmatched.map((tag) => issue("weapon-unmatched", `${piece.id}: ${tag}`)) }];
  });
  return { data: Object.fromEntries(built.map(({ slug, data }) => [slug, data])), issues: built.flatMap((found) => found.issues) };
}

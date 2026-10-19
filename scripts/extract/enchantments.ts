/**
 * Enchantment description values from DT_EnchantmentDefinition. A family has a base row (FireAspect) with texts and
 * abilities, and tier rows (FireAspect.I/II/III, or X.Unique) that either bring their own abilities or specialise the
 * base ones (Override or Add a key value). The description says which key value it prints and how to format it.
 */
import { descriptionOf, entryIndex, formatMagnitude, locId, tagNames, TIERS, toFormat } from "./game-rows";
import type { AbilityValue, EnchantmentRowValue, GameTables } from "./game-tables";
import { issue, type Issue } from "./issues";
import type { Entry } from "../../shared/schemas";
import { ENCHANT_SLOTS, type EnchantmentData, type EnchantSlot } from "../../shared/gear-schema";

const ABILITY_GETTER = "SW.TextEntry.DataGetter.GetAbilityKeyValues";
const MAGNITUDE_GETTER = "SW.TextEntry.DataGetter.GetEffectMagnitude";
const ENCHANTMENT_TAG = "SW.Enchantment.";

type Row = EnchantmentRowValue;

/** The family row a tier row builds on: same name before the dot, else the family named in its traits. */
function familyOf(row: Row, rows: readonly Row[]): Row | undefined {
  const [family] = row.Name.split(".");
  const byName = rows.find((candidate) => candidate.Name === family && candidate !== row);
  if (byName) return byName;
  const traitFamilies = tagNames(row.Traits).filter((tag) => tag.startsWith(ENCHANTMENT_TAG) && tag !== row.TypeTag.TagName);
  return rows.find((candidate) => candidate !== row && traitFamilies.includes(candidate.TypeTag.TagName) && candidate.TypeTextData);
}

/** A key value number; Int values that a description prints as a percentage are whole percents already (8 = 8%). */
interface KeyNumber {
  readonly value: number;
  readonly int: boolean;
}

const keyNumber = (keyValue: { Float?: number; Int?: number }): KeyNumber | undefined =>
  keyValue.Float !== undefined ? { value: keyValue.Float, int: false } : keyValue.Int !== undefined ? { value: keyValue.Int, int: true } : undefined;

/** Key values of each ability (by ability path), numbers only. */
const keyValuesOf = (abilities: readonly AbilityValue[]): Map<string, Map<string, KeyNumber>> =>
  new Map(
    abilities.map((ability) => [
      ability.Ability,
      new Map(
        [...(ability.SpecificKeyValues ?? []), ...(ability.CommonKeyValues ?? [])].flatMap((keyValue) => {
          const number = keyNumber(keyValue);
          return number === undefined ? [] : [[keyValue.TypeTag.TagName, number] as const];
        }),
      ),
    ]),
  );

/** A tier row's ability key values: its own abilities, or the family's, with the row's specialisations applied. */
function tierKeyValues(row: Row, family: Row | undefined): Map<string, Map<string, KeyNumber>> {
  const own = row.Abilities ?? [];
  const base = keyValuesOf(own.length > 0 ? own : (family?.Abilities ?? []));
  for (const specialization of row.AbilitySpecialization?.Specializations ?? []) {
    const values = new Map(base.get(specialization.Ability) ?? []);
    for (const { KeyValue, ModOp } of specialization.KeyValueSpecializations ?? []) {
      const number = keyNumber(KeyValue);
      if (number === undefined) continue;
      const key = KeyValue.TypeTag.TagName;
      if (ModOp === "Override") values.set(key, number);
      if (ModOp === "Add") values.set(key, { value: (values.get(key)?.value ?? 0) + number.value, int: values.get(key)?.int ?? number.int });
    }
    base.set(specialization.Ability, values);
  }
  return base;
}

/**
 * The values a tier row prints in its description, formatted as the game does; undefined when the description
 * uses a getter this site does not model, or a value is missing.
 */
export function enchantmentValues(row: Row, rows: readonly Row[]): string[] | undefined {
  const family = familyOf(row, rows);
  const description = descriptionOf(row.TypeTextData) ?? descriptionOf(family?.TypeTextData);
  const getter = description?.DynamicDataGetterFunction?.TagName;
  const slots = description?.ValuesToGet ?? [];
  if (slots.length === 0 || !slots.every((slot) => slot.FormattingData)) return undefined;
  if (getter === MAGNITUDE_GETTER) {
    const magnitude = row.TemplateData?.FixedEffectValue;
    return magnitude === undefined ? undefined : slots.map((slot) => formatMagnitude(magnitude, slot.FormattingData && toFormat(slot.FormattingData)));
  }
  if (getter !== ABILITY_GETTER) return undefined;
  const abilities = [...tierKeyValues(row, family).values()];
  const values = slots.map((slot) => {
    const key = slot.TagToExtractFrom?.TagName;
    const found = abilities.map((keyValues) => (key ? keyValues.get(key) : undefined)).find((number) => number !== undefined);
    if (found === undefined || !slot.FormattingData) return undefined;
    const format = toFormat(slot.FormattingData);
    return formatMagnitude(found.int && format.percent ? found.value / 100 : found.value, format);
  });
  return values.every((value): value is string => value !== undefined) ? values : undefined;
}

/** Printed values for each enchantment entry: tiers I–III for a family, or one set for a unique with its own entry. */
const SLOT_TAG = "SW.ItemSlot.Equipment.";
/** Game slot tags by build-page slot; slots the page does not have (backpack, artifacts) are left out. */
const SLOT_OF_TAG: Readonly<Record<string, EnchantSlot>> = {
  MeleeWeapon: "melee",
  RangedWeapon: "ranged",
  "Armor.Helmet": "helmet",
  "Armor.Chest": "chest",
  "Armor.Leggings": "leggings",
  "Armor.Boots": "boots",
};

/** The build-page slots a row's RelevantSlots name, in page order. */
export function enchantSlots(row: Row): EnchantSlot[] {
  const named = new Set(
    (row.EnchantmentData?.RelevantSlots?.GameplayTags ?? []).flatMap((tag) => {
      const slot = tag.TagName.startsWith(SLOT_TAG) ? SLOT_OF_TAG[tag.TagName.slice(SLOT_TAG.length)] : undefined;
      return slot ? [slot] : [];
    }),
  );
  return ENCHANT_SLOTS.filter((slot) => named.has(slot));
}

export function buildEnchantmentData(entries: readonly Entry[], tables: GameTables): { data: EnchantmentData; issues: Issue[] } {
  const find = entryIndex(entries);
  const rows = tables.enchantments;
  const byName = new Map(rows.map((row) => [row.Name, row]));
  const issues: Issue[] = [];
  const data = rows.flatMap((row) => {
    const entry = find("enchantment", locId(row.TypeTextData));
    if (!entry) return [];
    const isTierRow = row.Name.includes(".");
    const tiers = isTierRow
      ? [enchantmentValues(row, rows)]
      : TIERS.map((tier) => {
          const tierRow = byName.get(`${row.Name}.${tier}`);
          return tierRow ? enchantmentValues(tierRow, rows) : undefined;
        });
    if (!tiers.every((values): values is string[] => values !== undefined)) return [];
    if (isTierRow) return [[entry.slug, { tiers }] as const];
    const slots = enchantSlots(row);
    if (slots.length === 0) issues.push(issue("enchantment-no-slots", `${row.Name}（${entry.slug}）沒有可用部位，配裝頁不會列出`));
    return [[entry.slug, slots.length > 0 ? { tiers, slots } : { tiers }] as const];
  });
  return { data: Object.fromEntries(data), issues };
}

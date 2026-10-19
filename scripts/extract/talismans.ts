/**
 * Talisman levels. DT_TalismanPropertyDefinition lists each talisman's three levels (XP to the next one, and the effect
 * template the level grants); DT_TalismanEffectTemplateDefinition gives each template's effect and magnitude, printed the
 * way the effect's own description prints it. Most talismans' own descriptions are developer stubs ("Ammo Capacity
 * Talisman Description"), so the site shows the granted effect's description instead. Companion talismans scale their
 * pet per level through the spawn ability's instance data.
 */
import { descriptionOf, entryIndex, formatMagnitude, locId, toFormat } from "./game-rows";
import type { GameTables } from "./game-tables";
import type { TalismanData, TalismanLevel } from "../../shared/gear-schema";
import { issue, type Issue } from "./issues";
import { localizedFrom } from "../../shared/lang";
import { LANGS } from "../../shared/config";
import type { Entry, Localized } from "../../shared/schemas";
import type { TalismanItemRow, TalismanPropertyRow, TalismanTables } from "./talisman-tables";
import type { EffectFormat } from "../../shared/weapon-schema";

const MAGNITUDE_GETTER = "SW.TextEntry.DataGetter.GetEffectMagnitude";
const SECRET_COLLECTION = "SecretTalismans";
const COOLDOWN_KEY = "SW.KeyValue.CooldownDuration";
const COMPANION_LEVELS = ["LevelOne", "LevelTwo", "LevelThree"] as const;
const PLACEHOLDER = /<span class="(?:placeholder|plural)" data-slot="[^"]*"(?: data-forms="[^"]*")?>(?:\{[^}]*\})?<\/span>/g;
const UNKNOWN_VALUE = '<span class="unknown-value">?</span>';

type EffectRow = GameTables["effects"][number];

const hasPlaceholder = (html: string): boolean => new RegExp(PLACEHOLDER.source).test(html);
type Find = ReturnType<typeof entryIndex>;

/** Gameplay tags are case-insensitive in game, and the tables mix "SW." and "sw.". */
const sameTag = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** The format of an effect description that prints a single magnitude; undefined for any other getter. */
function magnitudeFormat(effect: EffectRow | undefined): EffectFormat | undefined {
  const description = descriptionOf(effect?.TypeTextData);
  const slots = description?.ValuesToGet ?? [];
  const formatting = slots[0]?.FormattingData;
  if (description?.DynamicDataGetterFunction?.TagName !== MAGNITUDE_GETTER || slots.length !== 1 || !formatting) return undefined;
  return toFormat(formatting);
}

interface Granted {
  readonly effect: EffectRow;
  readonly magnitude: number;
}

/** The effect and fixed magnitude a level's template grants; undefined when it rolls a value instead or is unknown. */
function grantedEffect(level: LevelRow, tables: TalismanTables, effects: readonly EffectRow[]): Granted | undefined {
  const templateTag = level.Effects?.GameplayTags?.[0]?.TagName;
  const template = templateTag ? tables.templates.find((row) => sameTag(row.TypeTag.TagName, templateTag)) : undefined;
  const data = template?.TemplateData;
  const effectTag = data?.Effect?.TagName;
  const effect = effectTag ? effects.find((row) => sameTag(row.TypeTag.TagName, effectTag)) : undefined;
  if (!effect || data?.HasFixedEffectValue === false || data?.FixedEffectValue === undefined) return undefined;
  return { effect, magnitude: data.FixedEffectValue };
}

type LevelRow = NonNullable<NonNullable<TalismanPropertyRow["ItemLevels"]>["Levels"]>[number];

interface EffectValues {
  readonly effect: EffectRow;
  readonly values: string[][];
}

/** Each level's printed value, when every level grants the same effect with a fixed magnitude and a printable description. */
function effectValues(levels: readonly LevelRow[], tables: TalismanTables, effects: readonly EffectRow[]): EffectValues | undefined {
  const granted = levels.map((level) => grantedEffect(level, tables, effects));
  const first = granted[0];
  if (!first || !granted.every((item): item is Granted => item?.effect === first.effect)) return undefined;
  const format = magnitudeFormat(first.effect);
  return format ? { effect: first.effect, values: granted.map(({ magnitude }) => [formatMagnitude(magnitude, format)]) } : undefined;
}

/** The pet scaling of a companion talisman, by level, and the spawn ability's base cooldown. */
function companionOf(item: TalismanItemRow | undefined) {
  const ability = item?.GrantedAbilities?.find((granted) => granted.InstanceData?.some((data) => data.LevelOne));
  const data = ability?.InstanceData?.find((instance) => instance.LevelOne);
  if (!ability || !data) return undefined;
  const levels = COMPANION_LEVELS.map((key) => data[key]).map((level) =>
    level ? { attack: level.AttackMultiplier, defence: level.DefenceMultiplier, cooldown: level.CooldownMultiplier } : undefined,
  );
  const cooldown = ability.CommonKeyValues?.find((keyValue) => keyValue.TypeTag.TagName === COOLDOWN_KEY);
  return { levels, cooldownSeconds: cooldown?.Float ?? cooldown?.Int };
}

const secretTags = (tables: TalismanTables): string[] =>
  tables.collections
    .filter((row) => row.Name === SECRET_COLLECTION)
    .flatMap((row) => row.CollectionDefinition?.ItemsInCollection?.GameplayTags ?? [])
    .map((tag) => tag.TagName);

interface Built {
  readonly slug: string;
  readonly data: TalismanData[string];
  readonly issues: Issue[];
}

function buildOne(entry: Entry, property: TalismanPropertyRow, item: TalismanItemRow | undefined, tables: TalismanTables, effects: readonly EffectRow[], find: Find): Built {
  const levels = property.ItemLevels?.Levels ?? [];
  // A talisman with a real description of its own keeps it; its values come from code this site cannot read.
  const borrowed = entry.description ? undefined : effectValues(levels, tables, effects);
  const effectEntry = borrowed ? find("effect", locId(borrowed.effect.TypeTextData)) : undefined;
  const companion = companionOf(item);
  const built: TalismanLevel[] = levels.map((level, i) => {
    const values = effectEntry ? borrowed?.values[i] : undefined;
    const pet = companion?.levels[i];
    return {
      ...(values ? { values } : {}),
      ...(level.XPRequiredForNextLevel > 0 ? { xpToNextLevel: level.XPRequiredForNextLevel } : {}),
      ...(pet ? { companion: pet } : {}),
    };
  });
  const secret = secretTags(tables).some((tag) => sameTag(tag, property.TypeTag.TagName));
  const known = effectEntry !== undefined || companion !== undefined;
  const valuesUnknown = !known && entry.description !== undefined && hasPlaceholder(entry.description.en);
  const data = {
    ...(valuesUnknown ? { valuesUnknown: true } : {}),
    ...(effectEntry ? { effect: effectEntry.slug } : {}),
    ...(secret ? { secret: true } : {}),
    ...(companion?.cooldownSeconds !== undefined ? { cooldownSeconds: companion.cooldownSeconds } : {}),
    levels: built,
  };
  return { slug: entry.slug, data, issues: known ? [] : [issue("talisman-no-values", entry.id)] };
}

/** Level data for every talisman entry with a property row; talismans whose values the data cannot give are reported. */
export function buildTalismanData(entries: readonly Entry[], tables: TalismanTables, effects: readonly EffectRow[]): { data: TalismanData; issues: Issue[] } {
  const find = entryIndex(entries);
  const built = tables.properties.flatMap((property) => {
    const item = tables.items.find((row) => sameTag(row.TypeTag.TagName, property.TypeTag.TagName));
    const entry = item ? find("talisman", locId(item.TypeTextData)) : undefined;
    return entry ? [buildOne(entry, property, item, tables, effects, find)] : [];
  });
  return { data: Object.fromEntries(built.map(({ slug, data }) => [slug, data])), issues: built.flatMap((one) => one.issues) };
}

/** The English text with each value shown as unknown, for every language (the values cannot be filled in any). */
const unknownValues = (text: Localized): Localized => {
  const english = text.en.replace(PLACEHOLDER, UNKNOWN_VALUE);
  return localizedFrom(() => english);
};

const mergeUntranslated = (entry: Entry, langs: readonly Entry["untranslated"][]): Entry["untranslated"] => {
  const merged = [...new Set([...(entry.untranslated ?? []), ...langs.flatMap((list) => list ?? [])])];
  return merged.length > 0 ? merged : undefined;
};

/**
 * Entries with each stub-described talisman given its effect's description (and that effect's untranslated languages),
 * and each talisman whose values the data lacks shown in English with unknown markers, untranslated elsewhere.
 */
export function withTalismanDescriptions(entries: readonly Entry[], data: TalismanData): Entry[] {
  const effects = new Map(entries.filter((entry) => entry.category === "effect").map((entry) => [entry.slug, entry]));
  const nonEnglish = LANGS.filter((lang) => lang !== "en");
  return entries.map((entry) => {
    if (entry.category === "talisman" && entry.description && data[entry.slug]?.valuesUnknown) {
      const untranslated = mergeUntranslated(entry, [nonEnglish]);
      return { ...entry, description: unknownValues(entry.description), ...(untranslated ? { untranslated } : {}) };
    }
    const effectSlug = entry.category === "talisman" && !entry.description ? data[entry.slug]?.effect : undefined;
    const effect = effectSlug ? effects.get(effectSlug) : undefined;
    if (!effect?.description) return entry;
    const untranslated = mergeUntranslated(entry, [effect.untranslated]);
    return { ...entry, description: effect.description, ...(untranslated ? { untranslated } : {}) };
  });
}

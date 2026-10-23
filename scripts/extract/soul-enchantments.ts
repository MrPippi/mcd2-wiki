/**
 * Soul enchantments (DT_SoulEnchantmentDefinition): the buffs a Soul Corrupted mob spawns with. A family has a base row
 * (Poison) with the icon, the name and the abilities, and tier rows (Poison.I/II/III) with their own gameplay effect
 * modifiers and specialisations (Override or Add) of the family's ability key values, the same layout as the gear
 * enchantments. Each tier is shown with its own modifiers only; whether the family row's and the generic Lvl.I–III rows'
 * modifiers also apply is not in the data (guides-status.json soulEnchantmentLevels, flagged on the page).
 * Which mobs carry which family is decided in game code (GA_TriggerSoulEnchantmentOnSpawn); the data only names the
 * families a mob (through its trait closure) or an arena wave excludes.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Lang } from "../../shared/config";
import type { QuestData } from "../../shared/quest-schema";
import type { LocaleFile } from "../../shared/schemas";
import {
  EMPTY_SOUL_ENCHANTMENTS,
  SOUL_TIERS,
  SoulEnchantmentDataSchema,
  type SoulAbilityValue,
  type SoulAttribute,
  type SoulEnchantmentData,
  type SoulFamily,
  type SoulModifier,
  type SoulTierData,
} from "../../shared/soul-enchantment-schema";
import { gameText } from "./game-text";
import { referencePaths } from "./icon-references";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { toSlug } from "./keys";
import { locRef } from "./loc-table";
import { tagKey, traitClosure } from "./mob-tags";
import {
  loadSoulEnchantmentTables,
  type ExcluderRow,
  type SoulAbilityRow,
  type SoulEnchantmentRow,
  type SoulEnchantmentTables,
  type SoulKeyValue,
} from "./soul-enchantment-tables";

const FAMILY_PREFIX = "SW.Enchantment.SoulEnchantment.";
/** Rows under the family prefix that are not families. */
const NOT_FAMILIES: ReadonlySet<string> = new Set(["default", "level"]);
const NAME_SLOT = "SW.TextEntry.Name";
const CM_PER_BLOCK = 100;
const PERCENT = 100;

/** Game attribute names → site keys. A modifier on any other attribute is reported and left out. */
export const ATTRIBUTE_KEYS: Readonly<Record<string, SoulAttribute>> = {
  HealthMax: "healthMax",
  Poise: "poise",
  MovementSpeedMultiplier: "movementSpeed",
  MeleeAttackSpeed: "meleeAttackSpeed",
  RangedAttackSpeed: "rangedAttackSpeed",
  PoisonDamageMultiplier: "damagePoison",
  IceDamageMultiplier: "damageIce",
  LightningDamageMultiplier: "damageLightning",
  FireDamageMultiplier: "damageFire",
  MeleeDamageMultiplier: "damageMelee",
  RangedDamageMultiplier: "damageRanged",
  PoisonDamageResistanceMultiplier: "resistPoison",
  IceDamageResistanceMultiplier: "resistIce",
  LightningDamageResistanceMultiplier: "resistLightning",
  FireDamageResistanceMultiplier: "resistFire",
  MeleeDamageResistanceMultiplier: "resistMelee",
  RangedDamageResistanceMultiplier: "resistRanged",
  BlastDamageResistanceMultiplier: "resistBlast",
  TNTDamageResistanceMultiplier: "resistTnt",
  ElementalDamageResistanceMultiplier: "resistElemental",
  SoulDamageResistanceMultiplier: "resistSoul",
  KnockbackResistanceMultiplier: "knockbackResistance",
  ProjectileDeflectChance: "projectileDeflectChance",
  ReceiveNegativeStatusDurationMultiplier: "negativeStatusDuration",
};

// MultiplyAdditive and MultiplyCompound only differ in how several multipliers on one attribute stack; one modifier is ×value either way.
const OPS: Readonly<Record<string, SoulModifier["op"]>> = { MultiplyAdditive: "multiply", MultiplyCompound: "multiply", AddBase: "add" };

/** How a key value is turned into the number the page shows. */
const toBlocks = (value: number): number => value / CM_PER_BLOCK;
const fromIntPercent = (value: number): number => value / PERCENT;
const asIs = (value: number): number => value;

interface ShownValue {
  readonly key: SoulAbilityValue;
  readonly tag: string;
  readonly convert: (value: number) => number;
}

/** The key values each family ability shows, in display order; other key values are internal (cues, offsets, flags). */
export const SHOWN_VALUES: Readonly<Record<string, readonly ShownValue[]>> = {
  GA_ElementalBlast: [
    { key: "blastBaseDamage", tag: "BaseDamage", convert: asIs },
    { key: "blastDamageMultiplier", tag: "DamageMultiplier", convert: asIs },
    { key: "blastRange", tag: "MaxRange", convert: toBlocks },
    { key: "blastCone", tag: "ConeAngleInDegrees", convert: asIs },
  ],
  GA_ApplyStatusOnGameplayEvent: [{ key: "swiftnessChance", tag: "ActivationChance", convert: fromIntPercent }],
  GA_SoulOrbs: [
    { key: "orbCount", tag: "NumberOfProjectiles", convert: asIs },
    { key: "orbDamage", tag: "Damage", convert: asIs },
    { key: "orbCharge", tag: "ChargeDuration", convert: asIs },
    { key: "orbRange", tag: "Range", convert: toBlocks },
  ],
  GA_SoulLeech: [
    { key: "leechInterval", tag: "UpdateInterval", convert: asIs },
    { key: "leechRange", tag: "Range", convert: toBlocks },
  ],
  GA_RippleAttack: [
    { key: "rippleDamage", tag: "Damage", convert: asIs },
    { key: "rippleRadius", tag: "MaxRadius", convert: toBlocks },
    { key: "rippleDelay", tag: "DelayBetweenRipples", convert: asIs },
  ],
  GA_SoulSuppression: [{ key: "bubbleRadius", tag: "BubbleRadius", convert: asIs }],
};

/** `/Script/SpicewoodGAS.GA_SoulOrbs` → `GA_SoulOrbs`. */
export const abilityName = (path: string): string => path.slice(path.lastIndexOf(".") + 1);
const keyName = (tag: string): string => tag.replace(/^SW\.KeyValue\./, "");
const numberOf = (keyValue: SoulKeyValue): number | undefined => keyValue.Float ?? keyValue.Int;

/** The family a row's TypeTag names (Poison for SW.Enchantment.SoulEnchantment.Poison.II), or undefined for other rows. */
function familyTag(row: SoulEnchantmentRow): string | undefined {
  const tag = row.TypeTag.TagName;
  if (!tag.startsWith(FAMILY_PREFIX)) return undefined;
  const [family] = tag.slice(FAMILY_PREFIX.length).split(".");
  return family && !NOT_FAMILIES.has(family.toLowerCase()) ? family : undefined;
}

/** A tier row's modifiers that change something (a +0 is left out); unknown attributes or operations are reported. */
export function modifiersOf(row: SoulEnchantmentRow): { modifiers: SoulModifier[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const modifiers = (row.GameplayEffect?.Modifiers ?? []).flatMap((modifier): SoulModifier[] => {
    const name = modifier.Attribute.AttributeName;
    const value = modifier.ModifierMagnitude.ScalableFloatMagnitude?.Value;
    const op = OPS[modifier.ModifierOp];
    const attribute = ATTRIBUTE_KEYS[name];
    if (op === "add" && value === 0) return [];
    if (modifier.ModifierMagnitude.MagnitudeCalculationType !== "ScalableFloat" || value === undefined || op === undefined || attribute === undefined) {
      issues.push(issue("soul-enchantment-ignored", `${row.Name}: ${name} ${modifier.ModifierOp} ${modifier.ModifierMagnitude.MagnitudeCalculationType}`));
      return [];
    }
    return [{ attribute, op, value }];
  });
  return { modifiers, issues };
}

/** The family's ability key values with a tier row's Override / Add specialisations applied, by ability name then key. */
export function tierKeyValues(abilities: readonly SoulAbilityRow[], tier: SoulEnchantmentRow): Map<string, Map<string, number>> {
  const values = new Map(
    abilities.map((ability) => [
      abilityName(ability.Ability),
      new Map([...(ability.CommonKeyValues ?? []), ...(ability.SpecificKeyValues ?? [])].flatMap((keyValue) => {
        const value = numberOf(keyValue);
        return value === undefined ? [] : [[keyName(keyValue.TypeTag.TagName), value] as const];
      })),
    ]),
  );
  for (const specialization of tier.AbilitySpecialization?.Specializations ?? []) {
    const name = abilityName(specialization.Ability);
    const own = new Map(values.get(name) ?? []);
    for (const { KeyValue, ModOp } of specialization.KeyValueSpecializations ?? []) {
      const value = numberOf(KeyValue);
      if (value === undefined) continue;
      const key = keyName(KeyValue.TypeTag.TagName);
      if (ModOp === "Override") own.set(key, value);
      if (ModOp === "Add") own.set(key, (own.get(key) ?? 0) + value);
    }
    values.set(name, own);
  }
  return values;
}

/** The shown ability values of one tier, in display order; a shown key the data lacks is reported. */
function abilityValues(family: SoulEnchantmentRow, tier: SoulEnchantmentRow): { ability: SoulTierData["ability"]; issues: Issue[] } {
  const abilities = family.Abilities ?? [];
  const values = tierKeyValues(abilities, tier);
  const issues: Issue[] = [];
  const ability = abilities.flatMap((row) => {
    const name = abilityName(row.Ability);
    const shown = SHOWN_VALUES[name];
    if (shown === undefined) {
      issues.push(issue("soul-enchantment-ignored", `${tier.Name}: ability ${name}`));
      return [];
    }
    return shown.flatMap(({ key, tag, convert }) => {
      const value = values.get(name)?.get(tag);
      if (value === undefined) {
        issues.push(issue("soul-enchantment-ignored", `${tier.Name}: ${name} has no ${tag}`));
        return [];
      }
      return [{ key, value: convert(value) }];
    });
  });
  return { ability, issues };
}

type Locales = Readonly<Record<Lang, LocaleFile>>;

function nameOf(row: SoulEnchantmentRow, locales: Locales): ReturnType<typeof gameText> {
  const entry = Object.entries(row.TypeTextData?.Texts ?? {}).find(([slot]) => slot.includes(NAME_SLOT));
  const ref = entry ? locRef(entry[1].Text) : undefined;
  return ref ? gameText(locales, ref.namespace, ref.key) : undefined;
}

/** Families each excluder row bans: its own list plus the lists of the rows its traits lead to (SoulStatedHusk → Husk). */
export function exclusionsByRow(rows: readonly ExcluderRow[]): Map<ExcluderRow, Set<string>> {
  const byKey = new Map(rows.map((row) => [tagKey(row.TypeTag.TagName), row] as const));
  const own = (row: ExcluderRow): string[] => (row.MobConditions?.ExcludedSoulEnchantments?.GameplayTags ?? []).map((tag) => tag.TagName);
  return new Map(
    rows.map((row) => {
      const inherited = traitClosure(row, byKey).flatMap((tag) => {
        const owner = byKey.get(tagKey(tag));
        return owner ? own(owner) : [];
      });
      return [row, new Set([...own(row), ...inherited].map(tagKey))] as const;
    }),
  );
}

export interface BuildInput {
  readonly tables: SoulEnchantmentTables;
  readonly locales: Locales;
  /** Bestiary tag index (tag key → mob slug), which knows the Soul Corrupted tags. */
  readonly mobSlugs: ReadonlyMap<string, string>;
  readonly quests: QuestData;
  /** The published icon path of a family, or undefined when its icon file is missing. */
  readonly iconOf: (row: SoulEnchantmentRow, slug: string) => string | undefined;
  readonly verified: boolean;
}

type ExcludedMob = SoulFamily["excludedMobs"][number];

interface Exclusions {
  readonly mobs: ReadonlyMap<string, readonly ExcludedMob[]>;
  readonly quests: ReadonlyMap<string, readonly string[]>;
  readonly issues: Issue[];
}

const pushTo = (map: Map<string, string[]>, key: string, value: string): void => {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) map.set(key, [...list, value]);
};

/**
 * Per family tag key, the bestiary mobs with a Soul Corrupted row that excludes it. A mob page can stand for several
 * Soul Corrupted rows (Zombie and its same-named variants); `partial` marks a mob where only some of them exclude it.
 */
function excludedMobs(input: BuildInput, issues: Issue[]): Map<string, ExcludedMob[]> {
  const all = [...input.tables.soulStated, ...input.tables.variants];
  const soulRows = new Set(input.tables.soulStated);
  const slugOf = (row: ExcluderRow): string | undefined => input.mobSlugs.get(tagKey(row.TypeTag.TagName));
  const rowsPerSlug = new Map<string, number>();
  for (const row of input.tables.soulStated) {
    const slug = slugOf(row);
    if (slug !== undefined) rowsPerSlug.set(slug, (rowsPerSlug.get(slug) ?? 0) + 1);
  }
  const counts = new Map<string, Map<string, number>>();
  for (const [row, families] of exclusionsByRow(all)) {
    if (!soulRows.has(row) || families.size === 0) continue;
    const slug = slugOf(row);
    if (slug === undefined) {
      issues.push(issue("soul-enchantment-unlinked", `${row.Name}: no bestiary page`));
      continue;
    }
    for (const family of families) {
      const perSlug = new Map(counts.get(family) ?? []);
      counts.set(family, perSlug.set(slug, (perSlug.get(slug) ?? 0) + 1));
    }
  }
  return new Map(
    [...counts].map(([family, perSlug]) => [family, [...perSlug].map(([slug, excluded]) => ({ slug, partial: excluded < (rowsPerSlug.get(slug) ?? 0) }))] as const),
  );
}

/** Mobs and quests that exclude each family tag key; a row without a bestiary page or a wave without a quest is reported. */
function buildExclusions(input: BuildInput): Exclusions {
  const issues: Issue[] = [];
  const mobs = excludedMobs(input, issues);
  const quests = new Map<string, string[]>();
  for (const wave of input.tables.waves) {
    const families = wave.SpawnWaveDefinition?.ExcludedSoulEnchantmentsOverride?.GameplayTags ?? [];
    if (families.length === 0) continue;
    const quest = input.quests.quests.find((one) => wave.TypeTag.TagName.toLowerCase().split(".").includes(one.id.toLowerCase()));
    if (!quest) {
      issues.push(issue("soul-enchantment-unlinked", `${wave.Name}: no quest for ${wave.TypeTag.TagName}`));
      continue;
    }
    for (const family of families) pushTo(quests, tagKey(family.TagName), quest.slug);
  }
  return { mobs, quests, issues };
}

function buildFamily(row: SoulEnchantmentRow, family: string, input: BuildInput, exclusions: Exclusions): { family?: SoulFamily; issues: Issue[] } {
  const name = nameOf(row, input.locales);
  if (!name) return { issues: [issue("soul-enchantment-unnamed", row.Name)] };
  const byName = new Map(input.tables.enchantments.map((one) => [one.Name, one] as const));
  const issues: Issue[] = [];
  const tiers = SOUL_TIERS.flatMap((tier): SoulTierData[] => {
    const tierRow = byName.get(`${row.Name}.${tier}`);
    if (!tierRow) {
      issues.push(issue("soul-enchantment-ignored", `${row.Name}: no ${tier} row`));
      return [];
    }
    const modifiers = modifiersOf(tierRow);
    const ability = abilityValues(row, tierRow);
    issues.push(...modifiers.issues, ...ability.issues);
    const threat = { min: tierRow.ThreatLevelSettings.MinimumThreatLevel, max: tierRow.ThreatLevelSettings.MaximumThreatLevel };
    return [{ tier, threat, modifiers: modifiers.modifiers, ability: ability.ability }];
  });
  const slug = toSlug(row.Name);
  const icon = input.iconOf(row, slug);
  if (icon === undefined) issues.push(issue("soul-enchantment-no-icon", `${row.Name}: ${row.IconReference ?? "None"}`));
  const key = tagKey(`${FAMILY_PREFIX}${family}`);
  return {
    family: {
      id: row.Name,
      slug,
      name: name.text,
      untranslated: name.untranslated,
      ...(icon === undefined ? {} : { icon }),
      tiers,
      excludedMobs: [...(exclusions.mobs.get(key) ?? [])],
      excludedQuests: [...(exclusions.quests.get(key) ?? [])],
    },
    issues,
  };
}

const LEVEL_TAG = /^SW\.Enchantment\.SoulEnchantment\.Level\.(I|II|III)$/;

export function buildSoulEnchantments(input: BuildInput): { data: SoulEnchantmentData; issues: Issue[] } {
  const exclusions = buildExclusions(input);
  const families = input.tables.enchantments.flatMap((row) => {
    const family = familyTag(row);
    return family !== undefined && row.TypeTag.TagName === `${FAMILY_PREFIX}${family}` ? [buildFamily(row, family, input, exclusions)] : [];
  });
  const levels = input.tables.enchantments.flatMap((row) => {
    const tier = LEVEL_TAG.exec(row.TypeTag.TagName)?.[1] as SoulTierData["tier"] | undefined;
    return tier === undefined ? [] : [{ tier, ...modifiersOf(row) }];
  });
  const data = {
    verified: input.verified,
    families: families.flatMap((one) => (one.family ? [one.family] : [])),
    levels: levels.map(({ tier, modifiers }) => ({ tier, modifiers })),
  };
  const parsed = SoulEnchantmentDataSchema.safeParse(data);
  if (!parsed.success) throw new ExtractError(`靈魂附魔資料 soul-enchantments.json 不符合格式：${formatZodIssue(parsed.error.issues[0])}`);
  return { data: parsed.data, issues: [...exclusions.issues, ...families.flatMap((one) => one.issues), ...levels.flatMap((one) => one.issues)] };
}

export interface SoulEnchantmentsInput {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly locales: Locales;
  readonly mobSlugs: ReadonlyMap<string, string>;
  readonly quests: QuestData;
  readonly verified: boolean;
}

export interface SoulEnchantmentsResult {
  readonly data: SoulEnchantmentData;
  readonly issues: Issue[];
  readonly tablesRead: string[];
}

const iconPath = (slug: string): string => `icons/soul-enchantments/${slug}.png`;

/** Reads the tables, builds the page data and copies the family icons; run after public/icons is rebuilt (that step clears it). */
export async function extractSoulEnchantments(input: SoulEnchantmentsInput): Promise<SoulEnchantmentsResult> {
  const tablesRead: string[] = [];
  const loaded = await loadSoulEnchantmentTables(input.sourceRoot, (file) => {
    tablesRead.push(file);
  });
  if (!loaded.tables) {
    return { data: { ...EMPTY_SOUL_ENCHANTMENTS, verified: input.verified }, issues: [issue("missing-soul-enchantment-tables", loaded.missing.join(", "))], tablesRead };
  }
  const copies: { from: string; to: string }[] = [];
  const iconOf = (row: SoulEnchantmentRow, slug: string): string | undefined => {
    const from = row.IconReference && row.IconReference !== "None"
      ? referencePaths(row.IconReference).map((file) => path.join(input.sourceRoot, ...file.split("/"))).find((file) => existsSync(file))
      : undefined;
    if (from === undefined) return undefined;
    copies.push({ from, to: path.join(input.outRoot, "public", ...iconPath(slug).split("/")) });
    return iconPath(slug);
  };
  const built = buildSoulEnchantments({ ...input, tables: loaded.tables, iconOf });
  for (const copy of copies) {
    await mkdir(path.dirname(copy.to), { recursive: true });
    await copyFile(copy.from, copy.to);
  }
  return { data: built.data, issues: built.issues, tablesRead };
}

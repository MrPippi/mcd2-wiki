/**
 * Builds weapon stats and effect rules from the game's DataTables:
 * - stats from DT_Melee/RangedPropertyDefinition (ranged damage through DT_ProjectileDefinition);
 * - the effect pool the way the game rolls it: drop table rows matching the item's tags pick effect template
 *   groups, and each template's base templates exclude item kinds it cannot go on (IncompatibleTagsQuery);
 * - a unique weapon's built-in bonus from its Effects tags.
 */
import { issue, type Issue } from "./issues";
import type { Entry } from "./schemas";
import { matchesTagQuery } from "./tag-query";
import { ARCHETYPES, WEIGHTS, type EffectFormat, type Weapon, type WeaponData } from "./weapon-schema";
import type { TextDataValue, WeaponTables } from "./weapon-tables";

/** Game distances are in centimetres; a block is 100. */
const UNITS_PER_BLOCK = 100;
const TIERS = ["I", "II", "III"] as const;
/** Every piece of gear carries this tag in game, though the DataTables leave it out of the item traits. */
const GEAR_TAG = "SW.Item.Property.Gear";
const MAGNITUDE_GETTER = "SW.TextEntry.DataGetter.GetEffectMagnitude";
const LOC_ID = /"SW_(?:Item|Effect|Enchantment)_(.+?)_SW_TextEntry_(?:Name|Description)"/;

const blocks = (units: number): number => Math.round((units / UNITS_PER_BLOCK) * 100) / 100;
const tagNames = (tags: { GameplayTags?: { TagName: string }[] } | undefined): string[] =>
  (tags?.GameplayTags ?? []).map((tag) => tag.TagName);

/** The localization id a row's texts use (SW_Item_<id>_SW_TextEntry_Name), which is also the entry id. */
const locId = (texts: TextDataValue): string | undefined =>
  Object.values(texts?.Texts ?? {})
    .map((entry) => LOC_ID.exec(entry.Text)?.[1])
    .find((id) => id !== undefined);

function entryIndex(entries: readonly Entry[]) {
  const byKey = new Map(entries.map((entry) => [`${entry.category}:${entry.id.toLowerCase()}`, entry]));
  return (category: Entry["category"], id: string | undefined): Entry | undefined =>
    id === undefined ? undefined : byKey.get(`${category}:${id.toLowerCase()}`);
}

function meleeStats(row: WeaponTables["melee"][number] | undefined): Weapon["melee"] {
  if (!row) return undefined;
  const jump = row.JumpAttackDefinition;
  return {
    swings: row.AttackVariants.Variants.map((variant) => ({
      damage: variant.Damage,
      hits: variant.VariantLoopAmount,
      stagger: variant.Stagger,
      reach: blocks(variant.AttackRange),
      knockback: variant.Knockback?.Strength ?? 0,
    })),
    ...(jump
      ? { jump: { damage: jump.Damage, stagger: jump.Stagger, reach: blocks(jump.AreaOfEffectSplashRange), knockback: jump.Knockback?.Strength ?? 0 } }
      : {}),
  };
}

function rangedStats(row: WeaponTables["ranged"][number] | undefined, projectiles: WeaponTables["projectiles"]): Weapon["ranged"] {
  if (!row) return undefined;
  const attack = row.AttackDefintion;
  const shots = attack.VolleyDefinitions.flatMap((volley) => volley.ProjectileDefinitions);
  const projectile = projectiles.find((candidate) => candidate.TypeTag.TagName === shots[0]?.ProjectileTypeTag.TagName);
  if (!projectile) return undefined;
  const data = projectile.ProjectileGameplayData;
  return {
    damage: data.damage * attack.ProjectileDamageFactor,
    projectiles: shots.reduce((sum, shot) => sum + shot.NumberOfProjectiles, 0),
    chargedMultiplier: attack.ChargeDamageMultiplier,
    attackRateSeconds: attack.AttackRateSeconds,
    ammo: attack.MaxAmmo,
    range: blocks(attack.Range),
    chargeSeconds: attack.ChargeTimeSecond,
    rechargeSeconds: attack.RechargeTimeSeconds,
    jumpShotMultiplier: attack.JumpshotDamageMultiplier,
    stagger: data.Stagger,
    knockback: data.knockback?.Strength ?? 0,
  };
}

function effectPool(itemTags: ReadonlySet<string>, tables: WeaponTables): Map<string, number[]> {
  const groupTags = tables.dropTable
    .filter((row) => itemTags.has(row.TypeTag.TagName))
    .flatMap((row) => [...(row.PrimaryETG?.Tags ?? []), ...(row.SecondaryETG?.Tags ?? [])])
    .map((tag) => tag.TypeTag.TagName);
  const templateTags = new Set(
    tables.groups.filter((group) => groupTags.includes(group.TypeTag.TagName)).flatMap((group) => (group.TagList?.Tags ?? []).map((tag) => tag.TypeTag.TagName)),
  );
  const baseQueries = new Map(
    tables.templates.flatMap((template) =>
      template.TemplateData.IncompatibleTagsQuery ? [[template.TypeTag.TagName, template.TemplateData.IncompatibleTagsQuery] as const] : [],
    ),
  );
  const allowed = tables.templates.filter((template) => {
    const tier = TIERS.findIndex((name) => template.TypeTag.TagName.endsWith(`.${name}`));
    if (tier === -1 || !templateTags.has(template.TypeTag.TagName)) return false;
    const bases = tagNames(template.Traits).flatMap((tag) => baseQueries.get(tag) ?? []);
    return !bases.some((query) => matchesTagQuery(query, itemTags));
  });
  const pool = new Map<string, number[]>();
  for (const template of allowed) {
    const effect = template.TemplateData.Effect?.TagName;
    const tier = TIERS.findIndex((name) => template.TypeTag.TagName.endsWith(`.${name}`));
    if (!effect || template.TemplateData.FixedEffectValue === undefined) continue;
    const tiers = pool.get(effect) ?? [];
    tiers[tier] = template.TemplateData.FixedEffectValue;
    pool.set(effect, tiers);
  }
  return pool;
}

const formatOf = (texts: TextDataValue): EffectFormat | undefined => {
  const description = Object.entries(texts?.Texts ?? {}).find(([key]) => key.includes("Description"))?.[1];
  const formatting = description?.ValuesToGet?.[0]?.FormattingData;
  if (description?.DynamicDataGetterFunction?.TagName !== MAGNITUDE_GETTER || !formatting) return undefined;
  return {
    percent: formatting.IsPercentage,
    multiplier: formatting.Multiplier,
    offset: formatting.Offset,
    maxFractionDigits: formatting.MaxFractionalDigits,
  };
};

export function buildWeaponData(entries: readonly Entry[], tables: WeaponTables): { data: WeaponData; issues: Issue[] } {
  const find = entryIndex(entries);
  const effectEntry = new Map(tables.effects.flatMap((row) => {
    const entry = find("effect", locId(row.TypeTextData));
    return entry ? [[row.TypeTag.TagName, entry] as const] : [];
  }));
  const enchantmentRows = new Map(tables.enchantments.map((row) => [row.TypeTag.TagName, row]));
  const issues: Issue[] = [];

  const fixedBonus = (tags: string[], weapon: Entry): Weapon["fixed"] => {
    const tag = tags[0];
    if (!tag) return undefined;
    const template = tables.templates.find((candidate) => candidate.TypeTag.TagName === tag);
    if (template) {
      const entry = effectEntry.get(template.TemplateData.Effect?.TagName ?? "");
      if (entry) return { kind: "effect", slug: entry.slug, value: template.TemplateData.FixedEffectValue };
    }
    const row = enchantmentRows.get(tag);
    // Unique-tier rows (FlameBelch.Unique) have no texts: their row name, dotted, gives the id instead.
    const id = locId(row?.TypeTextData) ?? row?.Name.replace(/\./g, "_");
    const baseId = id?.replace(/_Unique$/, "");
    const enchantment = find("enchantment", id) ?? find("enchantment-book", id && `EnchantmentBook_${id}`) ?? find("enchantment", baseId);
    if (enchantment) return { kind: enchantment.category === "enchantment" ? "enchantment" : "enchantment-book", slug: enchantment.slug };
    issues.push(issue("weapon-unmatched", `${weapon.id}: ${tag}`));
    return undefined;
  };

  const weapons = tables.items.flatMap((item) => {
    const id = locId(item.TypeTextData) ?? item.Name;
    const weapon = find("melee", id) ?? find("ranged", id);
    if (!weapon) return [];
    const traits = tagNames(item.Traits);
    const itemTags = new Set([...traits, GEAR_TAG]);
    const pool = effectPool(itemTags, tables);
    const compatible = [...pool]
      .flatMap(([tag, tiers]) => {
        const entry = effectEntry.get(tag);
        if (!entry) issues.push(issue("weapon-unmatched", `${weapon.id}: ${tag}`));
        return entry && tiers.length === TIERS.length ? [{ entry, tiers: [tiers[0], tiers[1], tiers[2]] as [number, number, number] }] : [];
      })
      .sort((a, b) => a.entry.name.en.localeCompare(b.entry.name.en, "en"))
      .map(({ entry, tiers }) => ({ effect: entry.slug, tiers }));
    const sameName = (name: string) => name.toLowerCase() === item.Name.toLowerCase();
    const weight = WEIGHTS.find((candidate) => traits.includes(`SW.Item.Property.${candidate}Weapon`));
    const melee = meleeStats(tables.melee.find((row) => sameName(row.Name)));
    const ranged = rangedStats(tables.ranged.find((row) => sameName(row.Name)), tables.projectiles);
    const fixed = fixedBonus(tagNames(item.Effects), weapon);
    const data: Weapon = {
      archetypes: ARCHETYPES.filter((archetype) => traits.includes(`SW.Archetype.${archetype}`)),
      ...(weight ? { weight } : {}),
      ...(melee ? { melee } : {}),
      ...(ranged ? { ranged } : {}),
      compatible,
      ...(fixed ? { fixed } : {}),
    };
    return [[weapon.slug, data] as const];
  });

  const effectFormats = Object.fromEntries(
    tables.effects.flatMap((row) => {
      const entry = effectEntry.get(row.TypeTag.TagName);
      const format = formatOf(row.TypeTextData);
      return entry && format ? [[entry.slug, format] as const] : [];
    }),
  );
  return { data: { weapons: Object.fromEntries(weapons), effectFormats }, issues };
}

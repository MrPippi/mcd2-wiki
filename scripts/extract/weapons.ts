/**
 * Builds weapon stats and effect rules from the game's DataTables:
 * - stats from DT_Melee/RangedPropertyDefinition (ranged damage through DT_ProjectileDefinition);
 * - the effect pool the way the game rolls it: drop table rows matching the item's tags pick effect template
 *   groups, and each template's base templates exclude item kinds it cannot go on (IncompatibleTagsQuery);
 * - a unique weapon's built-in bonus from its Effects tags.
 */
import { enchantmentValues } from "./enchantments";
import { blocks, compatibleEffects, descriptionOf, effectEntries, entryIndex, GEAR_TAG, locId, tagNames, toFormat } from "./game-rows";
import type { GameTables } from "./game-tables";
import { issue, type Issue } from "./issues";
import type { Entry } from "./schemas";
import { ARCHETYPES, WEIGHTS, type EffectFormat, type Weapon, type WeaponData } from "./weapon-schema";

const MAGNITUDE_GETTER = "SW.TextEntry.DataGetter.GetEffectMagnitude";

function meleeStats(row: GameTables["melee"][number] | undefined): Weapon["melee"] {
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

function rangedStats(row: GameTables["ranged"][number] | undefined, projectiles: GameTables["projectiles"]): Weapon["ranged"] {
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

const formatOf = (texts: GameTables["effects"][number]["TypeTextData"]): EffectFormat | undefined => {
  const description = descriptionOf(texts);
  const formatting = description?.ValuesToGet?.[0]?.FormattingData;
  if (description?.DynamicDataGetterFunction?.TagName !== MAGNITUDE_GETTER || !formatting) return undefined;
  return toFormat(formatting);
};

export function buildWeaponData(entries: readonly Entry[], tables: GameTables): { data: WeaponData; issues: Issue[] } {
  const find = entryIndex(entries);
  const effectEntry = effectEntries(tables, find);
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
    const values = row ? enchantmentValues(row, tables.enchantments) : undefined;
    if (enchantment) {
      const kind = enchantment.category === "enchantment" ? "enchantment" : "enchantment-book";
      return { kind, slug: enchantment.slug, ...(values ? { values } : {}) };
    }
    issues.push(issue("weapon-unmatched", `${weapon.id}: ${tag}`));
    return undefined;
  };

  const weapons = tables.items.flatMap((item) => {
    const id = locId(item.TypeTextData) ?? item.Name;
    const weapon = find("melee", id) ?? find("ranged", id);
    if (!weapon) return [];
    const traits = tagNames(item.Traits);
    const itemTags = new Set([...traits, GEAR_TAG]);
    const { compatible, unmatched } = compatibleEffects(itemTags, tables, effectEntry);
    issues.push(...unmatched.map((tag) => issue("weapon-unmatched", `${weapon.id}: ${tag}`)));
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

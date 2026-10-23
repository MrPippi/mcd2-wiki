/** Soul enchantments for the site: data from `npm run extract` and the pure helpers that turn a family's tiers into stat rows. Server-side only. */
import {
  SOUL_CHANCE_ATTRIBUTES,
  SOUL_TIERS,
  SoulEnchantmentDataSchema,
  type SoulAbilityValue,
  type SoulAttribute,
  type SoulEnchantmentData,
  type SoulFamily,
  type SoulModifier,
  type SoulTier,
} from "../../shared/soul-enchantment-schema";
import rawData from "../data/soul-enchantments.json";
import type { Lang } from "../../shared/lang";
import { formatChance } from "./mobs";
import { t, type UiKey } from "./ui-strings";
import { blocksText, roundText, secondsText } from "./units";

/** Soul enchantments from `npm run extract`, validated at build time. */
export const soulEnchantmentData: SoulEnchantmentData = SoulEnchantmentDataSchema.parse(rawData);

const ATTRIBUTE_LABEL: Readonly<Record<SoulAttribute, UiKey>> = {
  healthMax: "soulAttrHealthMax",
  poise: "statPoise",
  movementSpeed: "statMovementSpeed",
  meleeAttackSpeed: "statMeleeAttackSpeed",
  rangedAttackSpeed: "statRangedAttackSpeed",
  damagePoison: "soulAttrDamagePoison",
  damageIce: "soulAttrDamageIce",
  damageLightning: "soulAttrDamageLightning",
  damageFire: "soulAttrDamageFire",
  damageMelee: "soulAttrDamageMelee",
  damageRanged: "soulAttrDamageRanged",
  resistPoison: "statResistPoison",
  resistIce: "statResistIce",
  resistLightning: "statResistLightning",
  resistFire: "statResistFire",
  resistMelee: "statResistMelee",
  resistRanged: "statResistRanged",
  resistBlast: "statResistBlast",
  resistTnt: "statResistTnt",
  resistElemental: "statResistElemental",
  resistSoul: "statResistSoul",
  knockbackResistance: "statKnockbackResistance",
  projectileDeflectChance: "soulAttrDeflectChance",
  negativeStatusDuration: "soulAttrNegativeStatusDuration",
};

type ValueFormat = "number" | "multiplier" | "blocks" | "seconds" | "degrees" | "chance";

const ABILITY_VIEW: Readonly<Record<SoulAbilityValue, { label: UiKey; format: ValueFormat }>> = {
  blastBaseDamage: { label: "soulBlastBaseDamage", format: "number" },
  blastDamageMultiplier: { label: "soulBlastDamageMultiplier", format: "multiplier" },
  blastRange: { label: "soulBlastRange", format: "blocks" },
  blastCone: { label: "soulBlastCone", format: "degrees" },
  swiftnessChance: { label: "soulSwiftnessChance", format: "chance" },
  orbCount: { label: "soulOrbCount", format: "number" },
  orbDamage: { label: "soulOrbDamage", format: "number" },
  orbCharge: { label: "soulOrbCharge", format: "seconds" },
  orbRange: { label: "soulOrbRange", format: "blocks" },
  leechInterval: { label: "soulLeechInterval", format: "seconds" },
  leechRange: { label: "soulLeechRange", format: "blocks" },
  rippleDamage: { label: "soulRippleDamage", format: "number" },
  rippleRadius: { label: "soulRippleRadius", format: "blocks" },
  rippleDelay: { label: "soulRippleDelay", format: "seconds" },
  bubbleRadius: { label: "soulBubbleRadius", format: "number" },
};

const MINUS = "−";
const signed = (text: string, value: number): string => (value < 0 ? `${MINUS}${text}` : `+${text}`);

function formatValue(format: ValueFormat, value: number, lang: Lang): string {
  if (format === "multiplier") return `×${roundText(value)}`;
  if (format === "blocks") return blocksText(lang, value);
  if (format === "seconds") return secondsText(lang, value);
  if (format === "degrees") return `${roundText(value)}°`;
  if (format === "chance") return formatChance(value, lang);
  return roundText(value);
}

/** One modifier as the page prints it: ×1.5, +0.33, −0.5, or +33% for a chance. */
export function formatModifier(modifier: SoulModifier, lang: Lang): string {
  if (modifier.op === "multiply") return `×${roundText(modifier.value)}`;
  const magnitude = Math.abs(modifier.value);
  const text = SOUL_CHANCE_ATTRIBUTES.includes(modifier.attribute) ? formatChance(magnitude, lang) : roundText(magnitude);
  return signed(text, modifier.value);
}

export interface StatRow {
  /** Stable id for tests: `attr:<attribute>:<op>`, `ability:<key>` or `threat`. */
  readonly id: string;
  readonly label: string;
  /** The value at tier I, II and III; undefined where that tier's row does not have it. */
  readonly values: readonly (string | undefined)[];
}

const tierOf = (family: SoulFamily, tier: SoulTier) => family.tiers.find((one) => one.tier === tier);

/** Ids in first-seen order across the tiers. */
const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

const FULL_THREAT = { min: 0, max: 20 };

/**
 * A family's stats as rows (one per modifier or ability value, in first-seen order) with a column per tier. The threat
 * row is added only when some tier's row narrows the full 0–20 range.
 */
export function familyRows(family: SoulFamily, lang: Lang): StatRow[] {
  const tiers = SOUL_TIERS.map((tier) => tierOf(family, tier));
  const modifierId = (modifier: SoulModifier): string => `attr:${modifier.attribute}:${modifier.op}`;
  const modifierIds = unique(tiers.flatMap((tier) => (tier?.modifiers ?? []).map(modifierId)));
  const modifierRows = modifierIds.map((id): StatRow => {
    const [, attribute] = id.split(":") as [string, SoulAttribute];
    return {
      id,
      label: t(lang, ATTRIBUTE_LABEL[attribute]),
      values: tiers.map((tier) => {
        const found = tier?.modifiers.find((modifier) => modifierId(modifier) === id);
        return found && formatModifier(found, lang);
      }),
    };
  });
  const abilityKeys = unique(tiers.flatMap((tier) => (tier?.ability ?? []).map((value) => value.key))) as SoulAbilityValue[];
  const abilityRows = abilityKeys.map((key): StatRow => ({
    id: `ability:${key}`,
    label: t(lang, ABILITY_VIEW[key].label),
    values: tiers.map((tier) => {
      const found = tier?.ability.find((value) => value.key === key);
      return found && formatValue(ABILITY_VIEW[key].format, found.value, lang);
    }),
  }));
  const narrowed = tiers.some((tier) => tier && (tier.threat.min !== FULL_THREAT.min || tier.threat.max !== FULL_THREAT.max));
  const threatRow: StatRow[] = narrowed
    ? [{ id: "threat", label: t(lang, "soulThreat"), values: tiers.map((tier) => tier && `${tier.threat.min}–${tier.threat.max}`) }]
    : [];
  return [...modifierRows, ...abilityRows, ...threatRow];
}

/** The generic level rows as one sentence value per tier ("×1.25"), for the note under the catalog. */
export const levelBonuses = (data: SoulEnchantmentData, lang: Lang): string =>
  data.levels.map((level) => `${level.tier} ${level.modifiers.map((modifier) => `${t(lang, ATTRIBUTE_LABEL[modifier.attribute])} ${formatModifier(modifier, lang)}`).join(", ")}`).join(" · ");

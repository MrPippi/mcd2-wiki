/** Server side of the weapon comparison: one row per stat, a cell per weapon with its printed text and raw number. */
import type { Weapon } from "../../../scripts/extract/weapon-schema";
import { t, type Lang, type UiKey } from "../i18n";
import { blocksText, round, roundText, secondsText } from "../units";

export const COMPARE_KEYS = [
  "archetypes", "weight",
  "fullCombo", "topHit", "swings", "reach",
  "shotDamage", "chargedShot", "shotsPerSecond", "ammo", "range", "charge", "ammoRecharge",
  "stagger", "knockback",
] as const;
export type CompareKey = (typeof COMPARE_KEYS)[number];

/** Which way a row ranks: a higher or a lower number is better, or the row is not ranked. */
export type Better = "high" | "low" | "none";

export interface CompareRow {
  readonly key: CompareKey;
  readonly label: string;
  readonly better: Better;
}

export interface CompareCell {
  readonly text: string;
  /** The number the row ranks by; absent for text rows. */
  readonly value?: number;
}

const ROWS: Readonly<Record<CompareKey, { readonly label: UiKey; readonly better: Better }>> = {
  archetypes: { label: "statLabelArchetypes", better: "none" },
  weight: { label: "statLabelWeight", better: "none" },
  fullCombo: { label: "statLabelFullCombo", better: "high" },
  topHit: { label: "statLabelTopHit", better: "high" },
  swings: { label: "statLabelSwings", better: "none" },
  reach: { label: "statLabelReach", better: "high" },
  shotDamage: { label: "statLabelShotDamage", better: "high" },
  chargedShot: { label: "statLabelChargedShot", better: "high" },
  shotsPerSecond: { label: "statLabelShotsPerSecond", better: "high" },
  ammo: { label: "statLabelAmmo", better: "high" },
  range: { label: "statLabelRange", better: "high" },
  charge: { label: "statLabelCharge", better: "low" },
  ammoRecharge: { label: "statLabelAmmoRecharge", better: "low" },
  stagger: { label: "statLabelStagger", better: "high" },
  knockback: { label: "statLabelKnockback", better: "high" },
};

const ARCHETYPE: Readonly<Record<Weapon["archetypes"][number], UiKey>> = {
  Fighter: "archetypeFighter",
  Mage: "archetypeMage",
  Ranger: "archetypeRanger",
  Summoner: "archetypeSummoner",
  Support: "archetypeSupport",
  Tank: "archetypeTank",
  Trickster: "archetypeTrickster",
};
const WEIGHT: Readonly<Record<NonNullable<Weapon["weight"]>, UiKey>> = { Light: "weightLight", Medium: "weightMedium", Heavy: "weightHeavy" };

export const compareRows = (lang: Lang): CompareRow[] => COMPARE_KEYS.map((key) => ({ key, label: t(lang, ROWS[key].label), better: ROWS[key].better }));

const number = (value: number, text: string): CompareCell => ({ text, value: round(value) });

function meleeCells(lang: Lang, melee: NonNullable<Weapon["melee"]>): Partial<Record<CompareKey, CompareCell>> {
  const { swings } = melee;
  const full = swings.reduce((sum, swing) => sum + swing.damage * swing.hits, 0);
  const top = Math.max(...swings.map((swing) => swing.damage));
  const reach = Math.max(...swings.map((swing) => swing.reach));
  const stagger = Math.max(...swings.map((swing) => swing.stagger));
  const knockback = Math.max(...swings.map((swing) => swing.knockback));
  return {
    fullCombo: number(full, roundText(full)),
    topHit: number(top, roundText(top)),
    swings: { text: String(swings.length) },
    reach: number(reach, blocksText(lang, reach)),
    stagger: number(stagger, roundText(stagger)),
    knockback: number(knockback, roundText(knockback)),
  };
}

function rangedCells(lang: Lang, ranged: NonNullable<Weapon["ranged"]>): Partial<Record<CompareKey, CompareCell>> {
  const perShot = ranged.damage * ranged.projectiles;
  const charges = ranged.chargeSeconds > 0; // a charge time of 0 means the weapon cannot charge
  const shots = 1 / ranged.attackRateSeconds;
  return {
    shotDamage: number(perShot, ranged.projectiles > 1 ? `${roundText(ranged.damage)} ×${ranged.projectiles}` : roundText(ranged.damage)),
    ...(charges ? { chargedShot: number(perShot * ranged.chargedMultiplier, roundText(ranged.damage * ranged.chargedMultiplier)) } : {}),
    shotsPerSecond: number(shots, roundText(shots)),
    ammo: number(ranged.ammo, String(ranged.ammo)),
    range: number(ranged.range, blocksText(lang, ranged.range)),
    ...(charges ? { charge: number(ranged.chargeSeconds, secondsText(lang, ranged.chargeSeconds)) } : {}),
    ammoRecharge: number(ranged.rechargeSeconds, secondsText(lang, ranged.rechargeSeconds)),
    stagger: number(ranged.stagger, roundText(ranged.stagger)),
    knockback: number(ranged.knockback, roundText(ranged.knockback)),
  };
}

/** A weapon's cells, keyed by row; rows the weapon has no value for are left out. */
export function compareCells(lang: Lang, weapon: Weapon): Partial<Record<CompareKey, CompareCell>> {
  const separator = t(lang, "listSeparator");
  return {
    ...(weapon.archetypes.length > 0 ? { archetypes: { text: weapon.archetypes.map((name) => t(lang, ARCHETYPE[name])).join(separator) } } : {}),
    ...(weapon.weight ? { weight: { text: t(lang, WEIGHT[weapon.weight]) } } : {}),
    ...(weapon.melee ? meleeCells(lang, weapon.melee) : {}),
    ...(weapon.ranged ? rangedCells(lang, weapon.ranged) : {}),
  };
}

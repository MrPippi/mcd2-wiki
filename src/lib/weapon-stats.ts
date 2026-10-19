import type { Entry } from "../../shared/schemas";
import type { Weapon } from "../../shared/weapon-schema";
import type { Lang } from "./i18n";
import { t, tCount, type UiKey } from "./ui-strings";
import { blocksText, roundText, secondsText } from "./units";
import { weaponData } from "./weapon-effects";

/** Stat names. The game has official Chinese only for 彈藥 and 擊退; the rest are this site's own wording. */
const LABEL = {
  fullCombo: "statLabelFullCombo",
  swings: "statLabelSwings",
  topHit: "statLabelTopHit",
  reach: "statLabelReach",
  shotDamage: "statLabelShotDamage",
  chargedShot: "statLabelChargedShot",
  shotsPerSecond: "statLabelShotsPerSecond",
  ammo: "statLabelAmmo",
  range: "statLabelRange",
  archetypes: "statLabelArchetypes",
  weight: "statLabelWeight",
  charge: "statLabelCharge",
  ammoRecharge: "statLabelAmmoRecharge",
  jumpShot: "statLabelJumpShot",
  stagger: "statLabelStagger",
  knockback: "statLabelKnockback",
} as const satisfies Record<string, UiKey>;

const ARCHETYPE: Readonly<Record<Weapon["archetypes"][number], UiKey>> = {
  Fighter: "archetypeFighter",
  Mage: "archetypeMage",
  Ranger: "archetypeRanger",
  Summoner: "archetypeSummoner",
  Support: "archetypeSupport",
  Tank: "archetypeTank",
  Trickster: "archetypeTrickster",
};

const WEIGHT: Readonly<Record<NonNullable<Weapon["weight"]>, UiKey>> = {
  Light: "weightLight",
  Medium: "weightMedium",
  Heavy: "weightHeavy",
};

/** Combo table heads; distances carry their unit in the head so the cells stay narrow on phones. */
const COMBO_HEADS = ["comboHead1", "comboHead2", "comboHead3", "comboHead4", "comboHead5", "comboHead6"] as const satisfies readonly UiKey[];

export interface StatRow {
  readonly label: string;
  readonly value: string;
}

export interface WeaponStatsView {
  readonly tiles: readonly StatRow[];
  readonly facts: readonly StatRow[];
  readonly combo?: { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] };
}

const round = roundText;
const blocks = blocksText;
const seconds = secondsText;
const row = (lang: Lang, key: keyof typeof LABEL, value: string): StatRow => ({ label: t(lang, LABEL[key]), value });

function meleeView(lang: Lang, melee: NonNullable<Weapon["melee"]>): Pick<WeaponStatsView, "tiles" | "combo"> {
  const { swings, jump } = melee;
  const tiles = [
    row(lang, "fullCombo", round(swings.reduce((sum, swing) => sum + swing.damage * swing.hits, 0))),
    row(lang, "swings", String(swings.length)),
    row(lang, "topHit", round(Math.max(...swings.map((swing) => swing.damage)))),
    row(lang, "reach", blocks(lang, Math.max(...swings.map((swing) => swing.reach)))),
  ];
  const swingRows = swings.map((swing, i) => [
    tCount(lang, "swingN", i + 1),
    round(swing.damage),
    String(swing.hits),
    round(swing.stagger),
    round(swing.reach),
    round(swing.knockback),
  ]);
  const jumpRow = jump ? [[t(lang, "jumpAttack"), round(jump.damage), "-", round(jump.stagger), round(jump.reach), round(jump.knockback)]] : [];
  return { tiles, combo: { columns: COMBO_HEADS.map((key) => t(lang, key)), rows: [...swingRows, ...jumpRow] } };
}

function rangedView(lang: Lang, ranged: NonNullable<Weapon["ranged"]>): Pick<WeaponStatsView, "tiles" | "facts"> {
  const perShot = ranged.projectiles > 1 ? `${round(ranged.damage)} ×${ranged.projectiles}` : round(ranged.damage);
  // A charge time of 0 means the weapon cannot charge, whatever its charge multiplier says.
  const charges = ranged.chargeSeconds > 0;
  return {
    tiles: [
      row(lang, "shotDamage", perShot),
      ...(charges ? [row(lang, "chargedShot", round(ranged.damage * ranged.chargedMultiplier))] : []),
      row(lang, "shotsPerSecond", round(1 / ranged.attackRateSeconds)),
      row(lang, "ammo", String(ranged.ammo)),
      row(lang, "range", blocks(lang, ranged.range)),
    ],
    facts: [
      ...(charges ? [row(lang, "charge", seconds(lang, ranged.chargeSeconds))] : []),
      row(lang, "ammoRecharge", seconds(lang, ranged.rechargeSeconds)),
      ...(ranged.jumpShotMultiplier !== 1 ? [row(lang, "jumpShot", `×${round(ranged.jumpShotMultiplier)}`)] : []),
      row(lang, "stagger", round(ranged.stagger)),
      row(lang, "knockback", round(ranged.knockback)),
    ],
  };
}

/** A weapon's game stats ready to print; undefined when the entry is not a weapon with game data. */
export function weaponStatsView(lang: Lang, weapon: Entry): WeaponStatsView | undefined {
  if (weapon.category !== "melee" && weapon.category !== "ranged") return undefined;
  const data = weaponData.weapons[weapon.slug];
  if (!data) return undefined;
  const listSeparator = t(lang, "listSeparator");
  const identity = [
    ...(data.archetypes.length > 0 ? [row(lang, "archetypes", data.archetypes.map((name) => t(lang, ARCHETYPE[name])).join(listSeparator))] : []),
    ...(data.weight ? [row(lang, "weight", t(lang, WEIGHT[data.weight]))] : []),
  ];
  if (data.melee) {
    const melee = meleeView(lang, data.melee);
    return { tiles: melee.tiles, facts: identity, ...(melee.combo ? { combo: melee.combo } : {}) };
  }
  if (data.ranged) {
    const ranged = rangedView(lang, data.ranged);
    return { tiles: ranged.tiles, facts: [...identity, ...ranged.facts] };
  }
  return { tiles: [], facts: identity };
}

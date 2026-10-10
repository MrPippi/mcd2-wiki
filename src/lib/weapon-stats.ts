import type { Entry, Localized } from "../../scripts/extract/schemas";
import type { Weapon } from "../../scripts/extract/weapon-schema";
import type { Lang } from "./i18n";
import { weaponData } from "./weapon-effects";

/** Stat names. The game has official Chinese only for 彈藥 and 擊退; the rest are this site's own wording. */
const LABEL = {
  fullCombo: { zh: "整套連擊", en: "Full combo" },
  swings: { zh: "連擊段數", en: "Swings" },
  topHit: { zh: "最高單擊", en: "Top hit" },
  reach: { zh: "攻擊距離", en: "Reach" },
  shotDamage: { zh: "每發傷害", en: "Shot damage" },
  chargedShot: { zh: "蓄力射擊", en: "Charged shot" },
  shotsPerSecond: { zh: "每秒射擊數", en: "Shots per second" },
  ammo: { zh: "彈藥", en: "Ammo" },
  range: { zh: "射程", en: "Range" },
  archetypes: { zh: "定位", en: "Archetype" },
  weight: { zh: "重量", en: "Weight" },
  charge: { zh: "蓄力時間", en: "Charge" },
  ammoRecharge: { zh: "彈藥回復", en: "Ammo recharge" },
  jumpShot: { zh: "跳躍射擊", en: "Jump shot" },
  stagger: { zh: "硬直", en: "Stagger" },
  knockback: { zh: "擊退", en: "Knockback" },
} as const satisfies Record<string, Localized>;

const ARCHETYPE: Readonly<Record<Weapon["archetypes"][number], Localized>> = {
  Fighter: { zh: "戰士", en: "Fighter" },
  Mage: { zh: "法師", en: "Mage" },
  Ranger: { zh: "遊俠", en: "Ranger" },
  Summoner: { zh: "召喚師", en: "Summoner" },
  Support: { zh: "輔助", en: "Support" },
  Tank: { zh: "坦克", en: "Tank" },
  Trickster: { zh: "詭術師", en: "Trickster" },
};

const WEIGHT: Readonly<Record<NonNullable<Weapon["weight"]>, Localized>> = {
  Light: { zh: "輕型", en: "Light" },
  Medium: { zh: "中型", en: "Medium" },
  Heavy: { zh: "重型", en: "Heavy" },
};

/** Combo table heads; distances carry their unit in the head so the cells stay narrow on phones. */
const COMBO_COLUMNS: Readonly<Record<Lang, readonly string[]>> = {
  zh: ["招式", "傷害", "命中", "硬直", "距離（格）", "擊退"],
  en: ["Swing", "Damage", "Hits", "Stagger", "Reach (blocks)", "Knockback"],
};

export interface StatRow {
  readonly label: string;
  readonly value: string;
}

export interface WeaponStatsView {
  readonly tiles: readonly StatRow[];
  readonly facts: readonly StatRow[];
  readonly combo?: { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] };
}

const round = (value: number, digits = 2): string => String(Math.round(value * 10 ** digits) / 10 ** digits);
const blocks = (lang: Lang, value: number): string => (lang === "zh" ? `${round(value)} 格` : `${round(value)} ${value === 1 ? "block" : "blocks"}`);
const seconds = (lang: Lang, value: number): string => (lang === "zh" ? `${round(value)} 秒` : `${round(value)} sec`);
const row = (lang: Lang, key: keyof typeof LABEL, value: string): StatRow => ({ label: LABEL[key][lang], value });

function meleeView(lang: Lang, melee: NonNullable<Weapon["melee"]>): Pick<WeaponStatsView, "tiles" | "combo"> {
  const { swings, jump } = melee;
  const tiles = [
    row(lang, "fullCombo", round(swings.reduce((sum, swing) => sum + swing.damage * swing.hits, 0))),
    row(lang, "swings", String(swings.length)),
    row(lang, "topHit", round(Math.max(...swings.map((swing) => swing.damage)))),
    row(lang, "reach", blocks(lang, Math.max(...swings.map((swing) => swing.reach)))),
  ];
  const swingRows = swings.map((swing, i) => [
    lang === "zh" ? `第 ${i + 1} 擊` : `Swing ${i + 1}`,
    round(swing.damage),
    String(swing.hits),
    round(swing.stagger),
    round(swing.reach),
    round(swing.knockback),
  ]);
  const jumpRow = jump ? [[lang === "zh" ? "跳躍攻擊" : "Jump attack", round(jump.damage), "-", round(jump.stagger), round(jump.reach), round(jump.knockback)]] : [];
  return { tiles, combo: { columns: COMBO_COLUMNS[lang], rows: [...swingRows, ...jumpRow] } };
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
  const listSeparator = lang === "zh" ? "、" : " + ";
  const identity = [
    ...(data.archetypes.length > 0 ? [row(lang, "archetypes", data.archetypes.map((name) => ARCHETYPE[name][lang]).join(listSeparator))] : []),
    ...(data.weight ? [row(lang, "weight", WEIGHT[data.weight][lang])] : []),
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

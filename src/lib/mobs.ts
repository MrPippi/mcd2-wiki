/** The bestiary for the site: mob data from `npm run extract` and the pure helpers its pages format with. Server-side only. */
import {
  MobDataSchema,
  type LootSlotKey,
  type Mob,
  type MobArea,
  type MobData,
  type MobDrop,
  type StatKey,
} from "../../scripts/extract/mob-schema";
import rawMobs from "../data/mobs.json";
import { htmlLang, type Lang } from "./lang";
import { mobKindLabel } from "./i18n";
import { formatView, worldSearch } from "./map/view-state";
import { GAME_NAME } from "./site-title";
import { t, type UiKey } from "./ui-strings";
import { href } from "./url";

/** Mobs from `npm run extract`, validated at build time. */
export const mobData: MobData = MobDataSchema.parse(rawMobs);

/** The order the bestiary lists its groups in. */
export const MOB_KIND_ORDER: readonly Mob["kind"][] = ["boss", "miniboss", "regular", "variant"];

export interface MobGroup {
  readonly kind: Mob["kind"];
  readonly mobs: Mob[];
}

const byEnglishName = (a: Mob, b: Mob): number => a.name.en.localeCompare(b.name.en, "en") || a.slug.localeCompare(b.slug, "en");

/** Mobs grouped by kind in MOB_KIND_ORDER, each group sorted by English name; empty groups are left out. */
export const mobGroups = (mobs: readonly Mob[]): MobGroup[] =>
  MOB_KIND_ORDER.map((kind) => ({ kind, mobs: mobs.filter((mob) => mob.kind === kind).sort(byEnglishName) })).filter(
    (group) => group.mobs.length > 0,
  );

/** A mob page's meta description: its name, its kind, the bestiary and the game, in the page language. */
export const mobDescription = (mob: Mob, lang: Lang): string =>
  [mob.name[lang], mobKindLabel(mob.kind, lang), t(lang, "mobs"), GAME_NAME].join(" · ");

const MOBS_BY_SLUG: ReadonlyMap<string, Mob> = new Map(mobData.mobs.map((mob) => [mob.slug, mob]));

export const findMob = (slug: string): Mob | undefined => MOBS_BY_SLUG.get(slug);

export const mobHref = (lang: Lang, slug: string): string => href(lang, "mobs", slug);

/** Zoom level a mob page's area link opens the map at. */
export const MOB_MAP_ZOOM = 4;

/** The area's spot on its world map, or the map page when the game data gives the area no marker. */
export function mapLinkOf(lang: Lang, area: MobArea): string {
  const map = href(lang, "map");
  if (!area.map) return map;
  return `${map}${worldSearch("", area.map.world)}${formatView({ z: MOB_MAP_ZOOM, px: area.map.px, py: area.map.py })}`;
}

/**
 * One area per name as shown in `lang` (two zones can share a name, e.g. two "Dungeon"s), in first-seen order.
 * Of same-named areas, the first with a map marker wins, else the first.
 */
export function uniqueAreas(areas: readonly MobArea[], lang: Lang): MobArea[] {
  const names = [...new Set(areas.map((area) => area.name[lang]))];
  return names.map((name) => {
    const same = areas.filter((area) => area.name[lang] === name);
    return same.find((area) => area.map) ?? same[0];
  });
}

const isMultiplier = (key: StatKey): boolean => key === "knockbackResistance" || key.startsWith("resist") || key.endsWith("AttackSpeed");

const round2 = (value: number): string => String(Math.round(value * 100) / 100);

/** A stat value: multipliers as ×1.5, everything else as a number with at most two decimals. */
export const formatStat = (key: StatKey, value: number): string => (isMultiplier(key) ? `×${round2(value)}` : round2(value));

/** Stats the game gives in raw engine units (no block or second unit is confirmed), so the page notes it instead of guessing one. */
export const RAW_UNIT_STATS: ReadonlySet<StatKey> = new Set(["movementSpeed", "sightRadius"]);

/** A 0–1 chance as a percentage with at most two decimals, written the way the language writes it. */
export const formatChance = (chance: number, lang: Lang): string =>
  new Intl.NumberFormat(htmlLang(lang), { style: "percent", maximumFractionDigits: 2 }).format(chance);

/** A slot's drop rule as sentences: the guaranteed count, then the random rolls; a part that is zero is left out. */
export function dropSummary(drop: MobDrop, lang: Lang): string[] {
  const guaranteed = drop.guaranteed > 0 ? [t(lang, "mobDropGuaranteed").replace("{n}", String(drop.guaranteed))] : [];
  const rolls =
    drop.rolls > 0
      ? [t(lang, "mobDropRolls").replace("{n}", String(drop.rolls)).replace("{chance}", formatChance(drop.chancePerRoll, lang))]
      : [];
  return [...guaranteed, ...rolls];
}

const NUMBER_PATTERN = /(\d+(?:[.,]\d+)?(?:[   ]?%)?)/;

/** A drop sentence cut into runs; the odd-indexed ones are numbers (counts, percentages) that the page sets in mono. */
export const splitNumbers = (line: string): string[] => line.split(NUMBER_PATTERN);

/** Slots whose label does not say what drops (gear, books, talismans): they get a note on where the items come from. */
const POOLED_SLOTS: ReadonlySet<LootSlotKey> = new Set(["item", "specialGear", "enchantedBook", "talismans"]);

const POOL_NOTE: Readonly<Record<MobDrop["pool"], UiKey>> = {
  area: "mobDropPoolArea",
  own: "mobDropPoolOwn",
  none: "mobDropPoolNone",
};

/**
 * Where a slot's items come from. "none" (regular mobs' gear: the game data names no list) is said as such, never as the area pool;
 * "own" lists are not shown. Currency and consumable slots get no note.
 */
export const dropPoolNote = (drop: MobDrop, lang: Lang): string | undefined =>
  POOLED_SLOTS.has(drop.slot) ? t(lang, POOL_NOTE[drop.pool]) : undefined;

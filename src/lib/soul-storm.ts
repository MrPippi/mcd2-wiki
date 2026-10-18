/** The Soul Storm page for the site: data from `npm run extract` and the helpers its components format with. Server-side only. */
import type { Mob, MobArea } from "../../scripts/extract/mob-schema";
import type { Location } from "../../scripts/extract/location-schema";
import { SoulStormDataSchema, type Chest, type Generator, type SoulStormData, type TextId } from "../../scripts/extract/soul-storm-schema";
import rawSoulStorm from "../data/soul-storm.json";
import { t, type Lang, type UiKey } from "./i18n";
import { htmlLang } from "./lang";
import { locationOf } from "./locations";
import { findMob, formatChance, mapLinkOf } from "./mobs";
import type { ClockArea, ClockPayload, StormSchedule } from "./soul-storm-schedule";
import { assetUrl } from "./url";

/** Soul Storm data from `npm run extract`, validated at build time. */
export const soulStormData: SoulStormData = SoulStormDataSchema.parse(rawSoulStorm);

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** Storms the clock lists: one whole rotation (P11). */
export const UPCOMING_STORMS = 7;

/** The only unlock state the page can put into words. */
const MAIN_QUEST_COMPLETE = "SW.GameState.MainQuestComplete";

export const scheduleOf = (data: SoulStormData): StormSchedule => ({
  anchorMs: Date.parse(data.schedule.anchorUtc),
  durationMs: data.schedule.durationSeconds * MS_PER_SECOND,
  cadenceMs: data.schedule.cadenceSeconds * MS_PER_SECOND,
  areaCount: data.rotation.length,
  rotationOffset: data.schedule.rotationOffset,
});

/** Whether there is a schedule to show: no rotation or no cadence means the tables were missing (P13). */
export const hasSchedule = (data: SoulStormData): boolean => data.rotation.length > 0 && data.schedule.cadenceSeconds > 0;

/** The location a rotation area belongs to, if the site has a page for it. */
export const areaLocation = (area: MobArea): Location | undefined => locationOf(area.areaId);

const clockArea = (area: MobArea, lang: Lang): ClockArea => {
  const icon = areaLocation(area)?.icon;
  return { name: area.name[lang], href: mapLinkOf(lang, area), ...(icon ? { icon: assetUrl(icon) } : {}) };
};

/** Everything the browser clock needs, every string already in the page language; undefined without a schedule. */
export function clockPayload(lang: Lang, data: SoulStormData = soulStormData): ClockPayload | undefined {
  if (!hasSchedule(data)) return undefined;
  return {
    ...scheduleOf(data),
    areas: data.rotation.map((area) => clockArea(area, lang)),
    labels: {
      now: t(lang, "soulStormNow"),
      next: t(lang, "soulStormNext"),
      endsIn: t(lang, "soulStormEndsIn"),
      startsIn: t(lang, "soulStormStartsIn"),
      timeZone: t(lang, "soulStormTimeZone"),
    },
    upcoming: UPCOMING_STORMS,
  };
}

/** The JSON for the page's data script, with "<" escaped so no text can close the script element early. */
export const clockJson = (payload: ClockPayload): string => JSON.stringify(payload).replace(/</g, "\\u003c");

/** An official text in the page language and whether it fell back to English; undefined when the game has none. */
export function textOf(data: SoulStormData, id: TextId, lang: Lang): { html: string; untranslated: boolean } | undefined {
  const text = data.texts[id];
  const html = text.html[lang];
  return html === "" ? undefined : { html, untranslated: text.untranslated.includes(lang) };
}

/** Whether any of the given texts fell back to English: a section shows one marker for all of them. */
export const anyUntranslated = (data: SoulStormData, ids: readonly TextId[], lang: Lang): boolean =>
  ids.some((id) => textOf(data, id, lang)?.untranslated === true);

const TIER_KEY = {
  easy: "soulStormTierEasy",
  medium: "soulStormTierMedium",
  hard: "soulStormTierHard",
} as const satisfies Record<Generator["tier"], UiKey>;

const CHEST_KEY = {
  generator: { easy: "soulStormTierEasy", medium: "soulStormTierMedium", hard: "soulStormTierHard", low: "soulStormChestLow", high: "soulStormChestHigh" },
  final: { easy: "soulStormTierEasy", medium: "soulStormChestMedium", hard: "soulStormTierHard", low: "soulStormChestLow", high: "soulStormChestHigh" },
} as const satisfies Record<Chest["group"], Record<Chest["tier"], UiKey>>;

export const generatorTierLabel = (tier: Generator["tier"], lang: Lang): string => t(lang, TIER_KEY[tier]);

/** Generator chests read as difficulties (Easy/Medium/Hard), reward chests as grades (Low/Medium/High) (P5). */
export const chestLabel = (chest: Chest, lang: Lang): string => t(lang, CHEST_KEY[chest.group][chest.tier]);

export const formatMultipliers = (values: readonly number[]): string => values.join(" / ");

/** The health multipliers when every difficulty shares them, so the page says them once; undefined when they differ or there are none. */
export function sharedMultipliers(generators: readonly Generator[]): readonly number[] | undefined {
  const [first] = generators;
  if (!first || first.healthByPlayers.length === 0) return undefined;
  const key = formatMultipliers(first.healthByPlayers);
  return generators.every((generator) => formatMultipliers(generator.healthByPlayers) === key) ? first.healthByPlayers : undefined;
}

/** Bestiary entries for the given slugs; slugs the bestiary lacks are left out (the extraction already reported them). */
export const summonedMobs = (slugs: readonly string[]): Mob[] => slugs.flatMap((slug) => findMob(slug) ?? []);

export const cadenceLine = (data: SoulStormData, lang: Lang): string =>
  t(lang, "soulStormCadence")
    .replace("{cadence}", String(data.schedule.cadenceSeconds / SECONDS_PER_MINUTE))
    .replace("{duration}", String(data.schedule.durationSeconds / SECONDS_PER_MINUTE));

/** The unlock sentence, or undefined when there is no unlock or the page cannot put its state into words. */
export const unlockLine = (data: SoulStormData, lang: Lang): string | undefined =>
  data.unlock?.gameState === MAIN_QUEST_COMPLETE ? t(lang, "soulStormUnlockMainQuest") : undefined;

/** Chests of one group in data order (easy → hard, low → high). */
export const chestsOf = (data: SoulStormData, group: Chest["group"]): Chest[] => data.chests.filter((chest) => chest.group === group);

/** The slot kinds a chest group has, in first-seen order: the rows of its table. */
export const slotRows = (chests: readonly Chest[]): Chest["slots"][number]["slot"][] => [
  ...new Set(chests.flatMap((chest) => chest.slots.map((slot) => slot.slot))),
];

/** A spawn weight, or a dash when the data has none. */
export const spawnWeightText = (weight: number | null): string => (weight === null ? "—" : String(weight));

/** How many mobs one final wave picks: "1", or a range with an en dash ("1–2"). */
export const pickCount = ({ minPick, maxPick }: Pick<Generator["finalSummon"], "minPick" | "maxPick">): string =>
  minPick === maxPick ? String(minPick) : `${minPick}–${maxPick}`;

/** The final-summon sentence that introduces the list of mobs (replacer functions: no "$" patterns in the values). */
export const summonLine = (generator: Generator, lang: Lang): string =>
  t(lang, "soulStormFinalSummon")
    .replace("{percent}", () => formatChance(generator.finalSummon.healthFraction, lang))
    .replace("{count}", () => pickCount(generator.finalSummon));

/** The chest rarity sentence with numbers written the page language's way; undefined when the data has none. */
export function rarityLine(data: SoulStormData, lang: Lang): string | undefined {
  if (!data.chestRarity) return undefined;
  const number = new Intl.NumberFormat(htmlLang(lang), { maximumFractionDigits: 6 });
  const { common, rare } = data.chestRarity;
  return t(lang, "soulStormRarity").replace("{common}", () => number.format(common)).replace("{rare}", () => number.format(rare));
}

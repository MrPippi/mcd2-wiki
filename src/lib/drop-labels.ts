/** How a drop source and its area are named on a page: the name in the language, a link where there is a page, and a small note. Server-side only. */
import type { DropSource } from "../../shared/drop-types";
import { t, type Lang } from "./i18n";
import { assetUrl, href } from "./url";
import { areaHref, lootSource } from "./item-source-view";
import { locationOf } from "./locations";
import { mobData, mobHref } from "./mobs";
import { findQuest, questData, questHref } from "./quests";

export interface DropLabel {
  readonly name: string;
  readonly href?: string;
  /** What tells this source from others of the same name: the quest batch, the dungeon version. */
  readonly note?: string;
  /** The data does not say where the source appears. */
  readonly unplaced?: true;
  /** The area's game icon (asset URL), for area labels. */
  readonly icon?: string;
}

const PROCEDURAL = /_Procedural$/;
const questSlugs: ReadonlyMap<string, string> = new Map(questData.quests.map((quest) => [quest.id, quest.slug]));
const mobsById = new Map(mobData.mobs.map((mob) => [mob.id, mob] as const));

/** A list of sources looked up by id, with the number of first-completion batches of each quest, built once per list. */
export interface SourceIndex {
  readonly byId: ReadonlyMap<string, DropSource>;
  readonly firstBatches: ReadonlyMap<string, number>;
}

const indexes = new WeakMap<readonly DropSource[], SourceIndex>();

export function sourceIndex(all: readonly DropSource[]): SourceIndex {
  const known = indexes.get(all);
  if (known) return known;
  const firstBatches = new Map<string, number>();
  for (const source of all) {
    if (source.kind === "quest" && source.first) firstBatches.set(source.id.split(":")[1], (firstBatches.get(source.id.split(":")[1]) ?? 0) + 1);
  }
  const built = { byId: new Map(all.map((source) => [source.id, source] as const)), firstBatches };
  indexes.set(all, built);
  return built;
}

function questLabel(lang: Lang, source: DropSource, index: SourceIndex): DropLabel {
  const [, id, position] = source.id.split(":");
  const number = Number(position) - (source.first ? 0 : (index.firstBatches.get(id) ?? 0)) + 1;
  const slug = questSlugs.get(id);
  const quest = slug ? findQuest(slug) : undefined;
  const kind = t(lang, source.first ? "questFirstCompletion" : "questEveryCompletion");
  return {
    name: quest ? quest.title.text[lang] : id,
    ...(quest ? { href: questHref(lang, quest.slug) } : {}),
    note: `${kind} · ${t(lang, "dropQuestBatch").replace("{n}", String(number))}`,
  };
}

function chestLabel(lang: Lang, source: DropSource): DropLabel {
  const procedural = PROCEDURAL.test(source.id);
  const base = source.id.replace(PROCEDURAL, "");
  return { name: lootSource(base)?.name[lang] ?? base.replace(/^chest:/, ""), ...(procedural ? { note: t(lang, "dropProcedural") } : {}) };
}

function mobLabel(lang: Lang, source: DropSource): DropLabel {
  const id = source.id.replace(/^mob:/, "");
  const mob = mobsById.get(id);
  return { name: mob?.name[lang] ?? lootSource(source.id)?.name[lang] ?? id, ...(mob ? { href: mobHref(lang, mob.slug) } : {}) };
}

/** The Soul Corrupted state of a regular mob source: "regular:SoulStated" and "regular:Geomancer:soul". */
const SOUL_SOURCE = /:(SoulStated|soul)$/;

/** Regular mobs: one name for every mob of the area, or the Geomancer's; the calculator lists names only, so Soul Corrupted is told apart in the name. */
function regularLabel(lang: Lang, source: DropSource): DropLabel {
  const mob = mobsById.get(source.id.split(":")[1]);
  const base = mob?.name[lang] ?? t(lang, "dropRegularMobs");
  return { name: SOUL_SOURCE.test(source.id) ? `${base} · ${t(lang, "mobSoulCorrupted")}` : base, href: mob ? mobHref(lang, mob.slug) : href(lang, "mobs") };
}

/** The label of a source; `all` is the file's sources, which number a quest's reward batches. */
export function sourceLabel(lang: Lang, source: DropSource, all: readonly DropSource[] = [source]): DropLabel {
  const label = source.kind === "quest" ? questLabel(lang, source, sourceIndex(all)) : source.kind === "mob" ? mobLabel(lang, source) : source.kind === "regular" ? regularLabel(lang, source) : chestLabel(lang, source);
  return source.unplaced ? { ...label, unplaced: true } : label;
}

/** The label of an area source id ("area:SW.Area.Plains.A1", "bookPool:..."); undefined for no area or one nothing names. */
export function areaLabel(lang: Lang, id: string): DropLabel | undefined {
  const source = id === "" ? undefined : lootSource(id);
  if (!source) return undefined;
  if (source.kind !== "area") return { name: source.name[lang] };
  const icon = locationOf(id.replace(/^area:/, ""))?.icon;
  return { name: source.name[lang], href: areaHref(lang, id, source.name), ...(icon ? { icon: assetUrl(icon) } : {}) };
}

/** How a drop source and its area are named on a page: the name in the language, a link where there is a page, and a small note. Server-side only. */
import type { DropSource } from "./drop-types";
import { t, type Lang } from "./i18n";
import { areaHref, lootSource } from "./item-source-view";
import { mobData, mobHref } from "./mobs";
import { findQuest, questData, questHref } from "./quests";

export interface DropLabel {
  readonly name: string;
  readonly href?: string;
  /** What tells this source from others of the same name: the quest batch, the dungeon version. */
  readonly note?: string;
}

const PROCEDURAL = /_Procedural$/;
const questSlugs: ReadonlyMap<string, string> = new Map(questData.quests.map((quest) => [quest.id, quest.slug]));

/** "quest:<id>:<index>" → the quest id and the batch's position in the list it belongs to (first-completion or every-completion). */
function questBatch(source: DropSource, all: readonly DropSource[]): { id: string; number: number } {
  const [, id, index] = source.id.split(":");
  const firstCount = all.filter((one) => one.first && one.id.startsWith(`quest:${id}:`)).length;
  return { id, number: Number(index) - (source.first ? 0 : firstCount) + 1 };
}

function questLabel(lang: Lang, source: DropSource, all: readonly DropSource[]): DropLabel {
  const { id, number } = questBatch(source, all);
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
  const mob = mobData.mobs.find((one) => one.id === id);
  return { name: mob?.name[lang] ?? lootSource(source.id)?.name[lang] ?? id, ...(mob ? { href: mobHref(lang, mob.slug) } : {}) };
}

/** The label of a source; `all` is the file's sources, which number a quest's reward batches. */
export function sourceLabel(lang: Lang, source: DropSource, all: readonly DropSource[] = [source]): DropLabel {
  if (source.kind === "quest") return questLabel(lang, source, all);
  return source.kind === "mob" ? mobLabel(lang, source) : chestLabel(lang, source);
}

/** The label of an area source id ("area:SW.Area.Plains.A1", "bookPool:..."); undefined for no area or one nothing names. */
export function areaLabel(lang: Lang, id: string): DropLabel | undefined {
  const source = id === "" ? undefined : lootSource(id);
  return source ? { name: source.name[lang], ...(source.kind === "area" ? { href: areaHref(lang, id, source.name) } : {}) } : undefined;
}

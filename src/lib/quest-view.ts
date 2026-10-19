/** Pure helpers the quest pages and item pages format quest data with. Type-only imports, so tests need no data files. */
import type { MobArea } from "../../shared/mob-schema";
import type { Quest, QuestData, QuestRarity, QuestSection, QuestSize } from "../../shared/quest-schema";
import { QUEST_SECTIONS } from "../../shared/quest-schema";
import type { UiKey } from "./ui-strings";

export const SECTION_KEY: Readonly<Record<QuestSection, UiKey>> = {
  core: "questsCore",
  side: "questsSide",
  echoGolem: "questsEchoGolem",
  bossReplay: "questsBossReplays",
};

export const SIZE_KEY: Readonly<Record<QuestSize, UiKey>> = {
  small: "questSizeSmall",
  medium: "questSizeMedium",
  large: "questSizeLarge",
  extraLarge: "questSizeExtraLarge",
};

export const TYPE_KEY: Readonly<Record<Quest["type"], UiKey>> = { core: "questTypeCore", side: "questTypeSide" };

export const RARITY_KEY: Readonly<Record<QuestRarity, UiKey>> = {
  common: "rarityCommon",
  rare: "rarityRare",
  special: "raritySpecial",
  unique: "unique",
};

export interface QuestGroup {
  /** The region heading of a side-quest group; null for the other sections. */
  readonly region: MobArea | null;
  readonly quests: readonly Quest[];
}

export interface QuestSectionView {
  readonly section: QuestSection;
  readonly groups: readonly QuestGroup[];
  readonly count: number;
}

/** Side quests split into consecutive runs of one region, in data order. */
function regionGroups(quests: readonly Quest[]): QuestGroup[] {
  const ids = [...new Set(quests.map((quest) => quest.region?.areaId ?? ""))];
  return ids.map((id) => {
    const members = quests.filter((quest) => (quest.region?.areaId ?? "") === id);
    return { region: members[0]?.region ?? null, quests: members };
  });
}

/** The list page: sections in page order (empty ones left out), side quests grouped by region. */
export function questSections(quests: readonly Quest[]): QuestSectionView[] {
  return QUEST_SECTIONS.flatMap((section) => {
    const members = quests.filter((quest) => quest.section === section);
    if (members.length === 0) return [];
    const groups = section === "side" ? regionGroups(members) : [{ region: null, quests: members }];
    return [{ section, groups, count: members.length }];
  });
}

/** Slugs of the quests known to give a loot-sources quest source; empty when that is not exactly known. */
export const rewardQuestSlugs = (data: Pick<QuestData, "rewardSources">, sourceId: string): readonly string[] =>
  Object.hasOwn(data.rewardSources, sourceId) ? data.rewardSources[sourceId] : [];

/** "category/slug" → its two parts; undefined for a key without exactly one slash. */
export function splitItemKey(key: string): { category: string; slug: string } | undefined {
  const parts = key.split("/");
  return parts.length === 2 && parts[0] !== "" && parts[1] !== "" ? { category: parts[0], slug: parts[1] } : undefined;
}

export type TemplatePart = { readonly kind: "text"; readonly text: string } | { readonly kind: "slot" };

/** A sentence with one `{name}` slot cut around it; a template without the slot is all text with the slot at the end. */
export function templateParts(template: string, slot: string): TemplatePart[] {
  const marker = `{${slot}}`;
  const at = template.indexOf(marker);
  if (at === -1) return [{ kind: "text", text: template }, { kind: "slot" }];
  const before = template.slice(0, at);
  const after = template.slice(at + marker.length);
  return [...(before ? [{ kind: "text" as const, text: before }] : []), { kind: "slot" }, ...(after ? [{ kind: "text" as const, text: after }] : [])];
}

export type ListPart = { readonly kind: "item"; readonly index: number } | { readonly kind: "text"; readonly text: string };

/** Items joined the way the language writes a short list ("A, B" / "A、B"), as parts so the items can be links. */
export function listParts(locale: string, count: number): ListPart[] {
  const placeholders = Array.from({ length: count }, (_, index) => `\u0000${index}\u0000`);
  const parts = new Intl.ListFormat(locale, { style: "narrow", type: "unit" }).formatToParts(placeholders);
  return parts.map((part) =>
    part.type === "element" ? { kind: "item", index: Number(part.value.replaceAll("\u0000", "")) } : { kind: "text", text: part.value },
  );
}

/** "×3" for a count above one, else nothing. */
export const countMark = (count: number): string => (count > 1 ? `×${count}` : "");

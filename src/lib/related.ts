import type { Lang } from "../../scripts/extract/config";
import type { Entry, Localized } from "../../scripts/extract/schemas";
import { findArmorSet, findEntry } from "./data";
import type { UiKey } from "./i18n";
import { entryHref, href } from "./url";

export interface RelatedLink {
  readonly labelKey: UiKey;
  readonly href: string;
  readonly name: Localized;
}

const toLink = (lang: Lang, labelKey: UiKey, target: Entry | undefined): RelatedLink[] =>
  target ? [{ labelKey, href: entryHref(lang, target), name: target.name }] : [];

export function relatedLinks(lang: Lang, entry: Entry): RelatedLink[] {
  const { variants = [], armorSet } = entry.links;
  const set = armorSet ? findArmorSet(armorSet) : undefined;
  return [
    ...variants.flatMap((slug) => toLink(lang, "relatedVariant", findEntry(entry.category, slug))),
    ...(set ? [{ labelKey: "armorSet" as const, href: href(lang, "armor", set.slug), name: set.name }] : []),
  ];
}

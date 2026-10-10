import type { Category, Lang } from "../../scripts/extract/config";
import { ARMOR_PIECES, type ArmorSet, type Entry, type Localized } from "../../scripts/extract/schemas";
import { findArmorSet, findEntry } from "./data";
import type { UiKey } from "./i18n";
import { entryHref, href } from "./url";

export interface RelatedLink {
  readonly labelKey: UiKey;
  readonly href: string;
  readonly name: Localized;
  readonly icon?: string;
  readonly category: Category;
  readonly variant: Entry["variant"];
}

const toLink = (lang: Lang, labelKey: UiKey, target: Entry | undefined): RelatedLink[] =>
  target
    ? [{
        labelKey,
        href: entryHref(lang, target),
        name: target.name,
        ...(target.icon ? { icon: target.icon } : {}),
        category: target.category,
        variant: target.variant,
      }]
    : [];

/** An armor set has no icon of its own; it is shown with its first piece's, as on the armor list. */
const setIcon = (set: ArmorSet): string | undefined =>
  ARMOR_PIECES.map((piece) => set.pieces[piece])
    .map((slug) => (slug ? findEntry("armor", slug) : undefined))
    .find((entry) => entry !== undefined)?.icon;

const toSetLink = (lang: Lang, set: ArmorSet): RelatedLink => {
  const icon = setIcon(set);
  return {
    labelKey: "armorSet",
    href: href(lang, "armor", set.slug),
    name: set.name,
    ...(icon ? { icon } : {}),
    category: "armor",
    variant: set.variant,
  };
};

export function relatedLinks(lang: Lang, entry: Entry): RelatedLink[] {
  const { variants = [], armorSet } = entry.links;
  const set = armorSet ? findArmorSet(armorSet) : undefined;
  return [
    ...variants.flatMap((slug) => toLink(lang, "relatedVariant", findEntry(entry.category, slug))),
    ...(set ? [toSetLink(lang, set)] : []),
  ];
}

// The site's sections, in one place: item categories (tab strip, category pages) and the pages that sit
// outside them (hamburger menu, breadcrumbs, llms.txt). Type-only imports: browser scripts (the category
// tabs, the header menu) read this, so it must not pull in the UI dictionaries.
// To add a page: add a row to PAGE_SECTIONS, the page itself under src/pages/[lang]/, and its UI strings.
import type { Category } from "./config";
import type { UiKey } from "./ui-dicts";

export const NAV_GROUPS: readonly { key: UiKey; categories: readonly Category[] }[] = [
  { key: "equipment", categories: ["melee", "ranged", "armor", "artifact", "talisman"] },
  { key: "enchanting", categories: ["enchantment", "effect"] },
];

// Published categories. Enchantment books have no pages of their own: each one is shown on the
// enchantment it grants. Statuses, capes, pets and skins are still extracted but not published for now.
export const GRID_CATEGORIES = ["melee", "ranged", "artifact", "talisman", "enchantment"] as const satisfies readonly Category[];
export const TABLE_CATEGORIES = ["effect"] as const satisfies readonly Category[];

export interface PageSection {
  /** Path segment after the language: /<lang>/<segment>/. */
  readonly segment: string;
  /** The hamburger menu label. */
  readonly key: UiKey;
  /** The page's name in breadcrumbs and llms.txt when it differs from the menu label. */
  readonly title?: UiKey;
  /** Listed in llms.txt with this intro line, in `rank` order (the guides are written out there by hand). */
  readonly llms?: { readonly intro: UiKey; readonly rank: number };
}

/** Pages outside the item categories, in hamburger menu order. */
export const PAGE_SECTIONS: readonly PageSection[] = [
  { segment: "map", key: "map", title: "worldMap", llms: { intro: "mapIntro", rank: 5 } },
  { segment: "achievements", key: "achievements", llms: { intro: "achievementsIntro", rank: 7 } },
  { segment: "mobs", key: "mobs", llms: { intro: "mobsIntro", rank: 1 } },
  { segment: "soul-storm", key: "soulStorm", llms: { intro: "soulStormIntro", rank: 6 } },
  { segment: "build", key: "build", llms: { intro: "buildIntro", rank: 8 } },
  { segment: "compare", key: "weaponCompare", llms: { intro: "weaponCompareIntro", rank: 9 } },
  { segment: "drops", key: "dropCalc", llms: { intro: "dropCalcIntro", rank: 10 } },
  { segment: "guides", key: "guides" },
  { segment: "quests", key: "quests", llms: { intro: "questsIntro", rank: 4 } },
  { segment: "locations", key: "locations", llms: { intro: "locationsIntro", rank: 3 } },
  { segment: "bosses", key: "bosses", llms: { intro: "bossesIntro", rank: 2 } },
];

export interface MenuItem {
  readonly key: UiKey;
  readonly segment: string;
}

// The derived lists are marked pure: the category tabs script imports this module, and unused ones must not ship in it.
export const SITE_MENU: readonly MenuItem[] = /* @__PURE__ */ PAGE_SECTIONS.map(({ key, segment }) => ({ key, segment }));

/** Whether `pathname` is the menu page `segment` in some language (/<base>/<lang>/<segment>/). */
export function isMenuPage(pathname: string, base: string, segment: string): boolean {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, "");
  const parts = rest.split("/").filter(Boolean);
  return parts.length === 2 && parts[1] === segment;
}

/** The page section a first path segment names, if any. */
export const pageSection = (segment: string): PageSection | undefined =>
  PAGE_SECTIONS.find((section) => section.segment === segment);

/** The key naming a page section in breadcrumbs and llms.txt. */
export const sectionTitle = (section: PageSection): UiKey => section.title ?? section.key;

type LlmsSection = PageSection & { readonly llms: NonNullable<PageSection["llms"]> };

/** The sections llms.txt lists after the item catalog, in its own order. */
const withLlms = (section: PageSection): readonly LlmsSection[] => (section.llms === undefined ? [] : [{ ...section, llms: section.llms }]);
const byRank = (a: LlmsSection, b: LlmsSection): number => a.llms.rank - b.llms.rank;
export const LLMS_SECTIONS: readonly LlmsSection[] = /* @__PURE__ */ [...PAGE_SECTIONS.flatMap(withLlms)].sort(byRank);

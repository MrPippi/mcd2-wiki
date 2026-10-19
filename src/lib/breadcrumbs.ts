/** The breadcrumb trail of a page, read from its path: home, the section it belongs to, the page. Server-side only. */
import type { Category } from "../../scripts/extract/config";
import { categoryLabel, t, type Lang } from "./i18n";
import { pageSection, sectionTitle } from "./sections";
import { TAB_ORDER } from "./tabs";
import { withBase } from "./url";

export interface PageCrumb {
  readonly name: string;
  readonly href: string;
}

/** Item categories (the tab strip) and page sections each have an index page that a deeper path can sit under. */
const CATEGORY_SECTIONS: ReadonlySet<string> = new Set<Category>(TAB_ORDER);

function sectionName(segment: string, lang: Lang): string | undefined {
  if (CATEGORY_SECTIONS.has(segment)) return categoryLabel(segment as Category, lang);
  const section = pageSection(segment);
  return section === undefined ? undefined : t(lang, sectionTitle(section));
}

/** Home › section › page; empty on a language home. A section the site cannot name is left out. */
export function breadcrumbTrail(pathname: string, base: string, lang: Lang, title: string): readonly PageCrumb[] {
  const prefix = withBase(base, `${lang}/`);
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  const segments = rest.split("/").filter((segment) => segment !== "");
  if (segments.length === 0) return [];
  const home = { name: t(lang, "home"), href: prefix };
  const page = { name: title, href: pathname };
  const section = segments.length > 1 ? sectionName(segments[0], lang) : undefined;
  return section === undefined ? [home, page] : [home, { name: section, href: `${prefix}${segments[0]}/` }, page];
}

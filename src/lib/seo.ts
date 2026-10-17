/** Search-engine and answer-engine metadata: page summaries and schema.org JSON-LD. Pure, no Astro imports. */
import { metaDescription } from "./meta";

/** The game every page is about, as schema.org names it. */
export const GAME = { "@type": "VideoGame", name: "Minecraft Dungeons II" } as const;
const CONTEXT = "https://schema.org";
const SNIPPET_LENGTH = 160;

export interface Crumb {
  readonly name: string;
  readonly url: string;
}

/** `path` made absolute when the deployed site address is known (SITE_URL at build time), as is otherwise. */
export const absoluteUrl = (path: string, site: URL | undefined): string => (site ? new URL(path, site).href : path);

interface SummaryInput {
  readonly description: string;
  readonly title: string;
  readonly tagline: string;
  readonly home?: boolean;
}

/** The meta description: the page's own text, else its title ahead of the tagline so no two pages share one. */
export function pageSummary({ description, title, tagline, home = false }: SummaryInput): string {
  const own = description.trim();
  const text = own !== "" ? own : home ? tagline : `${title} — ${tagline}`;
  return metaDescription(text, SNIPPET_LENGTH);
}

/** JSON for an inline script element: `<`, `>` and `&` escaped so page text cannot close the element. */
export const serializeJsonLd = (data: unknown): string =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

export const breadcrumbLd = (crumbs: readonly Crumb[]) => ({
  "@context": CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: crumb.url })),
});

interface WebsiteInput {
  readonly name: string;
  readonly url: string;
  readonly lang: string;
  readonly description: string;
  readonly searchUrl: string;
}

/** The site itself, with the search page as its search action (it reads `?q=`). */
export const websiteLd = ({ name, url, lang, description, searchUrl }: WebsiteInput) => ({
  "@context": CONTEXT,
  "@type": "WebSite",
  name,
  url,
  description,
  inLanguage: lang,
  about: GAME,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${searchUrl}?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

interface ArticleInput {
  readonly headline: string;
  readonly description: string;
  readonly url: string;
  readonly lang: string;
  readonly siteName: string;
  readonly siteUrl: string;
}

/** A mechanics guide. */
export const articleLd = ({ headline, description, url, lang, siteName, siteUrl }: ArticleInput) => ({
  "@context": CONTEXT,
  "@type": "Article",
  headline,
  description,
  mainEntityOfPage: url,
  inLanguage: lang,
  about: GAME,
  publisher: { "@type": "Organization", name: siteName, url: siteUrl },
});

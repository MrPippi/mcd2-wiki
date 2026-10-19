import type { Lang } from "../../shared/config";
import type { Entry } from "../../shared/schemas";

// Categories listed as table rows, linked by anchor. A superset of sections.ts TABLE_CATEGORIES (statuses have no page
// yet); kept local because url.ts is bundled into browser scripts, and importing sections would add a shared chunk.
const TABLE_CATEGORIES: ReadonlySet<Entry["category"]> = new Set(["effect", "status"]);
const ensureSlash = (base: string): string => (base.endsWith("/") ? base : `${base}/`);

export const withBase = (base: string, path: string): string => `${ensureSlash(base)}${path.replace(/^\//, "")}`;

export const href = (lang: Lang, ...segments: string[]): string =>
  withBase(import.meta.env.BASE_URL, `${[lang, ...segments].map(encodeURIComponent).join("/")}/`);

export const assetUrl = (path: string): string => withBase(import.meta.env.BASE_URL, path);

export function swapLangPath(pathname: string, base: string, target: Lang): string {
  const prefix = ensureSlash(base);
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, "");
  const [, ...tail] = rest.split("/");
  return `${prefix}${[target, ...tail].join("/")}`;
}

export function entryHref(lang: Lang, entry: Entry): string {
  if (entry.category === "armor") return href(lang, "armor", "piece", entry.slug);
  if (entry.category === "enchantment-book") return href(lang, "enchantment", entry.links.enchantment ?? entry.slug);
  if (TABLE_CATEGORIES.has(entry.category)) return `${href(lang, entry.category)}#${entry.slug}`;
  return href(lang, entry.category, entry.slug);
}

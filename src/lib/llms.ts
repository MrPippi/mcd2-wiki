/** The /llms.txt file (https://llmstxt.org): a Markdown map of the site for answer engines and AI assistants. Server-side only. */
import { ALL_LANGS, LANG_META } from "../../shared/config";
import { GAME_VERSION } from "./game-version";
import { GUIDES } from "./guides";
import { categoryLabel, t, type Lang } from "./i18n";
import { LLMS_SECTIONS, sectionTitle } from "../../shared/sections";
import { absoluteUrl } from "./seo";
import { TAB_ORDER } from "../../shared/tabs";
import { withBase } from "./url";

/** The languages written by hand, so the ones an assistant should quote first. */
const LISTED: readonly Lang[] = ["en", "zh"];

const link = (name: string, url: string, note?: string): string => `- [${name}](${url})${note ? `: ${note}` : ""}`;

function languageSection(lang: Lang, url: (path: string) => string): string[] {
  return [
    `## ${LANG_META[lang].nativeName}`,
    "",
    ...TAB_ORDER.map((category) => link(categoryLabel(category, lang), url(`${lang}/${category}/`))),
    ...LLMS_SECTIONS.map((section) => link(t(lang, sectionTitle(section)), url(`${lang}/${section.segment}/`), t(lang, section.llms.intro))),
    link(t(lang, "guides"), url(`${lang}/guides/`), t(lang, "guidesIntro")),
    ...GUIDES.map((guide) => link(t(lang, guide.title), url(`${lang}/guides/${guide.slug}/`), t(lang, guide.summary))),
    "",
  ];
}

export function llmsTxt(site: URL | undefined, base: string): string {
  const url = (path: string): string => absoluteUrl(withBase(base, path), site);
  return [
    `# ${t("en", "siteTitle")}`,
    "",
    `> ${t("en", "tagline")}`,
    "",
    `An unofficial fan wiki for the video game Minecraft Dungeons II. Every name, stat and description is read from the game's own data files (game version ${GAME_VERSION}), so the wording matches the game in each of its ${ALL_LANGS.length} languages. Every page exists in every language under /<language code>/ with the same path after it.`,
    "",
    ...LISTED.flatMap((lang) => languageSection(lang, url)),
    "## Languages",
    "",
    ...ALL_LANGS.map((lang) => link(LANG_META[lang].nativeName, url(`${lang}/`))),
    "",
    "## Optional",
    "",
    link("Sitemap", url("sitemap-index.xml"), "every page in every language"),
    link("Source code and issue tracker", "https://github.com/MrPippi/mcd2-wiki"),
    "",
  ].join("\n");
}

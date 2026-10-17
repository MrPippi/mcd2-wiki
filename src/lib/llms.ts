/** The /llms.txt file (https://llmstxt.org): a Markdown map of the site for answer engines and AI assistants. Server-side only. */
import { ALL_LANGS, LANG_META, type Category } from "../../scripts/extract/config";
import { GAME_VERSION } from "./game-version";
import { GUIDES } from "./guides";
import { categoryLabel, t, type Lang, type UiKey } from "./i18n";
import { absoluteUrl } from "./seo";
import { withBase } from "./url";

const CATALOG: readonly Category[] = ["melee", "ranged", "armor", "artifact", "talisman", "enchantment", "effect"];
/** Pages outside the item catalog, with the intro line each one opens with. */
const PAGES: readonly { readonly path: string; readonly title: UiKey; readonly intro: UiKey }[] = [
  { path: "mobs", title: "mobs", intro: "mobsIntro" },
  { path: "bosses", title: "bosses", intro: "bossesIntro" },
  { path: "locations", title: "locations", intro: "locationsIntro" },
  { path: "quests", title: "quests", intro: "questsIntro" },
  { path: "map", title: "worldMap", intro: "mapIntro" },
  { path: "soul-storm", title: "soulStorm", intro: "soulStormIntro" },
  { path: "achievements", title: "achievements", intro: "achievementsIntro" },
  { path: "build", title: "build", intro: "buildIntro" },
  { path: "compare", title: "weaponCompare", intro: "weaponCompareIntro" },
];
/** The languages written by hand, so the ones an assistant should quote first. */
const LISTED: readonly Lang[] = ["en", "zh"];

const link = (name: string, url: string, note?: string): string => `- [${name}](${url})${note ? `: ${note}` : ""}`;

function languageSection(lang: Lang, url: (path: string) => string): string[] {
  return [
    `## ${LANG_META[lang].nativeName}`,
    "",
    ...CATALOG.map((category) => link(categoryLabel(category, lang), url(`${lang}/${category}/`))),
    ...PAGES.map((page) => link(t(lang, page.title), url(`${lang}/${page.path}/`), t(lang, page.intro))),
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

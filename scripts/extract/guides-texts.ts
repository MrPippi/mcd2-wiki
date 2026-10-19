/** The game's own texts the guides quote, rendered to HTML in every language, with the languages that fall back to English. */
import { localizedFrom } from "../../src/lib/lang";
import type { Lang } from "./config";
import type { GuideText, TextId } from "./guides-schema";
import type { TextDataValue } from "./guides-tables";
import { issue, type Issue } from "./issues";
import { gameHtml } from "./game-text";
import { locRef } from "./loc-table";
import type { LocaleFile } from "./schemas";

export type Locales = Readonly<Record<Lang, LocaleFile>>;

interface TextKey {
  readonly namespace: string;
  readonly key: string;
}

const RELEASE = "Text/Release/";
const VENDOR = `${RELEASE}VendorLabels.csv`;
const ONBOARDING = `${RELEASE}OnboardingLabels.csv`;
const vendor = (key: string): TextKey => ({ namespace: VENDOR, key });
const onboarding = (key: string): TextKey => ({ namespace: ONBOARDING, key });

export const GUIDE_TEXT_KEYS: Readonly<Record<TextId, TextKey>> = {
  echoShards: onboarding("tutoriallog_springstones_title"),
  emeralds: onboarding("tutoriallog_emeralds_title"),
  enchantmentPoints: onboarding("tutoriallog_enchantmentpoints_title"),
  merchantName: vendor("vendor_village_merchant_title"),
  blacksmithName: vendor("vendor_blacksmith_title"),
  enchantsmithName: vendor("vendor_enchantsmith_title"),
  merchantIntro: onboarding("panel_villagemerchant_overview_description1"),
  blacksmithIntro: onboarding("panel_blacksmith_overview_description1"),
  enchantsmithIntro: onboarding("panel_enchantsmith_overview_description1"),
  merchantLevel2: vendor("vendor_village_merchant_level2"),
  merchantLevel3: vendor("vendor_village_merchant_level3"),
  blacksmithLevel2: vendor("vendor_blacksmith_level2"),
  blacksmithLevel3: vendor("vendor_blacksmith_level3"),
  enchantsmithLevel2: vendor("vendor_enchantsmith_level2"),
  enchantsmithLevel3: vendor("vendor_enchantsmith_level3"),
  merchantTutorial: onboarding("tutoriallog_villagemerchant_description"),
  enchantsmithTutorial: onboarding("tutoriallog_enchantsmith_description"),
  enchantmentPointsTutorial: onboarding("tutoriallog_enchantmentpoints_description"),
  echoShardsTutorial: onboarding("tutoriallog_springstones_description"),
  levelingTitle: onboarding("tutoriallog_levelingup_title"),
  levelingTutorial: onboarding("tutoriallog_levelingup_description"),
};

/** Translations with a known language problem: per the site's policy these languages show English and are marked untranslated. */
export const GUIDE_ENGLISH_ONLY: Readonly<Partial<Record<TextId, { readonly langs: readonly Lang[]; readonly reason: string }>>> = {
  enchantmentPoints: { langs: ["nl"], reason: "The Dutch title reads \"Betoveringsboeken\" (enchantment books), not points." },
};

export const EMPTY_TEXT: GuideText = { html: localizedFrom(() => ""), untranslated: [] };
const label = (namespace: string, key: string): string => `${namespace.slice(RELEASE.length)}/${key}`;

/** One game text in every language; undefined (with an issue) when the game has no English for it. */
export function gameText(locales: Locales, namespace: string, key: string): { text?: GuideText; issues: Issue[] } {
  const text = gameHtml(locales, namespace, key);
  return text ? { text, issues: [] } : { issues: [issue("guides-text-fallback", label(namespace, key))] };
}

/** The text a row's TypeTextData names under `entryTag` (e.g. SW.TextEntry.Name); undefined (with an issue) when the row has none. */
export function rowText(locales: Locales, texts: TextDataValue | undefined, entryTag: string): { text?: GuideText; issues: Issue[] } {
  const entry = Object.entries(texts?.Texts ?? {}).find(([key]) => key === `(TagName="${entryTag}")`);
  const ref = entry ? locRef(entry[1].Text) : undefined;
  return ref ? gameText(locales, ref.namespace, ref.key) : { issues: [issue("guides-text-fallback", entryTag)] };
}

/** The text with the listed languages switched to English and marked untranslated. */
export function englishOnly(text: GuideText, langs: readonly Lang[]): GuideText {
  if (langs.length === 0) return text;
  return {
    html: localizedFrom((lang) => (langs.includes(lang) ? text.html.en : text.html[lang])),
    untranslated: [...new Set([...text.untranslated, ...langs])],
  };
}

/** Every quoted text; a missing one is empty (the page leaves it out) and reported. */
export function buildGuideTexts(locales: Locales): { texts: Record<TextId, GuideText>; issues: Issue[] } {
  const built = (Object.entries(GUIDE_TEXT_KEYS) as [TextId, TextKey][]).map(([id, { namespace, key }]) => [id, gameText(locales, namespace, key)] as const);
  return {
    texts: Object.fromEntries(built.map(([id, result]) => [id, result.text ? englishOnly(result.text, GUIDE_ENGLISH_ONLY[id]?.langs ?? []) : EMPTY_TEXT])) as Record<TextId, GuideText>,
    issues: built.flatMap(([, result]) => result.issues),
  };
}

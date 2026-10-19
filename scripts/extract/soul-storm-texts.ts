/** The game's own Soul Storm texts, rendered to HTML in every language. The tutorial's second paragraph is out of date, so only the first is published. */
import { localizedFrom } from "../../shared/lang";
import type { Lang } from "../../shared/config";
import { issue, type Issue } from "./issues";
import { gameHtml, type Accept } from "./game-text";
import type { LocaleFile } from "../../shared/schemas";
import { TEXT_IDS, type SoulStormData, type TextId } from "../../shared/soul-storm-schema";

type Locales = Readonly<Record<Lang, LocaleFile>>;
type Text = SoulStormData["texts"][TextId];

interface TextKey {
  readonly namespace: string;
  readonly key: string;
  readonly firstParagraph?: true;
}

const RELEASE = "Text/Release/";
const AREA_MOD = "SW_AreaModification_SoulStorm_SW_TextEntry_Soulstorm_";
const UI_TYPES = `${RELEASE}DT_UITypeDataDefinition.csv`;
const ONBOARDING = `${RELEASE}OnboardingLabels.csv`;
const PARAGRAPH_BREAK = /\r?\n[ \t]*\r?\n/;

export const SOUL_STORM_TEXT_KEYS: Readonly<Record<TextId, TextKey>> = {
  title: { namespace: ONBOARDING, key: "tutoriallog_soulstorms_title" },
  overview1: { namespace: ONBOARDING, key: "panel_soulstorm_overview_description_1" },
  overview2: { namespace: ONBOARDING, key: "panel_soulstorm_overview_description_2" },
  tutorial: { namespace: ONBOARDING, key: "tutoriallog_soulstorms_description", firstParagraph: true },
  objective: { namespace: UI_TYPES, key: `${AREA_MOD}Entered_Description` },
  generatorHint: { namespace: UI_TYPES, key: `${AREA_MOD}Storminator_Hint` },
  shieldHint: { namespace: UI_TYPES, key: `${AREA_MOD}Shieldinator_Hint` },
  extraEffect: { namespace: `${RELEASE}LootItemPanelLabels.csv`, key: "SoulStormMessage" },
  generatorName: { namespace: `${RELEASE}DT_SoulStormPropActorDefinition.csv`, key: "SW_PropActor_SoulStorm_Storminator_Base_SW_TextEntry_Name" },
};

/** The first of at least two paragraphs; a text with fewer than two has nothing we can vouch for. */
export function firstParagraph(text: string): string | undefined {
  const parts = text.split(PARAGRAPH_BREAK);
  return parts.length < 2 ? undefined : parts[0].trim();
}

const EMPTY_TEXT: Text = { html: localizedFrom(() => ""), untranslated: [] };
const label = (entry: TextKey): string => `${entry.namespace.slice(RELEASE.length)}/${entry.key}`;

const firstOnly: Accept = (_lang, text) => (text === undefined ? undefined : firstParagraph(text));

function buildOne(locales: Locales, entry: TextKey): { text: Text; issues: Issue[] } {
  const text = gameHtml(locales, entry.namespace, entry.key, entry.firstParagraph ? firstOnly : undefined);
  return text ? { text, issues: [] } : { text: EMPTY_TEXT, issues: [issue("soul-storm-text-fallback", label(entry))] };
}

export function buildSoulStormTexts(locales: Locales): { texts: SoulStormData["texts"]; issues: Issue[] } {
  const one = (id: TextId) => buildOne(locales, SOUL_STORM_TEXT_KEYS[id]);
  const built = {
    title: one("title"), overview1: one("overview1"), overview2: one("overview2"), tutorial: one("tutorial"), objective: one("objective"),
    generatorHint: one("generatorHint"), shieldHint: one("shieldHint"), extraEffect: one("extraEffect"), generatorName: one("generatorName"),
  } satisfies Record<TextId, { text: Text; issues: Issue[] }>;
  const texts = {
    title: built.title.text, overview1: built.overview1.text, overview2: built.overview2.text, tutorial: built.tutorial.text, objective: built.objective.text,
    generatorHint: built.generatorHint.text, shieldHint: built.shieldHint.text, extraEffect: built.extraEffect.text, generatorName: built.generatorName.text,
  } satisfies SoulStormData["texts"];
  return { texts, issues: TEXT_IDS.flatMap((id) => built[id].issues) };
}

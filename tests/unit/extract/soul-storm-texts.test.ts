import { describe, expect, it } from "vitest";
import { buildSoulStormTexts, firstParagraph } from "../../../scripts/extract/soul-storm-texts";
import { makeSparseLocales as locales } from "../../helpers/locales";

const ON = "Text/Release/OnboardingLabels.csv";
const TUTORIAL_EN = "Soul Storms are high paced combat areas that have increased quantity and re-spawn rate of hostile mobs. If you defeat a Soul Storm, you will be generously rewarded. \n\nThey appear randomly in the world every hour and last for around 40 minutes.";
const TUTORIAL_ZH = "靈魂風暴是節奏快速的戰鬥區域，其中敵對怪物的數量與重生率都會提高。平息靈魂風暴後，你將會獲得豐厚的獎勵。\n\n靈魂風暴每小時都會隨機出現在世界中，並持續約 40 分鐘。";

describe("firstParagraph", () => {
  it("keeps only the first of two paragraphs", () => {
    expect(firstParagraph(TUTORIAL_EN)).toBe("Soul Storms are high paced combat areas that have increased quantity and re-spawn rate of hostile mobs. If you defeat a Soul Storm, you will be generously rewarded.");
    expect(firstParagraph("a\r\n\r\nb")).toBe("a");
  });
  it("has nothing when the text is one paragraph", () => {
    expect(firstParagraph("one paragraph only")).toBeUndefined();
  });
});

describe("buildSoulStormTexts", () => {
  const loc = locales({
    [ON]: {
      tutoriallog_soulstorms_title: { en: "Soul Storms", zh: "靈魂風暴" },
      tutoriallog_soulstorms_description: { en: TUTORIAL_EN, zh: TUTORIAL_ZH, ja: "一段だけ" },
      panel_soulstorm_overview_description_1: { en: "Destroy the <emphasis>Storm Generators</>.", zh: "摧毀<emphasis>風暴產生器</>。" },
    },
  });

  it("never publishes the stale second paragraph in any language", () => {
    const { texts } = buildSoulStormTexts(loc);
    for (const html of Object.values(texts.tutorial.html)) {
      expect(html).not.toMatch(/40/);
      expect(html).not.toMatch(/every hour|每小時/);
    }
    expect(texts.tutorial.html.zh).toBe("靈魂風暴是節奏快速的戰鬥區域，其中敵對怪物的數量與重生率都會提高。平息靈魂風暴後，你將會獲得豐厚的獎勵。");
  });

  it("falls back to the English first paragraph where a language cannot be split", () => {
    const { texts } = buildSoulStormTexts(loc);
    expect(texts.tutorial.html.ja).toBe(texts.tutorial.html.en);
    expect(texts.tutorial.untranslated).toContain("ja");
    expect(texts.tutorial.untranslated).not.toContain("zh");
  });

  it("renders the game's emphasis markup", () => {
    expect(buildSoulStormTexts(loc).texts.overview1.html.zh).toBe('摧毀<em class="emphasis">風暴產生器</em>。');
  });

  it("leaves a text empty and reports it when the game has no English", () => {
    const { texts, issues } = buildSoulStormTexts(loc);
    expect(texts.extraEffect.html.en).toBe("");
    expect(issues).toContainEqual({ type: "soul-storm-text-fallback", detail: "LootItemPanelLabels.csv/SoulStormMessage" });
  });

  it("treats a tutorial whose English has one paragraph as missing in every language", () => {
    const one = locales({ [ON]: { tutoriallog_soulstorms_description: { en: "Only one.", zh: TUTORIAL_ZH } } });
    const { texts, issues } = buildSoulStormTexts(one);
    expect(Object.values(texts.tutorial.html).every((html) => html === "")).toBe(true);
    expect(issues).toContainEqual({ type: "soul-storm-text-fallback", detail: "OnboardingLabels.csv/tutoriallog_soulstorms_description" });
  });
});

import { describe, expect, it } from "vitest";
import { descriptionIsCompletedText, hasLabel, QUEST_COMPLETED, QUEST_DESCRIPTIONS, QUEST_LABELS, questHtml, questText } from "../../../scripts/extract/quest-texts";
import { LANGS } from "../../../shared/langs";
import { makeSparseLocales } from "../../helpers/locales";

const LOCALES = makeSparseLocales({
  [QUEST_LABELS]: {
    CA02: { en: "The Silence in Little Howl", zh: "小嚎村的寂靜", ja: "ERROR", de: "" },
    TOa1_S01_A: { en: "ERROR", zh: "錯誤" },
  },
  [QUEST_DESCRIPTIONS]: { CA02: { en: "The <emphasis>Illager</> council", zh: "<emphasis>壞村民</>議會" } },
});

describe("questText", () => {
  it("shows English for a language with no text, an empty text or ERROR, and lists it", () => {
    const found = questText(LOCALES, QUEST_LABELS, "CA02");
    expect(found?.text.zh).toBe("小嚎村的寂靜");
    expect(found?.text.ja).toBe("The Silence in Little Howl");
    expect(found?.text.de).toBe("The Silence in Little Howl");
    expect(found?.untranslated).toEqual(LANGS.filter((lang) => lang !== "zh" && lang !== "en"));
  });
  it("has no text when English is missing or ERROR", () => {
    expect(questText(LOCALES, QUEST_LABELS, "TOa1_S01_A")).toBeUndefined();
    expect(questText(LOCALES, QUEST_LABELS, "CA04_BR")).toBeUndefined();
  });
});

describe("questHtml", () => {
  it("renders the game's emphasis markup", () => {
    const found = questHtml(LOCALES, QUEST_DESCRIPTIONS, "CA02");
    expect(found?.html.en).toBe('The <em class="emphasis">Illager</em> council');
    expect(found?.html.zh).toBe('<em class="emphasis">壞村民</em>議會');
    expect(found?.untranslated).toContain("ru");
  });
  it("has no html without English", () => {
    expect(questHtml(LOCALES, QUEST_DESCRIPTIONS, "NOPE")).toBeUndefined();
  });
});

describe("hasLabel", () => {
  it("is true only for a usable English label", () => {
    expect(hasLabel(LOCALES, "CA02")).toBe(true);
    expect(hasLabel(LOCALES, "TOa1_S01_A")).toBe(false);
    expect(hasLabel(LOCALES, "CA04_BR")).toBe(false);
  });
});

describe("descriptionIsCompletedText", () => {
  const locales = makeSparseLocales({
    [QUEST_DESCRIPTIONS]: {
      BEES: { en: "Help the Beekeeper build hives.", zh: "你已經做好了新的蜂箱。", ja: "巣箱を作ってほしい。" },
      SAME: { en: "Same text.", zh: "同樣的文字。" },
    },
    [QUEST_COMPLETED]: {
      BEES: { en: "You built the hives.", zh: "你已經做好了 新的蜂箱。\r\n", ja: "巣箱を作った。" },
      SAME: { en: "Same text.", zh: "同樣的文字。" },
    },
  });

  it("shows English for a language whose description is its own completed text, and lists it", () => {
    const found = questHtml(locales, QUEST_DESCRIPTIONS, "BEES", descriptionIsCompletedText(locales, "BEES"));
    expect(found?.html.zh).toBe("Help the Beekeeper build hives.");
    expect(found?.html.ja).toBe("巣箱を作ってほしい。");
    expect(found?.untranslated).toContain("zh");
    expect(found?.untranslated).not.toContain("ja");
  });

  it("keeps the text when English uses the same words for both", () => {
    const found = questHtml(locales, QUEST_DESCRIPTIONS, "SAME", descriptionIsCompletedText(locales, "SAME"));
    expect(found?.html.zh).toBe("同樣的文字。");
    expect(found?.untranslated).not.toContain("zh");
  });
});

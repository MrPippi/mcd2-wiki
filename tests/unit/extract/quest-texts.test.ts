import { describe, expect, it } from "vitest";
import { hasLabel, QUEST_DESCRIPTIONS, QUEST_LABELS, questHtml, questText } from "../../../scripts/extract/quest-texts";
import { LANGS } from "../../../scripts/extract/langs";
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

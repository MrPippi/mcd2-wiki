import { describe, expect, it } from "vitest";
import { applyEnglishOverrides, ENGLISH_OVERRIDES } from "../../../scripts/extract/text-overrides";
import { effectEntry, QUIVER_TEXT, talismanEntry } from "../../helpers/talisman-tables";

const quiver = effectEntry("ammo-capacity", "AmmoCapacity", QUIVER_TEXT, ["de"]);
const wolf = talismanEntry("wolf", "Talisman_Wolf", { en: "Summons a furry friend!", zh: "召喚夥伴！" });

describe("applyEnglishOverrides", () => {
  const overrides = [{ category: "effect" as const, id: "AmmoCapacity", field: "description" as const, langs: ["zh" as const, "ja" as const], reason: "count word" }];
  const [fixed, untouched] = applyEnglishOverrides([quiver, wolf], overrides);

  it("shows the English text in the listed languages and marks them untranslated", () => {
    expect(fixed?.description?.zh).toBe(QUIVER_TEXT.en);
    expect(fixed?.description?.ja).toBe(QUIVER_TEXT.en);
    expect(fixed?.description?.ko).toBe(QUIVER_TEXT.ko);
    expect(fixed?.untranslated).toEqual(["de", "zh", "ja"]);
  });

  it("leaves other entries and its input alone", () => {
    expect(untouched).toBe(wolf);
    expect(quiver.description?.zh).toBe(QUIVER_TEXT.zh);
    expect(quiver.untranslated).toEqual(["de"]);
  });

  it("skips an entry without the overridden field", () => {
    const bare = { ...quiver, description: undefined };
    expect(applyEnglishOverrides([bare], overrides)[0]).toBe(bare);
  });
});

describe("applyEnglishOverrides with replacements", () => {
  const overrides = [
    { category: "effect" as const, id: "AmmoCapacity", field: "description" as const, langs: ["zh" as const, "ja" as const], reason: "count word", replacements: { zh: "箭矢攜帶量提高 {0}。" } },
  ];
  const slot = '<span class="placeholder" data-slot="0">{value}</span>';
  const withZhGap = { ...quiver, untranslated: ["de" as const, "zh" as const] };
  const [fixed] = applyEnglishOverrides([withZhGap], overrides);

  it("uses the replacement with the English value markup and keeps the rest English", () => {
    expect(fixed?.description?.zh).toBe(`箭矢攜帶量提高 ${slot}。`);
    expect(fixed?.description?.ja).toBe(QUIVER_TEXT.en);
  });

  it("marks only the languages without a replacement as untranslated", () => {
    expect(fixed?.untranslated).toEqual(["de", "ja"]);
  });

  it("keeps an unknown slot token as written", () => {
    const odd = [{ ...overrides[0]!, replacements: { zh: "共 {3} 支" } }];
    expect(applyEnglishOverrides([quiver], odd)[0]?.description?.zh).toBe("共 {3} 支");
  });
});

describe("ENGLISH_OVERRIDES", () => {
  it("sends the Quiver sentence to English where a percentage lands on a count word", () => {
    const quiverOverride = ENGLISH_OVERRIDES.find((override) => override.id === "AmmoCapacity");
    expect(quiverOverride?.category).toBe("effect");
    expect([...(quiverOverride?.langs ?? [])].sort()).toEqual(["es", "fr", "ja", "ko", "ru", "zh"]);
  });

  it("gives Traditional Chinese a percentage sentence", () => {
    const quiverOverride = ENGLISH_OVERRIDES.find((override) => override.id === "AmmoCapacity");
    expect(quiverOverride?.replacements?.zh).toBe("箭矢攜帶量提高 {0}。");
  });
});

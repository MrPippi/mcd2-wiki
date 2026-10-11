import { describe, expect, it } from "vitest";
import { buildTalismanData, withTalismanDescriptions } from "../../../scripts/extract/talismans";
import { TALISMAN_EFFECTS, TALISMAN_ENTRIES, TALISMAN_TABLES, QUIVER_TEXT, talismanEntry } from "../../helpers/talisman-tables";

describe("buildTalismanData", () => {
  const { data, issues } = buildTalismanData(TALISMAN_ENTRIES, TALISMAN_TABLES, TALISMAN_EFFECTS);

  it("prints each level's effect template magnitude the way the effect's description does (1.2 → 20%)", () => {
    expect(data["ammo-capacity"]).toEqual({
      effect: "ammo-capacity",
      levels: [
        { values: ["20%"], xpToNextLevel: 18480 },
        { values: ["40%"], xpToNextLevel: 73920 },
        { values: ["60%"] },
      ],
    });
  });

  it("applies the description's multiplier, so a cooldown reduction of -0.1 prints as 10%", () => {
    expect(data["potion-cooldown"]?.levels.map((level) => level.values)).toEqual([["10%"], ["15%"], ["25%"]]);
  });

  it("uses the fixed value when a template has one, ignoring its min/max roll range", () => {
    expect(data["ranged-buff"]).toMatchObject({ effect: "power", levels: [{ values: ["10%"] }, { values: ["15%"] }, { values: ["25%"] }] });
  });

  it("marks the talismans of the SecretTalismans collection, and only those", () => {
    expect(data["potion-cooldown"]?.secret).toBe(true);
    expect(data["ranged-buff"]?.secret).toBe(true);
    expect(data["ammo-capacity"]?.secret).toBeUndefined();
  });

  it("gives companion talismans their per-level multipliers and base cooldown, matching tags regardless of case", () => {
    expect(data.wolf).toEqual({
      cooldownSeconds: 30,
      levels: [
        { xpToNextLevel: 18480, companion: { attack: 1, defence: 1, cooldown: 1 } },
        { xpToNextLevel: 73920, companion: { attack: 1.2, defence: 0.8, cooldown: 0.8 } },
        { companion: { attack: 1.65, defence: 0.5, cooldown: 0.75 } },
      ],
    });
    expect(data.llama?.levels[2]?.companion).toEqual({ attack: 1.5, defence: 0.5, cooldown: 0.75 });
  });

  it("keeps a talisman's own text and leaves values out when the game computes them in code", () => {
    expect(data["healthy-strike"]).toEqual({ valuesUnknown: true, levels: [{ xpToNextLevel: 18480 }, { xpToNextLevel: 73920 }, {}] });
  });

  it("leaves values out for a template without a fixed value, and reports it", () => {
    expect(data.rolled?.levels.every((level) => level.values === undefined)).toBe(true);
    expect(data.rolled?.effect).toBeUndefined();
    expect(issues).toContainEqual({ type: "talisman-no-values", detail: "Talisman_Rolled" });
    expect(issues).toContainEqual({ type: "talisman-no-values", detail: "Talisman_HealthyStrike" });
    expect(issues.map((issue) => issue.detail)).not.toContain("Talisman_Wolf");
  });

  it("skips rows with no site entry", () => {
    const only = buildTalismanData([talismanEntry("wolf", "Talisman_Wolf", { en: "Wolf" })], TALISMAN_TABLES, TALISMAN_EFFECTS);
    expect(Object.keys(only.data)).toEqual(["wolf"]);
  });
});

describe("withTalismanDescriptions", () => {
  const { data } = buildTalismanData(TALISMAN_ENTRIES, TALISMAN_TABLES, TALISMAN_EFFECTS);
  const result = withTalismanDescriptions(TALISMAN_ENTRIES, data);
  const find = (category: string, slug: string) => result.find((entry) => entry.category === category && entry.slug === slug);

  it("gives a talisman with only a developer stub its effect's description, with the effect's untranslated languages", () => {
    expect(find("talisman", "ammo-capacity")?.description).toEqual(QUIVER_TEXT);
    expect(find("talisman", "ammo-capacity")?.untranslated).toEqual(["ja"]);
    expect(find("talisman", "potion-cooldown")?.untranslated).toBeUndefined();
  });

  it("shows a text whose values the data lacks in English, with unknown markers, untranslated in every other language", () => {
    const strike = find("talisman", "healthy-strike");
    const english = 'Grants a <span class="unknown-value">?</span> damage increase.';
    expect(strike?.description?.en).toBe(english);
    expect(strike?.description?.zh).toBe(english);
    expect(strike?.untranslated).toHaveLength(15);
    expect(strike?.untranslated).not.toContain("en");
  });

  it("leaves other entries alone and does not change its input", () => {
    expect(find("talisman", "wolf")).toBe(TALISMAN_ENTRIES.find((entry) => entry.slug === "wolf"));
    expect(find("talisman", "rolled")?.description).toBeUndefined();
    expect(TALISMAN_ENTRIES.find((entry) => entry.slug === "ammo-capacity" && entry.category === "talisman")?.description).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { issue } from "../../../scripts/extract/issues";
import { renderReport } from "../../../scripts/extract/report";
import { makeEntry } from "../../helpers/entries";

describe("renderReport", () => {
  const entries = [makeEntry("Sword", "melee"), makeEntry("Halberd", "melee", { release: "upcoming" })];

  it("counts entries per category and release", () => {
    expect(renderReport({ entries, armorSets: [], issues: [] })).toContain("| melee | 1 | 1 |");
  });

  it("says there are no issues", () => {
    expect(renderReport({ entries, armorSets: [], issues: [] })).toContain("無問題");
  });

  it("lists issue details grouped by type", () => {
    const report = renderReport({ entries, armorSets: [], issues: [issue("missing-icon", "armor:DiscipleChest")] });
    expect(report).toContain("| missing-icon | 1 |");
    expect(report).toContain("### missing-icon (1)\n\n- armor:DiscipleChest");
  });

  it("only counts noisy issue types", () => {
    const report = renderReport({ entries, armorSets: [], issues: [issue("ignored-field", "A.Description_EffectTotal")] });
    expect(report).toContain("| ignored-field | 1 |");
    expect(report).not.toContain("A.Description_EffectTotal");
  });
});

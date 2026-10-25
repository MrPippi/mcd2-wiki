import { describe, expect, it } from "vitest";
import type { StatusInfo } from "../../../shared/status-schema";
import { findStatus, formatStatusModifier, statusData, statusRows, statusSourceLinks } from "../../../src/lib/statuses";

const status = (fields: Partial<StatusInfo>): StatusInfo => ({ slug: "test", nonStacking: false, duration: 4, modifiers: [], fusions: [], sources: [], ...fields });

describe("formatStatusModifier", () => {
  it("prints multipliers, signed additions and chances", () => {
    expect(formatStatusModifier({ attribute: "movementSpeed", op: "multiply", value: 0.7 }, "en")).toBe("×0.7");
    expect(formatStatusModifier({ attribute: "damage", op: "add", value: -0.5 }, "en")).toBe("−0.5");
    expect(formatStatusModifier({ attribute: "critChance", op: "add", value: 1 }, "en")).toBe("+100%");
  });
});

describe("statusRows", () => {
  it("lists type, duration and stacking before the modifiers", () => {
    const rows = statusRows(status({ alignment: "negative", nonStacking: true, modifiers: [{ attribute: "damageTaken", op: "multiply", value: 1.25 }] }), "en");
    expect(rows.map(({ id, label, value }) => [id, label, value])).toEqual([
      ["alignment", "Type", "Debuff"],
      ["duration", "Default duration", "4 sec"],
      ["stacking", "Stacking", "Does not stack"],
      ["attr:damageTaken:multiply", "Damage taken multiplier", "×1.25"],
    ]);
  });

  it("shows a status that lasts until removed and leaves out unknown alignment and stacking", () => {
    expect(statusRows(status({ duration: null }), "en").map((row) => row.value)).toEqual(["Until removed"]);
  });
});

describe("status data", () => {
  it("links every mob, and every entry the site publishes (effects to their row on the effect list)", () => {
    for (const info of statusData.statuses) {
      const kinds = statusSourceLinks("en", info).map((link) => link.kind);
      expect(kinds).toEqual(kinds.filter((kind) => info.sources.some((source) => source.kind === kind)));
      expect(kinds.filter((kind) => kind === "mob")).toHaveLength(info.sources.filter((source) => source.kind === "mob").length);
    }
    expect(statusSourceLinks("en", findStatus("buff-fire-bracelet")!).map((link) => link.href)).toEqual(["/en/artifact/fire-bracelet/", "/en/effect/#elemental-hit"]);
  });

  it("puts the burning and conductive fusion on both pages", () => {
    expect(findStatus("burning")?.fusions.map((fusion) => fusion.with)).toEqual(["conductive"]);
    expect(findStatus("conductive")?.fusions.map((fusion) => fusion.with)).toEqual(["burning"]);
  });
});

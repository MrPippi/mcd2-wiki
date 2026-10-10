import { describe, expect, it } from "vitest";
import { parseCompatibleEffects, parseFixedBonus, wikiSection } from "../../../scripts/wiki/parse";

const PAGE = [
  "{{Infobox Dungeons II item",
  "| type = Melee Weapon",
  "}}",
  "",
  "== Usage ==",
  "Swing it.",
  "",
  "== Unique effect ==",
  "The fixed effect of the sample blade is {{MCD2|Effect#Fletcher|Fletcher}}, which cannot be rerolled.",
  ": ''Cuts a cooldown by 35%.''",
  "",
  "== Compatible effects ==",
  "Intro sentence.",
  '{| class="wikitable sortable"',
  "! Effect !! Description !! I !! II !! III",
  "|-",
  "| {{MCD2|Effect#Critical Edge|Critical Edge}}",
  "| Crits deal X% more.",
  "| 10%",
  "| 20%",
  "| 30%",
  "|-",
  "| {{MCD2|Effect#Looter|Looter}} || Extra loot. || 20% || 40% || 60%",
  "|}",
  "",
  "=== Notes ===",
  "Still inside the section.",
  "",
  "== Navigation ==",
  "{{Navbox Dungeons II gear|melee}}",
].join("\n");

describe("wikiSection", () => {
  it("returns a level-2 section up to the next level-2 heading, keeping its subsections", () => {
    const section = wikiSection(PAGE, "Compatible effects");
    expect(section).toContain("Critical Edge");
    expect(section).toContain("Still inside the section.");
    expect(section).not.toContain("Navbox");
  });

  it("returns undefined when the page has no such section", () => {
    expect(wikiSection(PAGE, "Trivia")).toBeUndefined();
  });
});

describe("parseCompatibleEffects", () => {
  it("reads each row's effect and its tier I, II and III values, in either cell style", () => {
    expect(parseCompatibleEffects(wikiSection(PAGE, "Compatible effects") ?? "")).toEqual([
      { name: "Critical Edge", values: ["10%", "20%", "30%"] },
      { name: "Looter", values: ["20%", "40%", "60%"] },
    ]);
  });

  it("skips rows that do not name an effect or lack three tiers", () => {
    const section = ["{|", "|-", "| Plain text", "| a", "| 1%", "| 2%", "| 3%", "|-", "| {{MCD2|Effect#Reaper|Reaper}}", "| b", "| 5%", "|}"].join("\n");
    expect(parseCompatibleEffects(section)).toEqual([]);
  });
});

describe("parseFixedBonus", () => {
  it("reads a fixed effect and the first percentage in its description", () => {
    expect(parseFixedBonus(wikiSection(PAGE, "Unique effect") ?? "")).toEqual({ kind: "effect", name: "Fletcher", value: "35%" });
  });

  it("leaves the value out when the description has no percentage", () => {
    const section = "The fixed effect of x is {{MCD2|Effect#Pyrotechnics|Pyrotechnics}}, which cannot be rerolled.\n: ''Hits explode!''";
    expect(parseFixedBonus(section)).toEqual({ kind: "effect", name: "Pyrotechnics" });
  });

  it("reads a fixed enchantment written as plain text or as a direct link", () => {
    expect(parseFixedBonus("The fixed {{MCD2|Enchanting|enchantment}} of x is Gravity Strike, which cannot be rerolled.")).toEqual({
      kind: "enchantment",
      name: "Gravity Strike",
    });
    expect(parseFixedBonus("The fixed {{MCD2|enchantment}} of x is {{MCD2|Shadowclaw}}, which cannot be rerolled.")).toEqual({
      kind: "enchantment",
      name: "Shadowclaw",
    });
  });

  it("returns undefined when the bonus is not named", () => {
    expect(parseFixedBonus("The fixed bonus of x is an {{MCD2|Enchanting|enchantment}}, which cannot be rerolled.")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { entriesIn, findEntry } from "../../../src/lib/data";
import { describedEntry } from "../../../src/lib/gear-values";
import { companionCooldown, isSecretTalisman, talismanLevelsView } from "../../../src/lib/talisman-view";

const talisman = (slug: string) => {
  const entry = findEntry("talisman", slug);
  if (!entry) throw new Error(`talisman ${slug} is not published`);
  return entry;
};

describe("talisman descriptions", () => {
  it("shows the effect's description with the level 1–3 range filled in", () => {
    expect(describedEntry(talisman("ammo-capacity"))?.en).toBe('Carry <span class="value">20%~60%</span> more ammo.');
    expect(describedEntry(talisman("ammo-capacity"))?.zh).toContain('<span class="value">20%~60%</span>');
    expect(describedEntry(talisman("potion-cooldown"))?.ja).toContain('<span class="value">10%~25%</span>');
  });

  it("publishes every talisman whose texts the data can fill, and none with an unfilled value", () => {
    const published = entriesIn("talisman");
    expect(published.length).toBeGreaterThanOrEqual(21);
    for (const entry of published) {
      expect(entry.description, entry.slug).toBeDefined();
      expect(describedEntry(entry)?.en ?? "", entry.slug).not.toContain('class="placeholder"');
    }
  });
});

describe("talismanLevelsView", () => {
  it("lists each level's description and the XP it takes to reach the next", () => {
    const rows = talismanLevelsView("zh", talisman("ammo-capacity"));
    expect(rows?.map((row) => row.label)).toEqual(["1", "2", "3"]);
    expect(rows?.map((row) => row.text?.en)).toEqual([
      'Carry <span class="value">20%</span> more ammo.',
      'Carry <span class="value">40%</span> more ammo.',
      'Carry <span class="value">60%</span> more ammo.',
    ]);
    expect(rows?.map((row) => row.xp)).toEqual(["18480", "73920", "最高等級"]);
  });

  it("gives companions their multipliers per level", () => {
    const rows = talismanLevelsView("en", talisman("wolf"));
    expect(rows?.map((row) => row.companion)).toEqual([
      { attack: "×1", defence: "×1", cooldown: "×1" },
      { attack: "×1.2", defence: "×0.8", cooldown: "×0.8" },
      { attack: "×1.65", defence: "×0.5", cooldown: "×0.75" },
    ]);
    expect(rows?.[0]?.text).toBeUndefined();
    expect(companionCooldown("en", talisman("wolf"))).toBe("30 sec");
    expect(companionCooldown("en", talisman("ammo-capacity"))).toBeUndefined();
  });

  it("is undefined for entries that are not talismans", () => {
    const sword = entriesIn("melee")[0];
    expect(sword && talismanLevelsView("en", sword)).toBeUndefined();
  });
});

describe("isSecretTalisman", () => {
  it("is true for the eight talismans of the game's SecretTalismans collection", () => {
    expect(isSecretTalisman(talisman("potion-cooldown"))).toBe(true);
    expect(isSecretTalisman(talisman("ranged-buff"))).toBe(true);
    expect(isSecretTalisman(talisman("ammo-capacity"))).toBe(false);
  });
});

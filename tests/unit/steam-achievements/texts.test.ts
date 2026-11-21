import { describe, expect, it } from "vitest";
import { mergeSteamTexts, parseSteamPage } from "../../../scripts/steam-achievements/texts";

/** A Steam stats page as the store serves it: the achievements sit in a JSON string inside the SSR data script. */
const page = (rows: readonly { api_name: string; name: string; description: string }[]): string => {
  const loader = JSON.stringify({ groups: [{ achievements: rows.map((row) => ({ internal_key: 1, hidden: false, ...row })) }] });
  return `<html><script type="application/json" id="valve-ssr-data" nonce="x">${JSON.stringify({ loaderData: [loader] })}</script></html>`;
};

const file = {
  source: "Steam",
  retrieved: "2026-10-11",
  achievements: [
    { id: "SHOWN", file: "SHOWN.jpg", globalPercent: 50, name: { en: "One-of-a-Kind", zh: "獨一無二" }, description: { en: "Equip a unique item", zh: "裝備獨特物品" } },
    { id: "HIDDEN", file: "HIDDEN.jpg", globalPercent: 10, name: { en: "Brave the Unknown", zh: "勇闖未知" }, description: { en: "", zh: "" } },
  ],
};

describe("parseSteamPage", () => {
  it("reads each achievement's name and description by its API name", () => {
    const texts = parseSteamPage(page([{ api_name: "SHOWN", name: "Einzigartig", description: "Rüste einen einzigartigen Gegenstand aus" }]));
    expect(texts.get("SHOWN")).toEqual({ name: "Einzigartig", description: "Rüste einen einzigartigen Gegenstand aus" });
  });

  it("fails on a page without the achievement data", () => {
    expect(() => parseSteamPage("<html></html>")).toThrow(/valve-ssr-data/);
  });
});

describe("mergeSteamTexts", () => {
  const german = new Map([
    ["SHOWN", { name: "Einzigartig", description: "Rüste einen einzigartigen Gegenstand aus" }],
    ["HIDDEN", { name: "Wage das Unbekannte", description: "Betritt die Sift" }],
  ]);

  it("adds a language's names and descriptions without touching the input", () => {
    const merged = mergeSteamTexts(file, new Map([["de", german]]), "2026-11-21");
    expect(merged.achievements[0]?.name).toEqual({ en: "One-of-a-Kind", zh: "獨一無二", de: "Einzigartig" });
    expect(merged.achievements[0]?.description.de).toBe("Rüste einen einzigartigen Gegenstand aus");
    expect(merged.textsRetrieved).toBe("2026-11-21");
    expect(merged.retrieved).toBe("2026-10-11");
    expect(file.achievements[0]?.name).toEqual({ en: "One-of-a-Kind", zh: "獨一無二" });
  });

  it("keeps a hidden achievement's description empty, as the English one is", () => {
    const merged = mergeSteamTexts(file, new Map([["de", german]]), "2026-11-21");
    expect(merged.achievements[1]?.name.de).toBe("Wage das Unbekannte");
    expect(merged.achievements[1]?.description.de).toBeUndefined();
  });

  it("keeps a name that reads the same as the English in a language Steam has", () => {
    const italian = new Map([
      ["SHOWN", { name: "One-of-a-Kind", description: "Equipaggia un oggetto unico" }],
      ["HIDDEN", { name: "Sfida l'ignoto", description: "" }],
    ]);
    const merged = mergeSteamTexts(file, new Map([["it", italian]]), "2026-11-21");
    expect(merged.achievements[0]?.name.it).toBe("One-of-a-Kind");
    expect(merged.achievements[1]?.name.it).toBe("Sfida l'ignoto");
  });

  it("leaves out a language Steam serves only in English", () => {
    const english = new Map([
      ["SHOWN", { name: "One-of-a-Kind", description: "Equip a unique item" }],
      ["HIDDEN", { name: "Brave the Unknown", description: "Enter the Sift" }],
    ]);
    const merged = mergeSteamTexts(file, new Map([["ja", english]]), "2026-11-21");
    expect(merged.achievements[0]?.name.ja).toBeUndefined();
    expect(merged.achievements[0]?.description.ja).toBeUndefined();
  });

  it("fails when a language misses an achievement", () => {
    expect(() => mergeSteamTexts(file, new Map([["de", new Map([["SHOWN", { name: "x", description: "y" }]])]]), "2026-11-21")).toThrow(/HIDDEN/);
  });
});

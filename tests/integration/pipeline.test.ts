import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { ALL_LANGS, LANG_META } from "../../scripts/extract/config";
import { ExtractError } from "../../scripts/extract/issues";
import { runExtract } from "../../scripts/extract/pipeline";
import { SOUL_STORM_ICON_SOURCES } from "../../scripts/extract/soul-storm";
import type { ArmorSet, Entry } from "../../scripts/extract/schemas";
import { rawCurveFiles } from "../helpers/curve-tables";
import { GUIDE_TABLE_FILES } from "../../scripts/extract/guides-tables";
import { REAL_GUIDE_ROWS } from "../helpers/guide-tables";
import { makeLocales, ns } from "../helpers/locales";

/** The DataTables the threat guide reads; the other guide tables stay absent so the other extractors' own fixtures are untouched. */
const THREAT_TABLES = ["gameBalance", "difficulty", "worldActor", "rarityChance"] as const;
/** The DataTables the weapon extract needs before it reads anything else; empty is enough. */
const GAME_TABLES = [
  "DT_ItemDefinitionMelee", "DT_ItemDefinitionRanged", "DT_MeleePropertyDefinition", "DT_RangedPropertyDefinition",
  "DT_ProjectileDefinition", "DT_EffectTemplateDefinition", "DT_EffectTemplateGroupDefinition",
  "DT_EffectTemplateGroupDropTableDefinition", "DT_EffectDefinition", "DT_EnchantmentDefinition", "DT_ItemDefinitionArtifact", "DT_ItemDefinitionArmor",
];
const ICON_ROOT = "Assets/Art/Characters/Player/Equipment";
const QUIVER = `${ICON_ROOT}/Artifacts/Quivers/T_UI_Quiver_Freezing_Icon.png`;
const JA_LOCALE = {
  [ns("DT_ItemDefinitionMelee")]: { SW_Item_Sword_SW_TextEntry_Name: "剣", SW_Item_Sword_SW_TextEntry_Description: "古典的な剣。" },
};

let sourceRoot: string;
let outRoot: string;
let overridesPath: string;

async function put(root: string, relative: string, content: string): Promise<void> {
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

beforeEach(async () => {
  sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-src-"));
  outRoot = await mkdtemp(path.join(tmpdir(), "mcd2-out-"));
  overridesPath = path.join(sourceRoot, "overrides.json");
  const locales = makeLocales({
    [ns("DT_ItemDefinitionMelee")]: {
      SW_Item_Sword_SW_TextEntry_Name: { en: "Sword", zh: "劍" },
      SW_Item_Sword_SW_TextEntry_Description: { en: "A classic sword.", zh: "經典的劍。" },
      SW_Item_Sword_Unique1_SW_TextEntry_Name: { en: "The Burning Blade", zh: "燃燒之刃" },
    },
    [ns("DT_R3ItemDefinitionMelee")]: { SW_Item_Halberd_SW_TextEntry_Name: { en: "Halberd", zh: "戟" } },
    [ns("DT_ItemDefinitionArmor")]: {
      SW_Item_DiscipleHelmet_SW_TextEntry_Name: { en: "Disciple mask", zh: "修行者面具" },
      SW_Item_DiscipleChest_SW_TextEntry_Name: { en: "Disciple Robe", zh: "修行者長袍" },
    },
    [ns("DT_ItemDefinitionArtifact")]: { SW_Item_Artifact_FrostQuiver_SW_TextEntry_Name: { en: "Frost Quiver", zh: "冰霜箭袋" } },
    [ns("DT_EnchantmentDefinition")]: {
      SW_Enchantment_Arcane_SW_TextEntry_Name: { en: "Artifact Amplifier", zh: "神器增幅" },
      SW_Enchantment_Arcane_SW_TextEntry_Description_EffectTotal: { en: "{0}", zh: "{0}" },
    },
    [ns("DT_ItemDefinitionEnchantmentBook")]: {
      SW_Item_EnchantmentBook_Arcane_SW_TextEntry_Name: { en: "Artifact Amplifier", zh: "神器增幅" },
    },
    [ns("DT_EffectDefinition")]: {
      SW_Effect_CriticalEdge_SW_TextEntry_Name: { en: "Critical Edge", zh: "致命鋒刃" },
      SW_Effect_CriticalEdge_SW_TextEntry_Description: { en: "All critical hits deal {0} more damage.", zh: "暴擊造成的傷害提高 {0}。" },
    },
    [ns("DT_StatusDefinition")]: {
      SW_Status_Burning_SW_TextEntry_Name: { en: "Burning", zh: "燃燒" },
      SW_Status_Burning_Infinite_SW_TextEntry_Name: { en: "Burning", zh: "燃燒" },
    },
    [ns("DT_ItemDefinitionTalisman")]: {
      SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Name: { en: "Twig of Dark Oak", zh: "黑橡木枝條" },
      SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Description: { en: "Ammo Capacity Talisman Description", zh: "說明" },
    },
    [ns("DT_ItemDefinitionCape")]: {
      SW_Item_Cosmetic_Cape_Creeper_SW_TextEntry_Name: { en: "Corrupted Creeper Cape", zh: "腐化苦力怕披風" },
      SW_Item_Cosmetic_Cape_CorruptedCreeper_SW_TextEntry_Name: { en: "Corrupted Creeper Cape", zh: "腐化苦力怕披風" },
      SW_Item_Cosmetec_Cape_CorruptedCreeper_SW_TextEntry_UnlockExplanation: { en: "Upgrade to Deluxe.", zh: "升級至豪華版。" },
    },
    [ns("DT_SkinDefinition")]: { SW_Skin_Darian_SW_TextEntry_Name: { en: "Darian Skin", zh: "達里安外觀" } },
  });
  await put(sourceRoot, "Assets/Art/Characters/Player/Equipment/Talismans/AmmoCapacity/T_UI_AmmoCapacity_Icon1.png", "png:twig");
  await put(sourceRoot, "Assets/Art/Characters/Player/Equipment/Talismans/AmmoCapacity/T_UI_AmmoCapacity_Icon2.png", "png:twig2");
  await put(sourceRoot, "Assets/Art/Characters/Player/Capes/Skins/T_UI_Cape_CorruptedCreeper_Icon.png", "png:cape");
  await put(sourceRoot, "Assets/Art/Characters/Player/Skins/Darian/T_Darian_Skin_Icon.png", "png:darian");
  await put(sourceRoot, "Assets/UI/Icons/Enchantments/T_UI_Icon_Enchantment_Arcane.png", "png:arcane");
  await put(sourceRoot, "Assets/UI/Icons/Statuses/T_UI_Icon_Status_Burning.png", "png:burning");
  await put(sourceRoot, "Plugins/OreUI/Content/UI/Icons/Effects/T_UI_Icon_Effect_CriticalEdge.png", "png:critical-edge");
  await put(sourceRoot, "Assets/UI/HUD/Player/Hotbar/Artifacts/Slot/T_UI_ArtifactSlot_Default.png", "png:artifact-frame");
  await put(sourceRoot, "Assets/UI/Icons/Categories/T_UI_Icon_Category_Melee.png", "png:melee-category");
  await put(sourceRoot, "Assets/UI/Icons/SmallLogo.png", "png:small-logo");
  await put(sourceRoot, "Assets/UI/Icons/Logo.png", "png:logo");
  await put(sourceRoot, "Assets/UI/Icons/SplashScreen.png", "png:splash");
  await put(sourceRoot, "Localization/All/en/All.json", JSON.stringify(locales.en));
  await put(sourceRoot, "Localization/All/zh-Hant/All.json", JSON.stringify(locales.zh));
  await put(sourceRoot, "Localization/All/ja-JP/All.json", JSON.stringify(JA_LOCALE));
  const empty = ALL_LANGS.filter((lang) => !["en", "zh", "ja"].includes(lang));
  await Promise.all(empty.map((lang) => put(sourceRoot, `Localization/All/${LANG_META[lang].culture}/All.json`, "{}")));
  await put(sourceRoot, `${ICON_ROOT}/Weapons/Sword/T_UI_Sword_Icon.png`, "png:sword");
  await put(sourceRoot, `${ICON_ROOT}/Weapons/Sword/Sword_Unique/T_UI_Sword_Unique_Icon.png`, "png:sword-unique");
  await put(sourceRoot, `${ICON_ROOT}/Armor/Disciple_Armor/T_UI_Helmet_Disciple_Icon.png`, "png:helmet");
  await put(sourceRoot, QUIVER, "png:quiver");
  await writeFile(overridesPath, JSON.stringify({ Artifact_FrostQuiver: QUIVER }), "utf8");
  await writeFile(path.join(sourceRoot, "soul-storm-status.json"), JSON.stringify({ verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 }), "utf8");
  await writeFile(path.join(sourceRoot, "guides-status.json"), JSON.stringify({ enchantCostPerLevel: false, rarityOdds: false, threatBalanceRow: false }), "utf8");
  await put(sourceRoot, SOUL_STORM_ICON_SOURCES.header, "png:soul-storm-header");
  await put(sourceRoot, SOUL_STORM_ICON_SOURCES.generator, "png:soul-storm-generator");
});

const readJson = async <T,>(relative: string): Promise<T> =>
  JSON.parse(await readFile(path.join(outRoot, ...relative.split("/")), "utf8")) as T;

describe("runExtract", () => {
  it("writes entries, armor sets, icons and a report", async () => {
    await put(outRoot, "public/icons/stale.png", "old");
    const summary = await runExtract({ sourceRoot, outRoot, overridesPath });
    const entries = await readJson<Entry[]>("src/data/entries.json");
    const find = (category: string, slug: string) => entries.find((e) => e.category === category && e.slug === slug);

    expect(find("melee", "sword")).toMatchObject({
      name: { zh: "劍", en: "Sword", ja: "剣", de: "Sword" },
      icon: "icons/melee/sword.png",
      links: { variants: ["sword-unique1"] },
    });
    expect(find("melee", "sword")?.untranslated).toContain("de");
    expect(find("melee", "sword")?.untranslated).not.toContain("ja");
    expect(find("melee", "sword")?.description).toMatchObject({ ja: "古典的な剣。", de: "A classic sword." });
    expect(await readFile(path.join(outRoot, "public", "icons", "melee", "sword.png"), "utf8")).toBe("png:sword");
    expect(existsSync(path.join(outRoot, "public", "icons", "stale.png"))).toBe(false);
    expect(find("melee", "halberd")).toMatchObject({ release: "upcoming", links: {} });
    expect(find("melee", "halberd")?.icon).toBeUndefined();
    expect(find("artifact", "frost-quiver")?.icon).toBe("icons/artifact/frost-quiver.png");
    expect(find("enchantment", "arcane")?.links).toEqual({ enchantmentBook: "arcane" });
    expect(find("effect", "critical-edge")?.description?.zh).toContain('<span class="placeholder" data-slot="0">{數值}</span>');
    expect(find("effect", "critical-edge")?.icon).toBe("icons/effect/critical-edge.png");
    expect(await readFile(path.join(outRoot, "public", "icons", "effect", "critical-edge.png"), "utf8")).toBe("png:critical-edge");
    expect(find("enchantment", "arcane")?.icon).toBe("icons/enchantment/arcane.png");
    expect(find("enchantment-book", "arcane")?.icon).toBe("icons/enchantment-book/arcane.png");
    expect(find("status", "burning")?.icon).toBe("icons/status/burning.png");
    expect(find("status", "burning-infinite")?.icon).toBe("icons/status/burning-infinite.png");
    expect(await readFile(path.join(outRoot, "public", "icons", "status", "burning-infinite.png"), "utf8")).toBe("png:burning");

    const sets = await readJson<ArmorSet[]>("src/data/armor-sets.json");
    expect(sets).toMatchObject([
      {
        id: "Disciple",
        slug: "disciple",
        variant: "normal",
        name: { zh: "修行者", en: "Disciple", ja: "Disciple" },
        pieces: { helmet: "disciple-helmet", chest: "disciple-chest" },
      },
    ]);
    expect(sets[0].untranslated).toContain("ja");
    expect(sets[0].untranslated).not.toContain("zh");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-icon (1)\n\n- armor:DiscipleChest");
    expect(summary).toMatchObject({ entries: 14, armorSets: 1, icons: 12 });
    expect(existsSync(path.join(outRoot, "src", "data", "mobs.json"))).toBe(true);
    expect(existsSync(path.join(outRoot, "src", "data", "loot-sources.json"))).toBe(true);
    expect(report).toContain("missing-mob-tables");
  });

  it("takes an icon the DataTables' IconReference names, even when no file name matches", async () => {
    await Promise.all(GAME_TABLES.map((name) => put(sourceRoot, `DataTables/UFS/${name}.json`, "[]")));
    const reference = "/Game/Spicewood/Art/Characters/Player/Equipment/Armor/Disciple_Armor/Chest_Texture.Chest_Texture";
    await put(sourceRoot, "DataTables/UFS/DT_ItemDefinitionArmor.json", JSON.stringify([{ Name: "DiscipleChest", IconReference: reference }]));
    await put(sourceRoot, `${ICON_ROOT}/Armor/Disciple_Armor/Chest_Texture.png`, "png:referenced-chest");
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const entries = await readJson<Entry[]>("src/data/entries.json");
    expect(entries.find((e) => e.category === "armor" && e.slug === "disciple-chest")?.icon).toBe("icons/armor/disciple-chest.png");
    expect(await readFile(path.join(outRoot, "public", "icons", "armor", "disciple-chest.png"), "utf8")).toBe("png:referenced-chest");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).not.toMatch(/^- armor:DiscipleChest$/m);
  });

  it("falls back to file-name matching when the IconReference file is missing", async () => {
    await put(sourceRoot, "DataTables/UFS/DT_ItemDefinitionMelee.json", JSON.stringify([{ Name: "Sword", IconReference: "/Game/Spicewood/Art/Nowhere/Missing.Missing" }]));
    await Promise.all(
      ["DT_ItemDefinitionRanged", "DT_MeleePropertyDefinition", "DT_RangedPropertyDefinition", "DT_ProjectileDefinition", "DT_EffectTemplateDefinition",
        "DT_EffectTemplateGroupDefinition", "DT_EffectTemplateGroupDropTableDefinition", "DT_EffectDefinition", "DT_EnchantmentDefinition", "DT_ItemDefinitionArtifact", "DT_ItemDefinitionArmor"]
        .map((name) => put(sourceRoot, `DataTables/UFS/${name}.json`, "[]")),
    );
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const entries = await readJson<Entry[]>("src/data/entries.json");
    expect(entries.find((e) => e.category === "melee" && e.slug === "sword")?.icon).toBe("icons/melee/sword.png");
    expect(await readFile(path.join(outRoot, "public", "icons", "melee", "sword.png"), "utf8")).toBe("png:sword");
  });

  it("extracts talismans and cosmetics with icons, unlock text and no duplicates", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const entries = await readJson<Entry[]>("src/data/entries.json");
    const find = (category: string, slug: string) => entries.find((e) => e.category === category && e.slug === slug);
    expect(find("talisman", "ammo-capacity")).toMatchObject({ icon: "icons/talisman/ammo-capacity.png" });
    expect(find("talisman", "ammo-capacity")?.description).toBeUndefined();
    expect(await readFile(path.join(outRoot, "public", "icons", "talisman", "ammo-capacity.png"), "utf8")).toBe("png:twig");
    expect(entries.filter((e) => e.category === "cape").map((e) => e.slug)).toEqual(["corrupted-creeper"]);
    expect(find("cape", "corrupted-creeper")).toMatchObject({
      icon: "icons/cape/corrupted-creeper.png",
      unlock: { en: "Upgrade to Deluxe.", zh: "升級至豪華版。" },
    });
    expect(find("skin", "darian")?.icon).toBe("icons/skin/darian.png");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("- cape:Cosmetic_Cape_Creeper (same name as Cosmetic_Cape_CorruptedCreeper)");
  });

  it("copies available icon frames and reports missing ones", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<Record<string, string>>("src/data/frames.json")).toEqual({ artifact: "icons/frames/artifact.png" });
    expect(await readFile(path.join(outRoot, "public", "icons", "frames", "artifact.png"), "utf8")).toBe("png:artifact-frame");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-frame (1)\n\n- Assets/UI/Icons/Enchantments/T_UI_Enchantment_Book_Slot.png");
  });

  it("copies available brand art and reports missing pieces", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<Record<string, string>>("src/data/brand.json")).toEqual({
      favicon: "icons/brand/favicon.png",
      "app-icon": "icons/brand/app-icon.png",
    });
    expect(await readFile(path.join(outRoot, "public", "icons", "brand", "favicon.png"), "utf8")).toBe("png:small-logo");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-brand (1)\n\n- Assets/UI/Icons/Square480x480Logo.png");
  });

  it("copies the splash art into src/assets so the site build can optimise it", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readFile(path.join(outRoot, "src", "assets", "brand", "splash.png"), "utf8")).toBe("png:splash");
  });

  it("reports missing splash art without failing", async () => {
    await rm(path.join(sourceRoot, "Assets", "UI", "Icons", "SplashScreen.png"));
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(existsSync(path.join(outRoot, "src", "assets", "brand", "splash.png"))).toBe(false);
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-brand (2)");
    expect(report).toContain("- Assets/UI/Icons/SplashScreen.png");
  });

  it("copies available category icons and reports missing ones", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<Record<string, string>>("src/data/category-icons.json")).toEqual({ melee: "icons/ui/melee.png" });
    expect(await readFile(path.join(outRoot, "public", "icons", "ui", "melee.png"), "utf8")).toBe("png:melee-category");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-ui-icon (15)");
    expect(report).toContain("- Assets/UI/Icons/Categories/T_UI_Icon_Category_Potion.png");
    expect(report).toContain("- Assets/UI/Icons/Categories/T_UI_Icon_Category_Ranged.png");
  });

  it("produces identical output on a second run", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const first = await readFile(path.join(outRoot, "src", "data", "entries.json"), "utf8");
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readFile(path.join(outRoot, "src", "data", "entries.json"), "utf8")).toBe(first);
  });

  it("fails clearly when the locale files are missing", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "mcd2-empty-"));
    await expect(runExtract({ sourceRoot: empty, outRoot, overridesPath })).rejects.toThrow(ExtractError);
    await expect(runExtract({ sourceRoot: empty, outRoot, overridesPath })).rejects.toThrow("找不到語系檔");
  });

  it("writes the threat table and the difficulties from the guide tables and CurveTables", async () => {
    const rows = REAL_GUIDE_ROWS();
    await Promise.all(GAME_TABLES.map((name) => put(sourceRoot, `DataTables/UFS/${name}.json`, "[]")));
    await Promise.all(THREAT_TABLES.map((key) => put(sourceRoot, `DataTables/UFS/${GUIDE_TABLE_FILES[key]}.json`, JSON.stringify(rows[key]))));
    await Promise.all(Object.entries(rawCurveFiles()).map(([name, curve]) => put(sourceRoot, `CurveTables/${name}.json`, JSON.stringify(curve))));
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const guides = await readJson<{ threat: { level: number; effectTiers?: number[] }[]; difficulty: { id: string }[] }>("src/data/guides.json");
    expect(guides.threat).toHaveLength(20);
    expect(guides.threat[8]?.effectTiers).toEqual([1, 0.7, 0.4]);
    expect(guides.difficulty).toEqual([]);
  });

  it("leaves the threat guide empty and reports it when the CurveTables are missing", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<{ threat: unknown[]; difficulty: unknown[] }>("src/data/guides.json")).toMatchObject({ threat: [], difficulty: [] });
    expect(await readFile(path.join(outRoot, "extract-report.md"), "utf8")).toContain("### missing-curve-tables (1)\n\n- CurveTables");
  });

  it("writes an empty map and reports it when the map tables are missing", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<{ worlds: unknown[]; legend: unknown }>("src/data/map.json")).toEqual({ worlds: [], legend: {} });
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-map-tables (1)");
    expect(report).toContain("- DataTables/UFS/DT_WorldRegionMapData.json");
  });
  it("writes an empty achievement list and reports it when the Steam data is missing", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<{ achievements: unknown[] }>("src/data/achievements.json")).toMatchObject({ achievements: [] });
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-achievements (1)\n\n- Steam/Achievements/achievements.json");
  });

  it("writes the Steam achievements in 16 languages with webp icons that survive the icon rebuild", async () => {
    const row = { id: "EQUIP_A_UNIQUE_ITEM", icon: "https://example.invalid/a.jpg", file: "EQUIP_A_UNIQUE_ITEM.jpg", globalPercent: 76.9 };
    const text = { name: { en: "One-of-a-Kind", zh: "獨一無二" }, description: { en: "Equip a unique item", zh: "裝備一件獨特物品" } };
    await put(sourceRoot, "Steam/Achievements/achievements.json", JSON.stringify({ source: "Steam", retrieved: "2026-10-11", achievements: [{ ...row, ...text }] }));
    const jpg = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#36c" } }).jpeg().toBuffer();
    await writeFile(path.join(sourceRoot, "Steam", "Achievements", "EQUIP_A_UNIQUE_ITEM.jpg"), jpg);
    await runExtract({ sourceRoot, outRoot, overridesPath });
    const data = await readJson<{ achievements: { name: Record<string, string>; icon?: string; untranslated?: string[] }[] }>("src/data/achievements.json");
    expect(data.achievements).toHaveLength(1);
    expect(Object.keys(data.achievements[0]?.name ?? {})).toHaveLength(16);
    expect(data.achievements[0]).toMatchObject({ name: { zh: "獨一無二", ko: "One-of-a-Kind" }, icon: "icons/achievements/equip-a-unique-item.webp" });
    expect(data.achievements[0]?.untranslated).toHaveLength(14);
    expect(existsSync(path.join(outRoot, "public", "icons", "achievements", "equip-a-unique-item.webp"))).toBe(true);
    expect(existsSync(path.join(outRoot, "public", "icons", "melee", "sword.png"))).toBe(true);
  });
});

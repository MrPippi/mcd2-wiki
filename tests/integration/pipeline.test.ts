import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtractError } from "../../scripts/extract/issues";
import { runExtract } from "../../scripts/extract/pipeline";
import type { ArmorSet, Entry } from "../../scripts/extract/schemas";
import { makeLocales, ns } from "../helpers/locales";

const ICON_ROOT = "Assets/Art/Characters/Player/Equipment";
const QUIVER = `${ICON_ROOT}/Artifacts/Quivers/T_UI_Quiver_Freezing_Icon.png`;

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
      SW_Item_Sword_SW_TextEntry_Name: ["Sword", "劍"],
      SW_Item_Sword_SW_TextEntry_Description: ["A classic sword.", "經典的劍。"],
      SW_Item_Sword_Unique1_SW_TextEntry_Name: ["The Burning Blade", "燃燒之刃"],
    },
    [ns("DT_R3ItemDefinitionMelee")]: { SW_Item_Halberd_SW_TextEntry_Name: ["Halberd", "戟"] },
    [ns("DT_ItemDefinitionArmor")]: {
      SW_Item_DiscipleHelmet_SW_TextEntry_Name: ["Disciple mask", "修行者面具"],
      SW_Item_DiscipleChest_SW_TextEntry_Name: ["Disciple Robe", "修行者長袍"],
    },
    [ns("DT_ItemDefinitionArtifact")]: { SW_Item_Artifact_FrostQuiver_SW_TextEntry_Name: ["Frost Quiver", "冰霜箭袋"] },
    [ns("DT_EnchantmentDefinition")]: {
      SW_Enchantment_Arcane_SW_TextEntry_Name: ["Artifact Amplifier", "神器增幅"],
      SW_Enchantment_Arcane_SW_TextEntry_Description_EffectTotal: ["{0}", "{0}"],
    },
    [ns("DT_ItemDefinitionEnchantmentBook")]: {
      SW_Item_EnchantmentBook_Arcane_SW_TextEntry_Name: ["Artifact Amplifier", "神器增幅"],
    },
    [ns("DT_EffectDefinition")]: {
      SW_Effect_CriticalEdge_SW_TextEntry_Name: ["Critical Edge", "致命鋒刃"],
      SW_Effect_CriticalEdge_SW_TextEntry_Description: ["All critical hits deal {0} more damage.", "暴擊造成的傷害提高 {0}。"],
    },
    [ns("DT_StatusDefinition")]: {
      SW_Status_Burning_SW_TextEntry_Name: ["Burning", "燃燒"],
      SW_Status_Burning_Infinite_SW_TextEntry_Name: ["Burning", "燃燒"],
    },
    [ns("DT_ItemDefinitionTalisman")]: {
      SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Name: ["Twig of Dark Oak", "黑橡木枝條"],
      SW_Item_Talisman_AmmoCapacity_SW_TextEntry_Description: ["Ammo Capacity Talisman Description", "說明"],
    },
    [ns("DT_ItemDefinitionCape")]: {
      SW_Item_Cosmetic_Cape_Creeper_SW_TextEntry_Name: ["Corrupted Creeper Cape", "腐化苦力怕披風"],
      SW_Item_Cosmetic_Cape_CorruptedCreeper_SW_TextEntry_Name: ["Corrupted Creeper Cape", "腐化苦力怕披風"],
      SW_Item_Cosmetec_Cape_CorruptedCreeper_SW_TextEntry_UnlockExplanation: ["Upgrade to Deluxe.", "升級至豪華版。"],
    },
    [ns("DT_SkinDefinition")]: { SW_Skin_Darian_SW_TextEntry_Name: ["Darian Skin", "達里安外觀"] },
  });
  await put(sourceRoot, "Assets/Art/Characters/Player/Equipment/Talismans/AmmoCapacity/T_UI_AmmoCapacity_Icon1.png", "png:twig");
  await put(sourceRoot, "Assets/Art/Characters/Player/Equipment/Talismans/AmmoCapacity/T_UI_AmmoCapacity_Icon2.png", "png:twig2");
  await put(sourceRoot, "Assets/Art/Characters/Player/Capes/Skins/T_UI_Cape_CorruptedCreeper_Icon.png", "png:cape");
  await put(sourceRoot, "Assets/Art/Characters/Player/Skins/Darian/T_Darian_Skin_Icon.png", "png:darian");
  await put(sourceRoot, "Assets/UI/Icons/Enchantments/T_UI_Icon_Enchantment_Arcane.png", "png:arcane");
  await put(sourceRoot, "Assets/UI/Icons/Statuses/T_UI_Icon_Status_Burning.png", "png:burning");
  await put(sourceRoot, "Assets/UI/HUD/Player/Hotbar/Artifacts/Slot/T_UI_ArtifactSlot_Default.png", "png:artifact-frame");
  await put(sourceRoot, "Assets/UI/Icons/Categories/T_UI_Icon_Category_Melee.png", "png:melee-category");
  await put(sourceRoot, "Localization/All/en/All.json", JSON.stringify(locales.en));
  await put(sourceRoot, "Localization/All/zh-Hant/All.json", JSON.stringify(locales.zh));
  await put(sourceRoot, `${ICON_ROOT}/Weapons/Sword/T_UI_Sword_Icon.png`, "png:sword");
  await put(sourceRoot, `${ICON_ROOT}/Weapons/Sword/Sword_Unique/T_UI_Sword_Unique_Icon.png`, "png:sword-unique");
  await put(sourceRoot, `${ICON_ROOT}/Armor/Disciple_Armor/T_UI_Helmet_Disciple_Icon.png`, "png:helmet");
  await put(sourceRoot, QUIVER, "png:quiver");
  await writeFile(overridesPath, JSON.stringify({ Artifact_FrostQuiver: QUIVER }), "utf8");
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
      name: { zh: "劍", en: "Sword" },
      icon: "icons/melee/sword.png",
      links: { variants: ["sword-unique1"] },
    });
    expect(await readFile(path.join(outRoot, "public", "icons", "melee", "sword.png"), "utf8")).toBe("png:sword");
    expect(existsSync(path.join(outRoot, "public", "icons", "stale.png"))).toBe(false);
    expect(find("melee", "halberd")).toMatchObject({ release: "upcoming", links: {} });
    expect(find("melee", "halberd")?.icon).toBeUndefined();
    expect(find("artifact", "frost-quiver")?.icon).toBe("icons/artifact/frost-quiver.png");
    expect(find("enchantment", "arcane")?.links).toEqual({ enchantmentBook: "arcane" });
    expect(find("effect", "critical-edge")?.description?.zh).toContain('<span class="placeholder">{數值}</span>');
    expect(find("effect", "critical-edge")?.icon).toBeUndefined();
    expect(find("enchantment", "arcane")?.icon).toBe("icons/enchantment/arcane.png");
    expect(find("enchantment-book", "arcane")?.icon).toBe("icons/enchantment-book/arcane.png");
    expect(find("status", "burning")?.icon).toBe("icons/status/burning.png");
    expect(find("status", "burning-infinite")?.icon).toBe("icons/status/burning-infinite.png");
    expect(await readFile(path.join(outRoot, "public", "icons", "status", "burning-infinite.png"), "utf8")).toBe("png:burning");

    expect(await readJson<ArmorSet[]>("src/data/armor-sets.json")).toEqual([
      {
        id: "Disciple",
        slug: "disciple",
        variant: "normal",
        name: { zh: "修行者", en: "Disciple" },
        pieces: { helmet: "disciple-helmet", chest: "disciple-chest" },
      },
    ]);
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-icon (1)\n\n- armor:DiscipleChest");
    expect(summary).toMatchObject({ entries: 14, armorSets: 1, icons: 11 });
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

  it("copies available category icons and reports missing ones", async () => {
    await runExtract({ sourceRoot, outRoot, overridesPath });
    expect(await readJson<Record<string, string>>("src/data/category-icons.json")).toEqual({ melee: "icons/ui/melee.png" });
    expect(await readFile(path.join(outRoot, "public", "icons", "ui", "melee.png"), "utf8")).toBe("png:melee-category");
    const report = await readFile(path.join(outRoot, "extract-report.md"), "utf8");
    expect(report).toContain("### missing-ui-icon (14)");
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
});

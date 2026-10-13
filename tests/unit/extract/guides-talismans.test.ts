import { describe, expect, it } from "vitest";
import { buildSecretTalismans, questRewards } from "../../../scripts/extract/guides-talismans";
import { guideTables } from "../../helpers/guide-tables";
import { makeEntry } from "../../helpers/entries";
import { makeSparseLocales } from "../../helpers/locales";

const COLLECTION = "Text/Release/DT_ItemCollectionsDefinition.csv";
const key = (entry: string) => `SW_Collectibles_SecretTalismans_SW_TextEntry_${entry}`;
const locales = makeSparseLocales({
  [COLLECTION]: {
    [key("Name")]: { en: "Secret Talismans", zh: "秘密護符" },
    [key("Description_Completion")]: { en: "You have collected all the secret Talismans!", zh: "你已收集所有秘密護符！" },
    [key("Description_Completion_Short")]: { en: "A secret door has opened in the world." },
  },
  "Text/Release/QuestTrackerLabels.csv": { CA05_BR: { en: "The Prime Enchanter Revived", zh: "復活的至高附魔師" } },
});
const entries = [makeEntry("Talisman_DoubleDrop", "talisman"), makeEntry("Talisman_RangedBuff", "talisman")];

describe("questRewards", () => {
  it("lists each loot tag a quest hands out, lowercased, and skips libraries without quest data", () => {
    const { rewards, issues } = questRewards(guideTables());
    expect(rewards).toEqual([
      { questId: "CA04_BR", lootTag: "sw.quest.loot.talisman.rangedboost" },
      { questId: "CA05_BR", lootTag: "sw.quest.loot.talisman.rangedboost" },
      { questId: "CA05_BR", lootTag: "sw.quest.loot.areadropmodifier" },
    ]);
    expect(issues).toEqual([]);
  });

  it("reports a library that is not JSON or has an unexpected shape", () => {
    const { rewards, issues } = questRewards(guideTables({ quests: [{ Name: "Broken", RawQuestData: "{oops" }, { Name: "Odd", RawQuestData: '{"Quests": 5}' }] }));
    expect(rewards).toEqual([]);
    expect(issues.map((item) => item.detail)).toEqual(["DT_QuestLibraries Broken: RawQuestData is not JSON", "DT_QuestLibraries Odd: unexpected quest shape"]);
  });
});

describe("buildSecretTalismans", () => {
  it("links each collection talisman to its entry, with its chest and only the quests that hand it out", () => {
    const { secretTalismans, issues } = buildSecretTalismans({ tables: guideTables(), locales, entries });
    expect(secretTalismans.talismans.map((talisman) => [talisman.slug, talisman.chest, talisman.quests.map((quest) => quest.id)])).toEqual([
      ["double-drop", true, []],
      ["ranged-buff", true, ["CA04_BR", "CA05_BR"]],
    ]);
    const [, ranged] = secretTalismans.talismans;
    expect(ranged.quests[0].name).toBeNull();
    expect(ranged.quests[1].name?.html.zh).toBe("復活的至高附魔師");
    expect(issues.map((item) => item.type).sort()).toEqual(["guides-quest-unnamed", "guides-talisman-unlinked"]);
  });

  it("quotes the collection's own texts", () => {
    const { secretTalismans } = buildSecretTalismans({ tables: guideTables(), locales, entries });
    expect(secretTalismans.completion?.html.en).toBe("You have collected all the secret Talismans!");
    expect(secretTalismans.door?.untranslated).toContain("zh");
  });

  it("has no chest for a talisman only a non-talisman chest drops", () => {
    const tables = guideTables({ lootActor: [] });
    const { secretTalismans } = buildSecretTalismans({ tables, locales, entries });
    expect(secretTalismans.talismans.every((talisman) => !talisman.chest)).toBe(true);
  });

  it("counts only a talisman chest whose guaranteed slot drops just that talisman", () => {
    const tag = (TagName: string) => ({ TagName });
    const drop = (name: string) => ({ TypeTag: tag(`SW.Item.Talisman.${name}`), Weight: 1, Operation: "Set" });
    const slot = (guaranteed: number, names: string[]) => ({ NumberOfGuaranteedDrops: guaranteed, NumberOfRandomRolls: 0, DropChancePerRoll: 0, InheritParentDropTable: true, DropTable: { Tags: names.map(drop) } });
    const chest = (name: string, lootSlot: ReturnType<typeof slot>) => ({ Name: name, TypeTag: tag(`SW.LootActor.TalismansChest.${name}`), LootDropDefinition: { LootSlots: { '(TagName="SW.LootSlot.Talismans")': lootSlot } } });
    const lootActor = [
      chest("DoubleDrop", slot(0, ["DoubleDrop"])),               // not guaranteed
      chest("RangedBuff", slot(1, ["RangedBuff", "DoubleDrop"])), // shares its slot with another talisman
      { Name: "Empty", TypeTag: tag("SW.LootActor.TalismansChest.Empty"), LootDropDefinition: {} },
    ];
    const { secretTalismans } = buildSecretTalismans({ tables: guideTables({ lootActor }), locales, entries });
    expect(secretTalismans.talismans.map((talisman) => talisman.chest)).toEqual([false, false]);
  });

  it("is empty and reported without the collection", () => {
    const { secretTalismans, issues } = buildSecretTalismans({ tables: guideTables({ collections: [] }), locales, entries });
    expect(secretTalismans).toEqual({ completion: null, door: null, talismans: [] });
    expect(issues[0]?.type).toBe("guides-value-missing");
  });
});

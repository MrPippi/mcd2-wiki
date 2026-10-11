import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS_DIR,
  ACHIEVEMENT_ICON_SIZE,
  achievementSlug,
  buildAchievements,
  extractAchievements,
  parseSteamAchievements,
  type SteamAchievements,
} from "../../../scripts/extract/achievements";
import { AchievementDataSchema } from "../../../scripts/extract/achievement-schema";
import { LANGS } from "../../../scripts/extract/config";
import { ExtractError } from "../../../scripts/extract/issues";
import { localizedFrom } from "../../../src/lib/lang";
import { makeLocales } from "../../helpers/locales";

const steamRow = (id: string, globalPercent: number, en: [string, string], zh: [string, string]) => ({
  id,
  icon: `https://example.invalid/${id}.jpg`,
  file: `${id}.jpg`,
  globalPercent,
  name: { en: en[0], zh: zh[0] },
  description: { en: en[1], zh: zh[1] },
});

const STEAM: SteamAchievements = {
  source: "Steam app 1912410",
  retrieved: "2026-10-11",
  achievements: [
    steamRow("EQUIP_A_UNIQUE_ITEM", 76.9, ["One-of-a-Kind", "Equip a unique item"], ["獨一無二", "裝備一件獨特物品"]),
    steamRow("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST", 91.9, ["Home is Where Your Stuff Is", ""], ["家當在哪裡，家就在哪裡", ""]),
    steamRow("COLLECT_ALL_ENCHANTMENT_BOOKS", 1.2, ["Bookworm", "Collect every book"], ["", ""]),
  ],
};

const LOCALES = makeLocales({
  "Text/Release/QuestTrackerLabels.csv": { CA00: { en: "Escape from Squid Coast", zh: "逃離烏賊海岸" } },
});

const OTHER_LANGS = LANGS.filter((lang) => lang !== "zh" && lang !== "en");

describe("achievementSlug", () => {
  it("lowercases the Steam id and joins its words with hyphens", () => {
    expect(achievementSlug("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST")).toBe("complete-arrive-in-brave-haven-quest");
    expect(achievementSlug("KILL__100_MOBS")).toBe("kill-100-mobs");
  });
});

describe("parseSteamAchievements", () => {
  it("accepts the Steam file and ignores notes it does not need", () => {
    const raw = { ...STEAM, achievements: [{ ...STEAM.achievements[0], mappingNote: "tied percent" }] };
    expect(parseSteamAchievements(raw, "x/achievements.json").achievements[0]?.id).toBe("EQUIP_A_UNIQUE_ITEM");
  });

  it("fails loudly with the file path when a row is malformed", () => {
    const raw = { ...STEAM, achievements: [{ ...STEAM.achievements[0], globalPercent: "high" }] };
    expect(() => parseSteamAchievements(raw, "Steam/Achievements/achievements.json")).toThrow(ExtractError);
    expect(() => parseSteamAchievements(raw, "Steam/Achievements/achievements.json")).toThrow(/Steam\/Achievements\/achievements\.json.*globalPercent/);
  });

  it("rejects icon file names that leave the folder", () => {
    const raw = { ...STEAM, achievements: [{ ...STEAM.achievements[0], file: "../secret.jpg" }] };
    expect(() => parseSteamAchievements(raw, "a.json")).toThrow(/file/);
  });

  it("rejects duplicate ids", () => {
    const raw = { ...STEAM, achievements: [STEAM.achievements[0], STEAM.achievements[0]] };
    expect(() => parseSteamAchievements(raw, "a.json")).toThrow(/EQUIP_A_UNIQUE_ITEM/);
  });
});

describe("buildAchievements", () => {
  const icons = new Set(["EQUIP_A_UNIQUE_ITEM.jpg", "COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST.jpg"]);
  const result = buildAchievements(STEAM, (file) => icons.has(file));
  const byId = (id: string) => result.data.achievements.find((achievement) => achievement.id === id);

  it("orders the achievements by global unlock rate, highest first", () => {
    expect(result.data.achievements.map((achievement) => achievement.globalPercent)).toEqual([91.9, 76.9, 1.2]);
  });

  it("keeps Steam's English and Traditional Chinese, and shows English in the 14 other languages", () => {
    const unique = byId("EQUIP_A_UNIQUE_ITEM");
    expect(unique?.name.zh).toBe("獨一無二");
    expect(unique?.name.en).toBe("One-of-a-Kind");
    for (const lang of OTHER_LANGS) expect(unique?.name[lang], lang).toBe("One-of-a-Kind");
    expect(unique?.description?.ja).toBe("Equip a unique item");
    expect([...(unique?.untranslated ?? [])].sort()).toEqual([...OTHER_LANGS].sort());
  });

  it("marks Chinese untranslated too when Steam has no Chinese text", () => {
    const books = byId("COLLECT_ALL_ENCHANTMENT_BOOKS");
    expect(books?.name.zh).toBe("Bookworm");
    expect(books?.untranslated).toContain("zh");
    expect(books?.untranslated).not.toContain("en");
  });

  it("marks achievements without a description as hidden", () => {
    const home = byId("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST");
    expect(home?.hidden).toBe(true);
    expect(home?.description).toBeUndefined();
    expect(byId("EQUIP_A_UNIQUE_ITEM")?.hidden).toBe(false);
  });

  it("points at the published webp icon and leaves it out when the jpg is missing", () => {
    expect(byId("EQUIP_A_UNIQUE_ITEM")?.icon).toBe("icons/achievements/equip-a-unique-item.webp");
    expect(byId("COLLECT_ALL_ENCHANTMENT_BOOKS")?.icon).toBeUndefined();
    expect(result.icons).toEqual([
      { file: "COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST.jpg", published: "icons/achievements/complete-arrive-in-brave-haven-quest.webp" },
      { file: "EQUIP_A_UNIQUE_ITEM.jpg", published: "icons/achievements/equip-a-unique-item.webp" },
    ]);
  });

  it("reports missing icons and the languages that show English", () => {
    expect(result.issues).toContainEqual({ type: "missing-achievement-icon", detail: "COLLECT_ALL_ENCHANTMENT_BOOKS.jpg" });
    const fallback = result.issues.filter((item) => item.type === "achievement-text-fallback");
    expect(fallback).toHaveLength(3);
    expect(fallback.map((item) => item.detail)).toContainEqual(expect.stringMatching(/^COLLECT_ALL_ENCHANTMENT_BOOKS: zh, zh-hans, ja, /));
    expect(fallback.map((item) => item.detail)).toContainEqual(expect.stringMatching(/^EQUIP_A_UNIQUE_ITEM: zh-hans, ja, /));
  });

  it("attaches the unlock condition to hidden achievements only", () => {
    const quest = { type: "quest" as const, name: localizedFrom((lang) => (lang === "zh" ? "逃離烏賊海岸" : "Escape from Squid Coast")) };
    const conditions = new Map([
      ["COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST", quest],
      ["EQUIP_A_UNIQUE_ITEM", quest],
    ]);
    const withConditions = buildAchievements(STEAM, () => true, conditions).data.achievements;
    expect(withConditions.find((item) => item.id === "COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST")?.condition).toEqual(quest);
    expect(withConditions.find((item) => item.id === "EQUIP_A_UNIQUE_ITEM")?.condition).toBeUndefined();
    expect(byId("COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST")?.condition).toBeUndefined();
  });

  it("produces data the site schema accepts and keeps the source and date", () => {
    expect(AchievementDataSchema.parse(result.data).retrieved).toBe("2026-10-11");
    expect(result.data.source).toBe("Steam app 1912410");
  });
});

describe("extractAchievements", () => {
  let sourceRoot: string;
  let outRoot: string;

  beforeEach(async () => {
    sourceRoot = await mkdtemp(path.join(tmpdir(), "mcd2-ach-src-"));
    outRoot = await mkdtemp(path.join(tmpdir(), "mcd2-ach-out-"));
  });

  it("returns an empty list and reports the missing folder when there is no Steam data", async () => {
    const result = await extractAchievements(sourceRoot, outRoot, LOCALES);
    expect(result.data.achievements).toEqual([]);
    expect(result.issues).toEqual([{ type: "missing-achievements", detail: `${ACHIEVEMENTS_DIR}/achievements.json` }]);
  });

  it("converts each Steam jpg to a small webp under public/icons/achievements", async () => {
    const dir = path.join(sourceRoot, ...ACHIEVEMENTS_DIR.split("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "achievements.json"), JSON.stringify({ ...STEAM, achievements: [STEAM.achievements[0]] }), "utf8");
    const jpg = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#c33" } }).jpeg().toBuffer();
    await writeFile(path.join(dir, "EQUIP_A_UNIQUE_ITEM.jpg"), jpg);
    const result = await extractAchievements(sourceRoot, outRoot, LOCALES);
    const webp = path.join(outRoot, "public", "icons", "achievements", "equip-a-unique-item.webp");
    expect(existsSync(webp)).toBe(true);
    const meta = await sharp(webp).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", ACHIEVEMENT_ICON_SIZE, ACHIEVEMENT_ICON_SIZE]);
    expect(result.data.achievements[0]?.icon).toBe("icons/achievements/equip-a-unique-item.webp");
  });

  it("names the unlock condition of hidden achievements from the game's achievement table", async () => {
    const dir = path.join(sourceRoot, ...ACHIEVEMENTS_DIR.split("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "achievements.json"), JSON.stringify(STEAM), "utf8");
    const table = path.join(sourceRoot, "DataTables", "UFS", "DT_AchievementDefinition.json");
    await mkdir(path.dirname(table), { recursive: true });
    const row = {
      AchievementId: "COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST",
      Condition: {
        InstancedStructScriptStruct: "/Script/Achievements.ConditionDefinitionQuest",
        QuestState: { bUseQuestState: true, QuestName: "CA00", TaskName: "None" },
      },
    };
    await writeFile(table, JSON.stringify([row]), "utf8");
    const result = await extractAchievements(sourceRoot, outRoot, LOCALES);
    const home = result.data.achievements.find((item) => item.id === "COMPLETE_ARRIVE_IN_BRAVE_HAVEN_QUEST");
    expect(home?.condition?.type).toBe("quest");
    expect(home?.condition?.name.zh).toBe("逃離烏賊海岸");
  });

  it("reports a missing achievement table and still lists the achievements", async () => {
    const dir = path.join(sourceRoot, ...ACHIEVEMENTS_DIR.split("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "achievements.json"), JSON.stringify(STEAM), "utf8");
    const result = await extractAchievements(sourceRoot, outRoot, LOCALES);
    expect(result.data.achievements).toHaveLength(3);
    expect(result.data.achievements.every((item) => item.condition === undefined)).toBe(true);
    expect(result.issues).toContainEqual({ type: "missing-achievement-definitions", detail: "DataTables/UFS/DT_AchievementDefinition.json" });
  });

  it("fails loudly with the path when the Steam file is not JSON", async () => {
    const dir = path.join(sourceRoot, ...ACHIEVEMENTS_DIR.split("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "achievements.json"), "{nope", "utf8");
    await expect(extractAchievements(sourceRoot, outRoot, LOCALES)).rejects.toThrow(/achievements\.json/);
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";
import { assetKind, classifyAsset, isPreviewable } from "../../../scripts/assets/classify";
import { loadRules, parseRules } from "../../../scripts/assets/rules";

const rules = loadRules(path.resolve("scripts/assets/rules.json"));

describe("classifyAsset with the project rules", () => {
  it("files equipment by type and item folder", () => {
    expect(classifyAsset("Assets/Art/Characters/Player/Equipment/Armor/Redstone_Armor/Unique/T_Redstone_Unique.png", rules)).toEqual({
      group: "equipment",
      sub: "護甲",
      detail: "Redstone_Armor",
      matched: true,
    });
    expect(classifyAsset("Assets/Art/Characters/Player/Equipment/Weapons/Axe/T_UI_Axe_Icon.png", rules)).toMatchObject({
      sub: "武器",
      detail: "Axe",
    });
  });

  it("uses a fixed sub-item where the folder is the sub-item", () => {
    expect(classifyAsset("Assets/Art/Characters/Enemies/Zombie/T_Zombie.png", rules)).toMatchObject({
      group: "creature",
      sub: "敵人",
      detail: "Zombie",
    });
    expect(classifyAsset("Assets/Cursors/T_handOpen.png", rules)).toMatchObject({ group: "ui", sub: "游標", detail: "" });
  });

  it("prefers the more specific rule", () => {
    expect(classifyAsset("Assets/Art/Characters/Friendlies/Pets/Bee/T_Bee.png", rules).sub).toBe("寵物");
    expect(classifyAsset("Assets/Art/Characters/Friendlies/Cat/T_Cat.png", rules).sub).toBe("友善生物");
    expect(classifyAsset("Assets/UI/Icons/Statuses/T_UI_Burning.png", rules)).toMatchObject({ group: "ui", sub: "狀態圖示" });
  });

  it("keeps unknown folder names under a matched prefix as the sub-item", () => {
    expect(classifyAsset("Assets/Art/Environment/DesertA1/Props/T_Pot.png", rules)).toMatchObject({
      group: "environment",
      sub: "DesertA1",
      detail: "Props",
    });
    // A biome added in a future update needs no new rule.
    expect(classifyAsset("Assets/Art/Environment/NetherB2/Props/T_New.png", rules)).toMatchObject({ sub: "NetherB2", matched: true });
  });

  it("puts new top-level folders under other and flags them as unmatched", () => {
    expect(classifyAsset("Assets/Mystery/Deep/T_X.png", rules)).toEqual({ group: "other", sub: "Mystery", detail: "Deep", matched: false });
    expect(classifyAsset("Assets/T_Root.png", rules)).toMatchObject({ group: "other", sub: "（根目錄）", matched: false });
  });

  it("accepts Windows separators", () => {
    expect(classifyAsset("Assets\\Cursors\\T_handOpen.png", rules).sub).toBe("游標");
  });
});

describe("rules data", () => {
  const base = { extensions: ["png"], groups: { other: "其他", ui: "UI" }, rules: [] };

  it("orders rules longest prefix first whatever the file order", () => {
    const parsed = parseRules({
      ...base,
      rules: [
        { prefix: "Assets/UI", group: "ui", sub: "一般" },
        { prefix: "Assets/UI/Icons", group: "ui", sub: "圖示" },
      ],
    });
    expect(classifyAsset("Assets/UI/Icons/T_A.png", parsed).sub).toBe("圖示");
  });

  it("rejects a rule for an undefined group", () => {
    expect(() => parseRules({ ...base, rules: [{ prefix: "Assets/X", group: "nope" }] })).toThrow(/未定義的分類 "nope"/);
  });

  it("requires the fallback group", () => {
    expect(() => parseRules({ ...base, groups: { ui: "UI" } })).toThrow(/other/);
  });

  it("rejects malformed prefixes and duplicates", () => {
    expect(() => parseRules({ ...base, rules: [{ prefix: "Assets/UI/", group: "ui" }] })).toThrow(/prefix/);
    expect(() =>
      parseRules({ ...base, rules: [{ prefix: "Assets/UI", group: "ui" }, { prefix: "Assets/UI", group: "ui" }] }),
    ).toThrow(/重複/);
  });

  it("rejects unknown keys so typos do not pass silently", () => {
    expect(() => parseRules({ ...base, rules: [{ prefix: "Assets/UI", group: "ui", subb: "x" }] })).toThrow();
  });
});

describe("assetKind", () => {
  it("tells icons, material maps, textures and HDR apart", () => {
    expect(assetKind("T_UI_Axe_Icon.png")).toBe("icon");
    expect(assetKind("T_Bee_Icon.png")).toBe("icon");
    expect(assetKind("T_Redstone_MRES2.png")).toBe("map");
    expect(assetKind("T_Rock_N.tga")).toBe("map");
    expect(assetKind("T_Redstone.png")).toBe("texture");
    expect(assetKind("T_FD_Cubemap.hdr")).toBe("hdr");
    expect(assetKind("T_Sky.exr")).toBe("hdr");
  });

  it("knows which files a browser can preview", () => {
    expect(isPreviewable("a.png")).toBe(true);
    expect(isPreviewable("a.tga")).toBe(false);
    expect(isPreviewable("a.hdr")).toBe(false);
  });
});

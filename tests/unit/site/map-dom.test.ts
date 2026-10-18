import { describe, expect, it } from "vitest";
import { pinParts, popupLinks, popupTexts, resultText, shownKind } from "../../../src/lib/map/marker-dom";
import type { PayloadMarker } from "../../../src/lib/map/payload";

const marker = (kind: PayloadMarker["kind"], name: string, extra: Partial<PayloadMarker> = {}): PayloadMarker => ({
  id: `${kind}-1`,
  kind,
  px: 0,
  py: 0,
  name: { zh: name, en: name },
  ...extra,
});

describe("shownKind", () => {
  it("drops the kind label when the name already says it", () => {
    expect(shownKind("裂隙", "裂隙")).toBeUndefined();
    expect(shownKind("鐵匠", "商人")).toBe("商人");
    expect(shownKind(undefined, "商人")).toBe("商人");
  });
});

describe("popupTexts", () => {
  it("shows a rift's name once, not the kind and then the same name", () => {
    const rift = marker("rift", "裂隙", { area: { zh: "咆哮森林" } });
    expect(popupTexts(rift, "zh", "裂隙")).toEqual({ name: "裂隙", area: "咆哮森林" });
  });

  it("keeps the kind label above a name that differs from it", () => {
    const smith = marker("merchant", "鐵匠", { note: { zh: "販售武器" } });
    expect(popupTexts(smith, "zh", "商人")).toEqual({ kind: "商人", name: "鐵匠", note: "販售武器" });
  });
});

describe("popupTexts kind note", () => {
  it("shows the kind's own note when the marker has none", () => {
    const storm = marker("storm", "咆哮森林");
    expect(popupTexts(storm, "zh", "風暴產生器", "可能出現的位置")).toEqual({ kind: "風暴產生器", name: "咆哮森林", note: "可能出現的位置" });
  });

  it("lets a marker's own note win", () => {
    const smith = marker("merchant", "鐵匠", { note: { zh: "販售武器" } });
    expect(popupTexts(smith, "zh", "商人", "別的").note).toBe("販售武器");
  });
});

describe("popupLinks", () => {
  const title = (zh: string) => ({ zh, en: zh });

  it("links the name itself when the pin is one quest's spot", () => {
    const spot = marker("quest-main", "小嚎村的沉寂", { quests: [{ slug: "ca02", title: title("小嚎村的沉寂") }] });
    expect(popupLinks(spot, "zh")).toEqual({ nameHref: "/zh/quests/ca02/", list: [] });
  });

  it("lists an area's quests under the area name", () => {
    const area = marker("quest-side", "咆哮森林", { quests: [{ slug: "ca03", title: title("甲") }, { slug: "foa1-s08-a", title: title("乙") }] });
    expect(popupLinks(area, "zh")).toEqual({
      list: [
        { title: "甲", href: "/zh/quests/ca03/" },
        { title: "乙", href: "/zh/quests/foa1-s08-a/" },
      ],
    });
  });

  it("links a talisman chest's name to its talisman", () => {
    const chest = marker("talisman-chest", "幸運草", { entry: { category: "talisman", slug: "lucky-clover" } });
    expect(popupLinks(chest, "zh")).toEqual({ nameHref: "/zh/talisman/lucky-clover/", list: [] });
  });

  it("gives other markers no links", () => {
    expect(popupLinks(marker("merchant", "鐵匠"), "zh")).toEqual({ list: [] });
  });
});

describe("resultText", () => {
  it("joins name, kind and area, skipping the kind when the name says it", () => {
    expect(resultText(marker("rift", "裂隙", { area: { zh: "咆哮森林" } }), "zh", "裂隙")).toBe("裂隙 · 咆哮森林");
    expect(resultText(marker("merchant", "鐵匠"), "zh", "商人")).toBe("鐵匠 · 商人");
  });
});

describe("pinParts", () => {
  it("gives area labels text only, never an icon", () => {
    expect(pinParts(marker("area", "咆哮森林", { icon: "icons/map/forest.png" }), "zh")).toEqual({ className: "map-label", text: "咆哮森林" });
  });

  it("gives other markers their icon and no text", () => {
    expect(pinParts(marker("rift", "裂隙", { icon: "icons/map/rift.png" }), "zh")).toEqual({ className: "map-pin", icon: "icons/map/rift.png" });
    expect(pinParts(marker("minecart", "礦車站"), "zh")).toEqual({ className: "map-pin" });
  });
});

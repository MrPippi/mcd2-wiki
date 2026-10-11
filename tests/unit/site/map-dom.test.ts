import { describe, expect, it } from "vitest";
import { popupTexts, resultText, shownKind } from "../../../src/lib/map/marker-dom";
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

describe("resultText", () => {
  it("joins name, kind and area, skipping the kind when the name says it", () => {
    expect(resultText(marker("rift", "裂隙", { area: { zh: "咆哮森林" } }), "zh", "裂隙")).toBe("裂隙 · 咆哮森林");
    expect(resultText(marker("merchant", "鐵匠"), "zh", "商人")).toBe("鐵匠 · 商人");
  });
});

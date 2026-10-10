import { describe, expect, it } from "vitest";
import { resolveUiValue, t } from "../../../src/lib/ui-strings";

describe("resolveUiValue", () => {
  const all = { own: "file", game: "game", english: "english" };

  it("prefers the language file, then the game, for hand-written languages", () => {
    expect(resolveUiValue("k", true, all)).toBe("file");
    expect(resolveUiValue("k", true, { game: "game", english: "english" })).toBe("game");
  });

  it("prefers the game, then the language file, for other languages", () => {
    expect(resolveUiValue("k", false, all)).toBe("game");
    expect(resolveUiValue("k", false, { own: "file", english: "english" })).toBe("file");
  });

  it("falls back to English, then to the key, without throwing", () => {
    expect(resolveUiValue("k", true, { english: "english" })).toBe("english");
    expect(resolveUiValue("k", false, { english: { one: "a", other: "b" } })).toEqual({ one: "a", other: "b" });
    expect(resolveUiValue("k", false, {})).toBe("k");
  });
});

describe("label colons", () => {
  it("uses an ASCII colon and space in English and a full-width colon in CJK", () => {
    expect(t("en", "labelColon")).toBe(": ");
    expect(t("zh", "labelColon")).toBe("：");
    expect(t("ja", "labelColon")).toBe("：");
  });
});

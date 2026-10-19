import { describe, expect, it } from "vitest";
import { TAB_ORDER, adjacentCategory, keyStep } from "../../../shared/tabs";

describe("adjacentCategory", () => {
  const order = ["melee", "ranged", "armor"] as const;

  it("moves forward and backward", () => {
    expect(adjacentCategory(order, "melee", 1)).toBe("ranged");
    expect(adjacentCategory(order, "ranged", -1)).toBe("melee");
  });

  it("wraps around both ends", () => {
    expect(adjacentCategory(order, "armor", 1)).toBe("melee");
    expect(adjacentCategory(order, "melee", -1)).toBe("armor");
  });

  it("starts at the first or last tab when there is no current category", () => {
    expect(adjacentCategory(order, undefined, 1)).toBe("melee");
    expect(adjacentCategory(order, undefined, -1)).toBe("armor");
    expect(adjacentCategory(order, "effect", 1)).toBe("melee");
  });

  it("rejects an empty order", () => {
    expect(() => adjacentCategory([], undefined, 1)).toThrow();
  });
});

describe("keyStep", () => {
  const free = { tagName: "BODY", modifier: false };

  it("maps Q and E in either case", () => {
    expect(keyStep("e", free)).toBe(1);
    expect(keyStep("E", free)).toBe(1);
    expect(keyStep("q", free)).toBe(-1);
    expect(keyStep("Q", free)).toBe(-1);
    expect(keyStep("w", free)).toBeNull();
  });

  it("ignores keys typed into form fields or editable content", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(keyStep("e", { tagName, modifier: false })).toBeNull();
    }
    expect(keyStep("e", { tagName: "DIV", isContentEditable: true, modifier: false })).toBeNull();
  });

  it("ignores shortcuts with modifier keys", () => {
    expect(keyStep("e", { tagName: "BODY", modifier: true })).toBeNull();
  });
});

describe("TAB_ORDER", () => {
  it("lists the seven published categories in navigation order", () => {
    expect(TAB_ORDER).toEqual(["melee", "ranged", "armor", "artifact", "talisman", "enchantment", "effect"]);
  });
});

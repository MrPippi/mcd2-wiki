import { describe, expect, it } from "vitest";
import { itemKicker, setKicker } from "../../../src/lib/kicker";

describe("kickers", () => {
  it("names each published category in singular English", () => {
    expect(itemKicker("melee", "normal")).toBe("MELEE WEAPON");
    expect(itemKicker("ranged", "normal")).toBe("RANGED WEAPON");
    expect(itemKicker("armor", "normal")).toBe("ARMOR");
    expect(itemKicker("artifact", "normal")).toBe("ARTIFACT");
    expect(itemKicker("talisman", "normal")).toBe("TALISMAN");
    expect(itemKicker("enchantment", "normal")).toBe("ENCHANTMENT");
    expect(itemKicker("effect", "normal")).toBe("EFFECT");
  });

  it("prefixes unique items", () => {
    expect(itemKicker("melee", "unique")).toBe("UNIQUE MELEE WEAPON");
  });

  it("labels armor sets", () => {
    expect(setKicker("normal")).toBe("ARMOR SET");
    expect(setKicker("unique")).toBe("UNIQUE ARMOR SET");
  });
});

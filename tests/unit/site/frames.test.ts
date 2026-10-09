import { describe, expect, it } from "vitest";
import { frameFor } from "../../../src/lib/frames";

const ALL = { slot: "icons/frames/slot.png", enchantment: "icons/frames/enchantment.png" };

describe("frameFor", () => {
  it("frames equipment and statuses with the item slot", () => {
    expect(frameFor("melee", ALL)).toEqual({ name: "slot", path: "icons/frames/slot.png" });
    expect(frameFor("armor", ALL)).toEqual({ name: "slot", path: "icons/frames/slot.png" });
    expect(frameFor("status", ALL)).toEqual({ name: "slot", path: "icons/frames/slot.png" });
  });

  it("frames enchantments and books with the book slot", () => {
    expect(frameFor("enchantment", ALL)).toEqual({ name: "enchantment", path: "icons/frames/enchantment.png" });
    expect(frameFor("enchantment-book", ALL)).toEqual({ name: "enchantment", path: "icons/frames/enchantment.png" });
  });

  it("returns nothing for effects or when the frame was not extracted", () => {
    expect(frameFor("effect", ALL)).toBeUndefined();
    expect(frameFor("enchantment", { slot: ALL.slot })).toBeUndefined();
  });

  it("uses the extracted frames by default", () => {
    expect(frameFor("melee")?.path).toBe("icons/frames/slot.png");
  });
});

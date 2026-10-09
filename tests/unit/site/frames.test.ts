import { describe, expect, it } from "vitest";
import { frameFor } from "../../../src/lib/frames";

const ALL = {
  slot: "icons/frames/slot.png",
  enchantment: "icons/frames/enchantment.png",
  artifact: "icons/frames/artifact.png",
};

describe("frameFor", () => {
  it("frames equipment and statuses with the item slot", () => {
    expect(frameFor("melee", ALL)).toEqual({ name: "slot", path: "icons/frames/slot.png" });
    expect(frameFor("armor", ALL)).toEqual({ name: "slot", path: "icons/frames/slot.png" });
    expect(frameFor("status", ALL)).toEqual({ name: "slot", path: "icons/frames/slot.png" });
  });

  it("frames artifacts with the hotbar artifact slot", () => {
    expect(frameFor("artifact", ALL)).toEqual({ name: "artifact", path: "icons/frames/artifact.png" });
  });

  it("falls back to the item slot when the artifact slot was not extracted", () => {
    expect(frameFor("artifact", { slot: ALL.slot })).toEqual({ name: "slot", path: "icons/frames/slot.png" });
  });

  it("frames enchantments and books with the book slot", () => {
    expect(frameFor("enchantment", ALL)).toEqual({ name: "enchantment", path: "icons/frames/enchantment.png" });
    expect(frameFor("enchantment-book", ALL)).toEqual({ name: "enchantment", path: "icons/frames/enchantment.png" });
  });

  it("returns nothing for effects or when no frame was extracted", () => {
    expect(frameFor("effect", ALL)).toBeUndefined();
    expect(frameFor("enchantment", { slot: ALL.slot })).toBeUndefined();
  });

  it("uses the extracted frames by default", () => {
    expect(frameFor("melee")?.path).toBe("icons/frames/slot.png");
    expect(frameFor("artifact")?.path).toBe("icons/frames/artifact.png");
  });
});

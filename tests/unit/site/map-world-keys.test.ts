import { describe, expect, it } from "vitest";
import { adjacentWorld, isTypingTarget, worldStep } from "../../../src/lib/map/world-keys";

const press = (key: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
});

describe("worldStep", () => {
  it("maps Z to the previous world and X to the next, in either case", () => {
    expect(worldStep(press("z"))).toBe(-1);
    expect(worldStep(press("x"))).toBe(1);
    expect(worldStep(press("Z"))).toBe(-1);
  });

  it("ignores other keys and any modifier", () => {
    expect(worldStep(press("a"))).toBeUndefined();
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) expect(worldStep(press("z", { [modifier]: true }))).toBeUndefined();
  });
});

describe("adjacentWorld", () => {
  const worlds = ["overworld", "sift", "camp"] as const;

  it("steps to the neighbour and wraps round at both ends", () => {
    expect(adjacentWorld(worlds, "overworld", 1)).toBe("sift");
    expect(adjacentWorld(worlds, "sift", -1)).toBe("overworld");
    expect(adjacentWorld(worlds, "overworld", -1)).toBe("camp");
    expect(adjacentWorld(worlds, "camp", 1)).toBe("overworld");
  });

  it("stays put when the world is not listed", () => {
    expect(adjacentWorld(["sift"], "camp", 1)).toBe("camp");
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields and editable elements only", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

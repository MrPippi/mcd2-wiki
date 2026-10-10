import { describe, expect, it } from "vitest";
import { formatView, parseView, parseWorld, worldSearch } from "../../../src/lib/map/view-state";

const LIMITS = { zMin: 0, zMax: 5, imageSize: 8192 };

describe("parseWorld", () => {
  it("reads the world from the query", () => {
    expect(parseWorld("?world=sift", ["overworld", "sift", "camp"])).toBe("sift");
  });

  it("falls back to the first available world", () => {
    expect(parseWorld("", ["overworld", "sift"])).toBe("overworld");
    expect(parseWorld("?world=nether", ["overworld", "sift"])).toBe("overworld");
    expect(parseWorld("?world=camp", ["overworld", "sift"])).toBe("overworld");
    expect(parseWorld("?world=sift", [])).toBeUndefined();
  });
});

describe("parseView", () => {
  it("reads zoom and centre from the hash", () => {
    expect(parseView("#3/4000/4400", LIMITS)).toEqual({ z: 3, px: 4000, py: 4400 });
  });

  it("clamps values outside the map", () => {
    expect(parseView("#99/-50/99999", LIMITS)).toEqual({ z: 5, px: 0, py: 8192 });
    expect(parseView("#-2/10.5/20", LIMITS)).toEqual({ z: 0, px: 10.5, py: 20 });
  });

  it("opens at the minimum zoom when the hash asks for less", () => {
    expect(parseView("#0/100/100", { zMin: 2, zMax: 5, imageSize: 8192 })?.z).toBe(2);
  });

  it("ignores anything that is not a view", () => {
    expect(parseView("", LIMITS)).toBeUndefined();
    expect(parseView("#abc", LIMITS)).toBeUndefined();
    expect(parseView("#3/10", LIMITS)).toBeUndefined();
    expect(parseView("#3/10/20/30", LIMITS)).toBeUndefined();
  });
});

describe("formatView", () => {
  it("writes whole numbers", () => {
    expect(formatView({ z: 3, px: 4000.4, py: 4400.6 })).toBe("#3/4000/4401");
  });
});

describe("worldSearch", () => {
  it("sets the world and keeps other parameters", () => {
    expect(worldSearch("", "camp")).toBe("?world=camp");
    expect(worldSearch("?world=sift&x=1", "camp")).toBe("?world=camp&x=1");
  });
});

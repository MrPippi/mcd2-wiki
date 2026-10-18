import { describe, expect, it } from "vitest";
import { nearestPlace } from "../../../scripts/extract/drop-regular";
import { buildHierarchy } from "../../../scripts/extract/drop-slots";

const places = [
  { id: "area:SW.Area.Meadow.A1", tag: "SW.Area.Meadow.A1" },
  { id: "area:SW.Area.Meadow.A2", tag: "SW.Area.Meadow.A2" },
];
/** Meadow.T1 names Meadow.A2 as its parent through a trait; Meadow.R1 has none, so its parent is the tag without the last segment. */
const parents = buildHierarchy([
  { TypeTag: { TagName: "SW.Area.Meadow.T1" }, Traits: { GameplayTags: [{ TagName: "SW.Area.Meadow.A2" }] } },
  { TypeTag: { TagName: "SW.Area.Meadow.A1.R1" } },
]);

describe("nearestPlace", () => {
  it("is the area itself when it has a pool", () => {
    expect(nearestPlace("SW.Area.Meadow.A1", places, parents)?.id).toBe("area:SW.Area.Meadow.A1");
  });

  it("follows the parent traits of a sub-area", () => {
    expect(nearestPlace("SW.Area.Meadow.T1", places, parents)?.id).toBe("area:SW.Area.Meadow.A2");
  });

  it("follows the tag path when a sub-area names no parent", () => {
    expect(nearestPlace("SW.Area.Meadow.A1.R1", places, parents)?.id).toBe("area:SW.Area.Meadow.A1");
  });

  it("matches the tag whatever its case", () => {
    expect(nearestPlace("sw.area.meadow.a2", places, parents)?.id).toBe("area:SW.Area.Meadow.A2");
  });

  it("is undefined when no pool is in the chain", () => {
    expect(nearestPlace("SW.Area.Forest.A2", places, parents)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { fillZoom } from "../../../src/lib/map/zoom";

describe("fillZoom", () => {
  it("is the smallest whole zoom at which the render covers the panel", () => {
    expect(fillZoom({ width: 920, height: 700 }, 8192, 5)).toBe(2);
    expect(fillZoom({ width: 1024, height: 700 }, 8192, 5)).toBe(2);
    expect(fillZoom({ width: 1025, height: 700 }, 8192, 5)).toBe(3);
    expect(fillZoom({ width: 360, height: 500 }, 8192, 5)).toBe(1);
  });

  it("is the top zoom when the panel is larger than the full-size render", () => {
    expect(fillZoom({ width: 9000, height: 700 }, 8192, 5)).toBe(5);
  });

  it("never goes below zoom 0", () => {
    expect(fillZoom({ width: 100, height: 100 }, 8192, 5)).toBe(0);
    expect(fillZoom({ width: 0, height: 0 }, 8192, 5)).toBe(0);
  });
});

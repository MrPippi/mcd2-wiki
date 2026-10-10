import { describe, expect, it } from "vitest";
import { overviewTile, tileUrlTemplate } from "../../../src/lib/map/tiles";

describe("map tiles", () => {
  it("builds the Leaflet tile URL under the site base", () => {
    expect(tileUrlTemplate("/", "overworld")).toBe("/map/overworld/{z}/{x}/{y}.webp");
    expect(tileUrlTemplate("/mcd2-wiki/", "sift")).toBe("/mcd2-wiki/map/sift/{z}/{x}/{y}.webp");
    expect(tileUrlTemplate("/mcd2-wiki", "camp")).toBe("/mcd2-wiki/map/camp/{z}/{x}/{y}.webp");
  });

  it("names the single zoom-0 tile as the world overview", () => {
    expect(overviewTile("camp")).toBe("map/camp/0/0/0.webp");
  });
});

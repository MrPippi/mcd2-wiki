import { describe, expect, it } from "vitest";
import { withCurrentLocation } from "../../../src/lib/lang-switch";

describe("withCurrentLocation", () => {
  it("appends the current query and anchor", () => {
    expect(withCurrentLocation("/en/search/", "?q=%E5%8A%8D", "")).toBe("/en/search/?q=%E5%8A%8D");
    expect(withCurrentLocation("/en/effect/", "", "#critical-edge")).toBe("/en/effect/#critical-edge");
  });

  it("replaces any query or anchor already on the link", () => {
    expect(withCurrentLocation("/en/search/?q=old#x", "?q=new", "#y")).toBe("/en/search/?q=new#y");
  });

  it("leaves the link unchanged when there is nothing to carry over", () => {
    expect(withCurrentLocation("/en/melee/", "", "")).toBe("/en/melee/");
  });
});

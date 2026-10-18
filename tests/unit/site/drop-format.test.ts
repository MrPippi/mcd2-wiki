import { describe, expect, it } from "vitest";
import { formatDropOdds } from "../../../src/lib/drop-format";

describe("formatDropOdds", () => {
  it("keeps two decimals from 0.1% up, like the affix odds", () => {
    expect(formatDropOdds(0.123966941904)).toBe("12.40%");
    expect(formatDropOdds(0.001)).toBe("0.10%");
    expect(formatDropOdds(1)).toBe("100.00%");
  });

  it("shows two significant digits below 0.1%, so small chances stay different", () => {
    expect(formatDropOdds(0.000547619)).toBe("0.055%");
    expect(formatDropOdds(0.0000476190476)).toBe("0.0048%");
    expect(formatDropOdds(0.0000123)).toBe("0.0012%");
  });

  it("floors at 0.0001% and prints 0% for none", () => {
    expect(formatDropOdds(0.0000009)).toBe("<0.0001%");
    expect(formatDropOdds(0.000001)).toBe("0.00010%");
    expect(formatDropOdds(0)).toBe("0%");
  });
});

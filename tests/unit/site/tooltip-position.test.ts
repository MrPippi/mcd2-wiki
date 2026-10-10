import { describe, expect, it } from "vitest";
import { GAP, MARGIN, OFFSET, besideElement, followCursor } from "../../../src/lib/tooltip-position";

const viewport = { width: 1000, height: 800 };
const size = { width: 300, height: 200 };

describe("followCursor", () => {
  it("sits below and to the right of the cursor", () => {
    expect(followCursor({ x: 100, y: 100 }, size, viewport)).toEqual({ left: 100 + OFFSET, top: 100 + OFFSET });
  });

  it("flips to the left of the cursor near the right edge", () => {
    expect(followCursor({ x: 900, y: 100 }, size, viewport)).toEqual({ left: 900 - OFFSET - 300, top: 100 + OFFSET });
  });

  it("flips above the cursor near the bottom edge", () => {
    expect(followCursor({ x: 100, y: 700 }, size, viewport)).toEqual({ left: 100 + OFFSET, top: 700 - OFFSET - 200 });
  });

  it("flips both ways in the bottom-right corner", () => {
    expect(followCursor({ x: 950, y: 750 }, size, viewport)).toEqual({ left: 950 - OFFSET - 300, top: 750 - OFFSET - 200 });
  });

  it("stays inside the viewport when neither side fits", () => {
    const narrow = { width: 400, height: 300 };
    const placed = followCursor({ x: 200, y: 150 }, size, narrow);
    expect(placed.left).toBeGreaterThanOrEqual(MARGIN);
    expect(placed.left + size.width).toBeLessThanOrEqual(narrow.width - MARGIN);
    expect(placed.top).toBeGreaterThanOrEqual(MARGIN);
  });

  it("pins to the top-left margin when the box is larger than the viewport", () => {
    expect(followCursor({ x: 50, y: 50 }, { width: 2000, height: 2000 }, viewport)).toEqual({ left: MARGIN, top: MARGIN });
  });
});

describe("besideElement", () => {
  const rect = { left: 100, top: 100, right: 184, bottom: 184 };

  it("sits to the right of the element, aligned with its top", () => {
    expect(besideElement(rect, size, viewport)).toEqual({ left: 184 + GAP, top: 100 });
  });

  it("moves to the left side when the right side does not fit", () => {
    const nearRight = { left: 800, top: 100, right: 884, bottom: 184 };
    expect(besideElement(nearRight, size, viewport)).toEqual({ left: 800 - GAP - 300, top: 100 });
  });

  it("keeps the box inside the viewport near the bottom", () => {
    const nearBottom = { left: 100, top: 750, right: 184, bottom: 834 };
    expect(besideElement(nearBottom, size, viewport).top).toBe(800 - MARGIN - 200);
  });
});

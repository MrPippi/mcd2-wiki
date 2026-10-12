import { describe, expect, it } from "vitest";
import { CARD_FOOTER, CARD_HEIGHT, CARD_PADDING, CARD_ROWS, CARD_WIDTH, cardCells, fitText } from "../../../src/lib/build/card";
import { SLOT_KEYS } from "../../../src/lib/build/slots";

describe("cardCells", () => {
  const cells = cardCells();

  it("places every slot once", () => {
    expect(cells.map((cell) => cell.slot).sort()).toEqual([...SLOT_KEYS].sort());
    expect(CARD_ROWS.flat()).toHaveLength(SLOT_KEYS.length);
  });

  it("keeps every cell inside the card, above the footer", () => {
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(CARD_PADDING);
      expect(cell.x + cell.width).toBeLessThanOrEqual(CARD_WIDTH - CARD_PADDING + 0.001);
      expect(cell.y + cell.height).toBeLessThanOrEqual(CARD_HEIGHT - CARD_FOOTER);
      expect(cell.textWidth).toBeGreaterThan(100);
    }
  });

  it("does not overlap cells", () => {
    for (const a of cells) {
      for (const b of cells) {
        if (a === b) continue;
        const apart = a.x + a.width <= b.x + 0.001 || b.x + b.width <= a.x + 0.001 || a.y + a.height <= b.y + 0.001 || b.y + b.height <= a.y + 0.001;
        expect(apart, `${a.slot}/${b.slot}`).toBe(true);
      }
    }
  });
});

describe("fitText", () => {
  const measure = (text: string): number => [...text].length * 10;

  it("keeps text that fits", () => {
    expect(fitText("Sword", 50, measure)).toBe("Sword");
  });

  it("cuts long text and adds an ellipsis within the width", () => {
    const cut = fitText("Hunter's Promise", 80, measure);
    expect(cut).toBe("Hunter'…");
    expect(measure(cut)).toBeLessThanOrEqual(80);
  });

  it("does not split surrogate pairs", () => {
    expect(fitText("😀😀😀😀", 30, measure)).toBe("😀😀…");
  });

  it("drops trailing spaces before the ellipsis", () => {
    expect(fitText("Ab cdef", 40, measure)).toBe("Ab…");
  });

  it("returns only the ellipsis when nothing else fits", () => {
    expect(fitText("Sword", 5, measure)).toBe("…");
  });
});

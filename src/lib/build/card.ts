/** Layout of the shareable build image; the drawing itself happens on a canvas in the page script. */
import type { EnchantTier, SlotKey } from "./slots";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const CARD_PADDING = 48;
/** Space above the grid for the site name and the title. */
export const CARD_HEADER = 120;
/** Space below the grid for the page address. */
export const CARD_FOOTER = 48;
export const CARD_ICON = 72;
/** Gap between an icon and its text. */
export const CARD_GAP = 14;

/** One row per kind of gear. */
export const CARD_ROWS: readonly (readonly SlotKey[])[] = [
  ["melee", "ranged"],
  ["helmet", "chest", "leggings", "boots"],
  ["artifact1", "artifact2", "artifact3"],
  ["talisman1", "talisman2", "talisman3"],
];
const COLUMNS = Math.max(...CARD_ROWS.map((row) => row.length));

export interface CardCell {
  readonly slot: SlotKey;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Room left for the text beside the icon. */
  readonly textWidth: number;
}

export function cardCells(): CardCell[] {
  const width = (CARD_WIDTH - CARD_PADDING * 2) / COLUMNS;
  const height = (CARD_HEIGHT - CARD_HEADER - CARD_FOOTER - CARD_PADDING) / CARD_ROWS.length;
  return CARD_ROWS.flatMap((row, r) =>
    row.map((slot, c) => ({
      slot,
      x: CARD_PADDING + c * width,
      y: CARD_HEADER + r * height,
      width,
      height,
      textWidth: width - CARD_ICON - CARD_GAP * 2,
    })),
  );
}

const ELLIPSIS = "…";

/** `text` cut to fit `maxWidth` (as measured by `measure`), ending in an ellipsis when cut. */
export function fitText(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  const chars = [...text];
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, mid).join("") + ELLIPSIS) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return chars.slice(0, low).join("").trimEnd() + ELLIPSIS;
}

/** Enchantment levels as the game writes them. */
export const ROMAN: Readonly<Record<EnchantTier, string>> = { 1: "I", 2: "II", 3: "III" };

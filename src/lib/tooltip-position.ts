export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Placement {
  readonly left: number;
  readonly top: number;
}

/** Distance from the cursor to the tooltip. */
export const OFFSET = 16;
/** Distance from a keyboard-focused item to the tooltip. */
export const GAP = 12;
/** Smallest distance from the tooltip to the viewport edge. */
export const MARGIN = 8;

/** Keeps a box of `length` inside `[MARGIN, limit - MARGIN]`; a box too big for that pins to the start margin. */
const clamp = (start: number, length: number, limit: number): number =>
  Math.max(MARGIN, Math.min(start, limit - MARGIN - length));

/** Places `preferred` along one axis, or `fallback` when the box would run past the far edge. */
const pick = (preferred: number, fallback: number, length: number, limit: number): number =>
  preferred + length <= limit - MARGIN ? preferred : fallback;

/** Below-right of the cursor, flipping left or up at the viewport edges, like an in-game item tooltip. */
export function followCursor(cursor: Point, size: Size, viewport: Size): Placement {
  const left = pick(cursor.x + OFFSET, cursor.x - OFFSET - size.width, size.width, viewport.width);
  const top = pick(cursor.y + OFFSET, cursor.y - OFFSET - size.height, size.height, viewport.height);
  return { left: clamp(left, size.width, viewport.width), top: clamp(top, size.height, viewport.height) };
}

/** Right of a focused element and level with its top, or on its left when the right side does not fit. */
export function besideElement(rect: Rect, size: Size, viewport: Size): Placement {
  const left = pick(rect.right + GAP, rect.left - GAP - size.width, size.width, viewport.width);
  return { left: clamp(left, size.width, viewport.width), top: clamp(rect.top, size.height, viewport.height) };
}

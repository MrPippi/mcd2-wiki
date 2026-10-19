/**
 * Game position → pixel on a world's stitched BeautyRender, checked against buildings in town (spec §3).
 * The minimap is MapDims blocks square, 1px per block, with the game's Y to the right and X upwards from
 * MinPos at the bottom-left; the render is that square shrunk by FancyMapSizeRatio, still anchored bottom-left.
 */
export interface WorldFrame {
  /** Region bounds in blocks. */
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  /** MapDims: side of the minimap square in blocks. */
  readonly span: number;
  /** FancyMapSizeRatio. */
  readonly ratio: number;
  /** Side of the stitched render in pixels. */
  readonly imageSize: number;
}

export interface BlockPoint {
  readonly x: number;
  readonly y: number;
}

export interface ImagePoint {
  readonly px: number;
  readonly py: number;
}

const CM_PER_BLOCK = 100;

export const toBlocks = (location: { readonly X: number; readonly Y: number }): BlockPoint => ({
  x: location.X / CM_PER_BLOCK,
  y: location.Y / CM_PER_BLOCK,
});

export const isInside = (frame: WorldFrame, block: BlockPoint): boolean =>
  block.x >= frame.minX && block.x <= frame.maxX && block.y >= frame.minY && block.y <= frame.maxY;

export function toImagePixel(frame: WorldFrame, block: BlockPoint): ImagePoint {
  const u = ((block.y - frame.minY) / frame.span) * frame.ratio;
  const v = 1 - ((block.x - frame.minX) / frame.span) * frame.ratio;
  return { px: u * frame.imageSize, py: v * frame.imageSize };
}

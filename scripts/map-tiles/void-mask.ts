/**
 * Finds the "void ground" the game bakes into its map renders: a flat tan texture
 * (around 142–156 / 135–148 / 120–134) that fills everything outside the playable areas.
 * Paths, stone and sand are close in brightness but not in hue, so the test is on the
 * channel differences; small tan patches inside the content survive the area cut.
 */

const RED = { min: 130, max: 170 };
/** r − g and g − b of the void: a warm grey, never neutral (stone) or saturated (sand, dirt). */
const RED_MINUS_GREEN = { min: 3, max: 12 };
const GREEN_MINUS_BLUE = { min: 9, max: 19 };

const within = (value: number, range: { min: number; max: number }): boolean => value >= range.min && value <= range.max;

export const isVoidColour = (r: number, g: number, b: number): boolean =>
  within(r, RED) && within(r - g, RED_MINUS_GREEN) && within(g - b, GREEN_MINUS_BLUE);

/**
 * 1 for each pixel of a void-coloured region (4-connected) of at least `minArea` pixels, else 0.
 * `rgb` is packed RGB, `width × height × 3` bytes.
 */
export function voidMask(rgb: Uint8Array, width: number, height: number, minArea: number): Uint8Array {
  const size = width * height;
  if (rgb.length !== size * 3) throw new RangeError(`voidMask：資料長度 ${rgb.length} 與 ${width}×${height} 不符`);
  const candidate = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) candidate[i] = isVoidColour(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) ? 1 : 0;

  const mask = new Uint8Array(size);
  const seen = new Uint8Array(size);
  const stack = new Int32Array(size);
  const region = new Int32Array(size);
  for (let start = 0; start < size; start += 1) {
    if (!candidate[start] || seen[start]) continue;
    const count = floodRegion(start, candidate, seen, stack, region, width, height);
    if (count >= minArea) for (let i = 0; i < count; i += 1) mask[region[i]] = 1;
  }
  return mask;
}

/** Collects the 4-connected candidate region around `start` into `region`; returns its size. */
function floodRegion(start: number, candidate: Uint8Array, seen: Uint8Array, stack: Int32Array, region: Int32Array, width: number, height: number): number {
  let top = 0;
  let count = 0;
  stack[top++] = start;
  seen[start] = 1;
  while (top > 0) {
    const index = stack[--top];
    region[count++] = index;
    const x = index % width;
    const y = (index - x) / width;
    const visit = (next: number): void => {
      if (candidate[next] && !seen[next]) {
        seen[next] = 1;
        stack[top++] = next;
      }
    };
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y < height - 1) visit(index + width);
  }
  return count;
}

/** `mask` grown by one pixel into its four neighbours. */
export function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const x = i % width;
    out[i] = 1;
    if (x > 0) out[i - 1] = 1;
    if (x < width - 1) out[i + 1] = 1;
    if (i >= width) out[i - width] = 1;
    if (i < (height - 1) * width) out[i + width] = 1;
  }
  return out;
}

/** Average of each cell's (2·radius+1)² neighbourhood of a 0/1 mask, as 0..1; cells beyond the border count as the nearest edge cell. */
function boxBlur(mask: Uint8Array, width: number, height: number, radius: number): Float32Array {
  const clamp = (value: number, max: number): number => Math.min(max, Math.max(0, value));
  const across = new Float32Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let d = -radius; d <= radius; d += 1) sum += mask[y * width + clamp(x + d, width - 1)];
      across[y * width + x] = sum / (2 * radius + 1);
    }
  }
  const out = new Float32Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let d = -radius; d <= radius; d += 1) sum += across[clamp(y + d, height - 1) * width + x];
      out[y * width + x] = sum / (2 * radius + 1);
    }
  }
  return out;
}

/**
 * Opacity (0..255) per mask cell for a soft land edge: 0 at the land border, rising over about `radius` cells to full,
 * in `steps` flat levels so the fade stays pixel-art. `core` is 1 inside void; void cells themselves stay 0.
 */
export function featherMask(core: Uint8Array, width: number, height: number, radius: number, steps: number): Uint8Array {
  const land = core.map((cell) => 1 - cell);
  const blurred = boxBlur(land, width, height, radius);
  return Uint8Array.from(blurred, (value, i) => {
    if (!land[i]) return 0;
    // A land cell at the border averages about one half; a cell a full radius inside averages higher.
    const level = Math.min(1, Math.max(0, (value - 0.5) * 2.4));
    return Math.round((Math.ceil(level * steps) / steps) * 255);
  });
}

/** A world's void mask, held at 1/`scale` of the render, and where an image sits in the render. */
export interface VoidCut {
  /** Cells inside a void region: always cleared. */
  readonly core: Uint8Array;
  /** `core` plus one cell around it: cleared only where the full-size pixel itself is void-coloured. */
  readonly fringe: Uint8Array;
  /** Mask width in cells. */
  readonly width: number;
  /** Render pixels per mask cell. */
  readonly scale: number;
  /** Opacity per cell for the soft land edge (see featherMask); absent means fully opaque. */
  readonly feather?: Uint8Array;
  /** The image's top-left corner in render pixels. */
  readonly left: number;
  readonly top: number;
}

/** A copy of the RGBA image with the void made transparent. */
export function clearVoid(rgba: Uint8Array, width: number, height: number, cut: VoidCut): Uint8Array {
  if (rgba.length !== width * height * 4) throw new RangeError(`clearVoid：資料長度 ${rgba.length} 與 ${width}×${height} 不符`);
  const out = Uint8Array.from(rgba);
  for (let y = 0; y < height; y += 1) {
    const row = Math.floor((cut.top + y) / cut.scale) * cut.width;
    for (let x = 0; x < width; x += 1) {
      const cell = row + Math.floor((cut.left + x) / cut.scale);
      const p = (y * width + x) * 4;
      if (cut.fringe[cell] && (cut.core[cell] || isVoidColour(out[p], out[p + 1], out[p + 2]))) out[p + 3] = 0;
      else if (cut.feather && cut.feather[cell] < 255) out[p + 3] = Math.round((out[p + 3] * cut.feather[cell]) / 255);
    }
  }
  return out;
}

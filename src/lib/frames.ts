import type { Category, FrameName } from "../../scripts/extract/config";
import type { Frames } from "../../scripts/extract/schemas";
import { extractedFrames } from "./data";

/** "inventory" is the in-game gear slot, drawn in CSS, so it is always available. */
export type FrameKind = FrameName | "inventory";

/** Frames to try for each category, best match first. */
const FRAMES_FOR: Readonly<Partial<Record<Category, readonly FrameKind[]>>> = {
  melee: ["inventory"],
  ranged: ["inventory"],
  armor: ["inventory"],
  artifact: ["artifact", "inventory"],
  status: ["inventory"],
  enchantment: ["enchantment"],
  "enchantment-book": ["enchantment"],
};

export interface IconFrame {
  readonly name: FrameKind;
  /** Frame art to draw; absent for the CSS-drawn inventory slot. */
  readonly path?: string;
}

export function frameFor(category: Category, available: Frames = extractedFrames): IconFrame | undefined {
  for (const name of FRAMES_FOR[category] ?? []) {
    if (name === "inventory") return { name };
    const path = available[name];
    if (path) return { name, path };
  }
  return undefined;
}

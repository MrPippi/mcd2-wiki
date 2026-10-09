import type { Category, FrameName } from "../../scripts/extract/config";
import type { Frames } from "../../scripts/extract/schemas";
import { extractedFrames } from "./data";

/** Frames to try for each category, best match first. */
const FRAMES_FOR: Readonly<Partial<Record<Category, readonly FrameName[]>>> = {
  melee: ["slot"],
  ranged: ["slot"],
  armor: ["slot"],
  artifact: ["artifact", "slot"],
  status: ["slot"],
  enchantment: ["enchantment"],
  "enchantment-book": ["enchantment"],
};

export interface IconFrame {
  readonly name: FrameName;
  readonly path: string;
}

export function frameFor(category: Category, available: Frames = extractedFrames): IconFrame | undefined {
  const name = (FRAMES_FOR[category] ?? []).find((candidate) => available[candidate] !== undefined);
  const path = name ? available[name] : undefined;
  return name && path ? { name, path } : undefined;
}

import type { WorldKey } from "./worlds";

/** The keys the game's world map binds to the previous (Z) and next (X) dimension. */
export const PREVIOUS_WORLD_KEY = "z";
export const NEXT_WORLD_KEY = "x";

export interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

/** -1 for Z, +1 for X, undefined for any other key or one pressed with a modifier. */
export function worldStep(press: KeyPress): -1 | 1 | undefined {
  if (press.ctrlKey || press.metaKey || press.altKey || press.shiftKey) return undefined;
  const key = press.key.toLowerCase();
  if (key === PREVIOUS_WORLD_KEY) return -1;
  return key === NEXT_WORLD_KEY ? 1 : undefined;
}

/** The world `step` tabs from `current`, wrapping round at either end; `current` when it is not in the list. */
export function adjacentWorld(keys: readonly WorldKey[], current: WorldKey, step: -1 | 1): WorldKey {
  const index = keys.indexOf(current);
  if (index < 0 || keys.length === 0) return current;
  return keys[(index + step + keys.length) % keys.length];
}

const TYPING_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when a key press belongs to a text field (or other editable element) rather than the page. */
export const isTypingTarget = (target: { readonly tagName?: string; readonly isContentEditable?: boolean } | null): boolean =>
  target !== null && (TYPING_TAGS.has((target.tagName ?? "").toUpperCase()) || target.isContentEditable === true);

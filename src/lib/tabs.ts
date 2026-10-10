import type { Category } from "../../scripts/extract/config";
import { NAV_GROUPS } from "./i18n";

/** The category tab strip, in navigation order. */
export const TAB_ORDER: readonly Category[] = NAV_GROUPS.flatMap((group) => group.categories);

/** The tab Q (step -1) or E (step 1) leads to; wraps around, and starts at an end when there is no current tab. */
export function adjacentCategory(order: readonly Category[], current: Category | undefined, step: 1 | -1): Category {
  if (order.length === 0) throw new Error("adjacentCategory needs at least one category");
  const index = current === undefined ? -1 : order.indexOf(current);
  if (index === -1) return step === 1 ? order[0] : order[order.length - 1];
  return order[(index + step + order.length) % order.length];
}

export interface KeyContext {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
  readonly modifier: boolean;
}

const FORM_FIELDS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Which way a key press moves through the tabs, or null when it is not a tab shortcut here. */
export function keyStep(key: string, context: KeyContext): 1 | -1 | null {
  if (context.modifier || context.isContentEditable) return null;
  if (FORM_FIELDS.has((context.tagName ?? "").toUpperCase())) return null;
  const lower = key.toLowerCase();
  if (lower === "e") return 1;
  if (lower === "q") return -1;
  return null;
}

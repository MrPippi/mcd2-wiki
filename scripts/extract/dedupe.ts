import type { Category } from "../../shared/config";
import { issue, type Issue } from "./issues";
import type { Entry } from "../../shared/schemas";

/** Cosmetic tables keep legacy rows that repeat another item's name (e.g. two "Corrupted Creeper Cape"). */
const DEDUPED_CATEGORIES: ReadonlySet<Category> = new Set(["cape", "pet", "skin"]);

const groupKey = (entry: Entry): string | undefined =>
  DEDUPED_CATEGORIES.has(entry.category) && entry.release === "base"
    ? `${entry.category}:${entry.name.en.trim().toLowerCase()}`
    : undefined;

/** Keeps one published cosmetic per name, preferring the one with an icon. */
export function dedupeByName(entries: readonly Entry[]): { entries: Entry[]; issues: Issue[] } {
  const keepers = new Map<string, Entry>();
  for (const entry of entries) {
    const key = groupKey(entry);
    if (!key) continue;
    const current = keepers.get(key);
    if (!current || (!current.icon && entry.icon)) keepers.set(key, entry);
  }
  const dropped = entries.filter((entry) => {
    const key = groupKey(entry);
    return key !== undefined && keepers.get(key) !== entry;
  });
  return {
    entries: entries.filter((entry) => !dropped.includes(entry)),
    issues: dropped.map((entry) => {
      const keeper = keepers.get(groupKey(entry) as string) as Entry;
      return issue("duplicate-entry", `${entry.category}:${entry.id} (same name as ${keeper.id})`);
    }),
  };
}

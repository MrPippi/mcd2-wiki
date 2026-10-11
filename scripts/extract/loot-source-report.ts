/** Data problems in the loot tables that the item sources cannot show: unknown tags, spelling variants, odd row names. */
import { issue, type Issue } from "./issues";
import type { ItemIndex } from "./loot-items";
import { rawSlots, tagVariants } from "./loot-pools";
import type { LootRow } from "./loot-tables";
import { tagKey } from "./mob-tags";

/** Tags that are not items on the site and need no report (currencies, consumables, the default-table opt-out, TNT). */
export const IGNORED_TAG_PREFIXES = ["sw.item.currency.", "sw.item.consumable.", "sw.item.exceptfromdefaultloottables", "sw.item.tnt"] as const;
const PROPERTY_PREFIX = "sw.item.property.";
const ROW_NAME = /[^A-Za-z0-9_]/;

/** An item or set tag, a category (Property.*) tag some item carries, or an ignored non-item tag. */
function isAccounted(tag: string, index: ItemIndex): boolean {
  const key = tagKey(tag);
  if (index.knownTag(tag)) return true;
  if (key.startsWith(PROPERTY_PREFIX)) return index.withTrait(tag).length > 0;
  return IGNORED_TAG_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Every pool tag of every slot (exclusions included), first spelling of each, in table order. */
function poolTagsAsWritten(rows: readonly LootRow[]): string[] {
  const seen = new Set<string>();
  return rows
    .flatMap(rawSlots)
    .flatMap((slot) => slot.DropTable.Tags ?? [])
    .map((entry) => entry.TypeTag.TagName)
    .filter((tag) => {
      if (seen.has(tagKey(tag))) return false;
      seen.add(tagKey(tag));
      return true;
    });
}

/** loot-tag-unmatched (one per tag), loot-tag-case (one per spelling group), loot-row-name (one per row). */
export function reportLootTags(rows: readonly LootRow[], index: ItemIndex): Issue[] {
  return [
    ...poolTagsAsWritten(rows).filter((tag) => !isAccounted(tag, index)).map((tag) => issue("loot-tag-unmatched", tag)),
    ...tagVariants(rows).map((group) => issue("loot-tag-case", group.join(" | "))),
    ...rows.filter((row) => ROW_NAME.test(row.Name)).map((row) => issue("loot-row-name", row.Name)),
  ];
}

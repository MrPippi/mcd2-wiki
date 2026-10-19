/** Loot slot helpers shared by the mob drop rules and the area/chest/quest loot sources. */
import type { LootRow, LootSlotValue } from "./loot-tables";
import { LOOT_SLOT_KEYS, type LootSlotKey } from "../../shared/mob-schema";

const SLOT_PATTERN = /SW\.LootSlot\.(\w+)/i;
const SLOT_BY_NAME: Readonly<Record<string, LootSlotKey>> = {
  Item: "item",
  SpecialGear: "specialGear",
  EnchantedBook: "enchantedBook",
  Talismans: "talismans",
  Emeralds: "emeralds",
  SpringStone: "springStone",
  Consumable: "consumable",
  TNT: "tnt",
};

/** '(TagName="SW.LootSlot.SpringStone")' -> "springStone"; an empty or unknown slot name -> undefined. */
export function slotKeyOf(rawKey: string): LootSlotKey | undefined {
  const name = SLOT_PATTERN.exec(rawKey)?.[1];
  return name !== undefined && Object.hasOwn(SLOT_BY_NAME, name) ? SLOT_BY_NAME[name] : undefined;
}

/** The row's known slots, in LOOT_SLOT_KEYS order. A row without LootSlots has none. */
export function slotsOf(row: LootRow): ReadonlyMap<LootSlotKey, LootSlotValue> {
  const found = new Map<LootSlotKey, LootSlotValue>();
  for (const [rawKey, value] of Object.entries(row.LootDropDefinition.LootSlots ?? {})) {
    const key = slotKeyOf(rawKey);
    if (key !== undefined && !found.has(key)) found.set(key, value);
  }
  return new Map(LOOT_SLOT_KEYS.flatMap((key) => {
    const value = found.get(key);
    return value === undefined ? [] : [[key, value] as const];
  }));
}

/** True when the slot names its own item pool (DropTable.Tags has at least one entry). */
export const hasPoolTags = (slot: LootSlotValue): boolean => (slot.DropTable.Tags?.length ?? 0) > 0;

/** True when the slot adds items of its own: at least one Set entry with a weight above 0. Multiply entries only modify. */
export const hasOwnPool = (slot: LootSlotValue): boolean =>
  (slot.DropTable.Tags ?? []).some((entry) => entry.Operation === "Set" && entry.Weight > 0);

/** The Multiply-0 tags of a slot that has nothing but exclusions; [] for any other slot. */
export function exclusionOnlyTags(slot: LootSlotValue): string[] {
  const entries = slot.DropTable.Tags ?? [];
  const excludesOnly = entries.length > 0 && entries.every((entry) => entry.Operation === "Multiply" && entry.Weight === 0);
  return excludesOnly ? entries.map((entry) => entry.TypeTag.TagName) : [];
}

/** What a community build card shows: its items in slot order, read from the build link. Pure; loaded by the browser. */
import { BUILD_SLOTS, type PoolKey } from "../build/slots";

/** One item: its name and icon URL. */
export type ItemRef = readonly [name: string, icon: string | undefined];
/** Items by pool and slug, as the page embeds them. */
export type ItemIndex = Readonly<Partial<Record<PoolKey, Readonly<Record<string, ItemRef>>>>>;

export interface CardItem {
  readonly slot: string;
  readonly name: string;
  readonly icon?: string;
}

/** The build's items in slot order; slugs the site does not know are left out. */
export function cardItems(code: string, items: ItemIndex): CardItem[] {
  const params = new URLSearchParams(code);
  return BUILD_SLOTS.flatMap((slot) => {
    const slug = (params.get(slot.param) ?? "").split(",")[slot.index];
    const found = slug ? items[slot.pool]?.[slug] : undefined;
    return found ? [{ slot: slot.key, name: found[0], ...(found[1] ? { icon: found[1] } : {}) }] : [];
  });
}

/** Whether the build page's query names at least one item, so it is worth publishing. */
export const hasItems = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return [...new Set(BUILD_SLOTS.map((slot) => slot.param))].some((param) => (params.get(param) ?? "").replace(/,/g, "") !== "");
};

/** The API's error codes, mapped to the label keys the page sends along. */
export const ERROR_LABELS = {
  exists: "errExists",
  title: "errTitle",
  empty: "errEmpty",
  code: "errEmpty",
  rate: "errRate",
  hidden: "errHidden",
  turnstile: "errVerify",
} as const;
export type ErrorLabel = (typeof ERROR_LABELS)[keyof typeof ERROR_LABELS] | "actionFailed";

export const errorLabel = (error: unknown): ErrorLabel =>
  typeof error === "string" && error in ERROR_LABELS ? ERROR_LABELS[error as keyof typeof ERROR_LABELS] : "actionFailed";

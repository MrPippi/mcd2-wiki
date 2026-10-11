import type { Category } from "../../scripts/extract/config";
import { armorPieceOf, toSlug, variantOf } from "../../scripts/extract/keys";
import type { Entry } from "../../scripts/extract/schemas";
import { loc } from "./localized";

export function makeEntry(id: string, category: Category, extra: Partial<Entry> = {}): Entry {
  const armorPiece = category === "armor" ? armorPieceOf(id) : undefined;
  return {
    id,
    slug: toSlug(id),
    category,
    variant: variantOf(id),
    release: "base",
    name: loc({ zh: id, en: id }),
    ...(armorPiece ? { armorPiece } : {}),
    links: {},
    ...extra,
  };
}

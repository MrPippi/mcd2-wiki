import type { ArmorPiece } from "../../shared/schemas";

const KEY_PATTERN = /^SW_(Item|Enchantment|Effect|Status|Skin)_(.+?)_SW_TextEntry_(.+)$/i;
const SLUG_PREFIX = /^(?:Artifact_|EnchantmentBook_|Talisman_|Cosmetic_(?:Cape|Pet)_)/;
/** One cape key in the game files misspells "Cosmetic"; repair it so the field joins its cape. */
const ID_TYPOS: readonly (readonly [RegExp, string])[] = [[/^Cosmetec_/, "Cosmetic_"]];
const UNIQUE_SUFFIX = /_Unique\d*$/i;
const PIECE_PATTERN = /(Helmet|Chest|Leggings|Boots)/;

export interface ParsedKey {
  readonly kind: string;
  readonly id: string;
  readonly field: string;
}

export function parseKey(key: string): ParsedKey | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  const id = ID_TYPOS.reduce((current, [typo, fix]) => current.replace(typo, fix), match[2]);
  return { kind: match[1], id, field: match[3] };
}

export function toSlug(id: string): string {
  return id
    .replace(SLUG_PREFIX, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const baseId = (id: string): string => id.replace(UNIQUE_SUFFIX, "");

export const variantOf = (id: string): "normal" | "unique" => (UNIQUE_SUFFIX.test(id) ? "unique" : "normal");

export function armorPieceOf(id: string): ArmorPiece | undefined {
  const match = PIECE_PATTERN.exec(id);
  return match ? (match[1].toLowerCase() as ArmorPiece) : undefined;
}

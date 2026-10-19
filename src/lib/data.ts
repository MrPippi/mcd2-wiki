import { z } from "zod";
import { ICON_SOURCES, type Category } from "../../shared/config";
import {
  ArmorSetSchema,
  BrandSchema,
  EntrySchema,
  FramesSchema,
  UiIconsSchema,
  type ArmorSet,
  type Brand,
  type Entry,
  type Frames,
  type UiIcons,
} from "../../shared/schemas";
import rawSets from "../data/armor-sets.json";
import rawBrand from "../data/brand.json";
import rawCategoryIcons from "../data/category-icons.json";
import rawEntries from "../data/entries.json";
import rawFrames from "../data/frames.json";
import { isFullyDescribed } from "./gear-values";

export const extractedFrames: Frames = FramesSchema.parse(rawFrames);
export const extractedUiIcons: UiIcons = UiIconsSchema.parse(rawCategoryIcons);
export const extractedBrand: Brand = BrandSchema.parse(rawBrand);

const entries: readonly Entry[] = z.array(EntrySchema).parse(rawEntries);

/** Categories with an icon source must have an icon to be published, unless their icons are optional (effects). */
export const hasRequiredIcon = (entry: Entry): boolean => {
  const source = ICON_SOURCES[entry.category];
  return source === undefined || source.optional === true || entry.icon !== undefined;
};

/** Entries whose texts show values: hidden until the game data can fill all of them. */
const VALUE_CATEGORIES: ReadonlySet<Category> = new Set(["effect", "enchantment", "enchantment-book", "talisman"]);
/** An enchantment's page also prints its books' texts, so a book with unknown values hides its enchantment too. */
const booksKnown = (entry: Entry): boolean =>
  entry.category !== "enchantment" ||
  entries.every((book) => book.category !== "enchantment-book" || book.links.enchantment !== entry.slug || book.release !== "base" || isFullyDescribed(book));
const hasKnownValues = (entry: Entry): boolean => !VALUE_CATEGORIES.has(entry.category) || (isFullyDescribed(entry) && booksKnown(entry));

/** Unique enchantments come fixed on unique gear and cannot be rerolled, so their books are not obtainable. */
const isObtainable = (entry: Entry): boolean => !(entry.category === "enchantment-book" && entry.variant === "unique");

export const publishedEntries: readonly Entry[] = entries.filter(
  (entry) => entry.release === "base" && hasRequiredIcon(entry) && isObtainable(entry) && hasKnownValues(entry),
);

/** Any released entry, published or not: for text and art shown inside another entry's page. */
export const findBaseEntry = (category: Category, slug: string): Entry | undefined =>
  entries.find((entry) => entry.release === "base" && entry.category === category && entry.slug === slug);

export const allArmorSets: readonly ArmorSet[] = z.array(ArmorSetSchema).parse(rawSets);

export const entriesIn = (category: Category): Entry[] =>
  publishedEntries.filter((entry) => entry.category === category);

/** Unique enchantments only come on their weapon (its page shows them): the enchantment list leaves them out, their pages stay. */
const isListed = (entry: Entry): boolean => !(entry.category === "enchantment" && entry.variant === "unique");

/** What a category page lists. */
export const listedIn = (category: Category): Entry[] => entriesIn(category).filter(isListed);

export const findEntry = (category: Category, slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

export const booksFor = (enchantmentSlug: string): Entry[] =>
  publishedEntries.filter(
    (entry) => entry.category === "enchantment-book" && entry.links.enchantment === enchantmentSlug,
  );

export const findArmorSet = (slug: string): ArmorSet | undefined => allArmorSets.find((set) => set.slug === slug);

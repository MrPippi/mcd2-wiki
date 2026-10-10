import { z } from "zod";
import { ICON_SOURCES, type Category } from "../../scripts/extract/config";
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
} from "../../scripts/extract/schemas";
import rawSets from "../data/armor-sets.json";
import rawBrand from "../data/brand.json";
import rawCategoryIcons from "../data/category-icons.json";
import rawEntries from "../data/entries.json";
import rawFrames from "../data/frames.json";

export const extractedFrames: Frames = FramesSchema.parse(rawFrames);
export const extractedUiIcons: UiIcons = UiIconsSchema.parse(rawCategoryIcons);
export const extractedBrand: Brand = BrandSchema.parse(rawBrand);

const entries: readonly Entry[] = z.array(EntrySchema).parse(rawEntries);

/** Categories with an icon source must have an icon to be published, unless their icons are optional (effects). */
const hasRequiredIcon = (entry: Entry): boolean => {
  const source = ICON_SOURCES[entry.category];
  return source === undefined || source.optional === true || entry.icon !== undefined;
};

export const publishedEntries: readonly Entry[] = entries.filter(
  (entry) => entry.release === "base" && hasRequiredIcon(entry),
);

export const allArmorSets: readonly ArmorSet[] = z.array(ArmorSetSchema).parse(rawSets);

export const entriesIn = (category: Category): Entry[] =>
  publishedEntries.filter((entry) => entry.category === category);

export const findEntry = (category: Category, slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

export const booksFor = (enchantmentSlug: string): Entry[] =>
  publishedEntries.filter(
    (entry) => entry.category === "enchantment-book" && entry.links.enchantment === enchantmentSlug,
  );

export const findArmorSet = (slug: string): ArmorSet | undefined => allArmorSets.find((set) => set.slug === slug);

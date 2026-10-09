import { z } from "zod";
import type { Category } from "../../scripts/extract/config";
import { ArmorSetSchema, EntrySchema, type ArmorSet, type Entry } from "../../scripts/extract/schemas";
import rawSets from "../data/armor-sets.json";
import rawEntries from "../data/entries.json";

const entries: readonly Entry[] = z.array(EntrySchema).parse(rawEntries);

export const publishedEntries: readonly Entry[] = entries.filter((entry) => entry.release === "base");

export const allArmorSets: readonly ArmorSet[] = z.array(ArmorSetSchema).parse(rawSets);

export const entriesIn = (category: Category): Entry[] =>
  publishedEntries.filter((entry) => entry.category === category);

export const findEntry = (category: Category, slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

export const findArmorSet = (slug: string): ArmorSet | undefined => allArmorSets.find((set) => set.slug === slug);

import { z } from "zod";
import { CATEGORIES, LANGS } from "./config";

export const LocaleFileSchema = z.record(z.string(), z.record(z.string(), z.string()));
export type LocaleFile = z.infer<typeof LocaleFileSchema>;

export const LocalizedSchema = z.object({ zh: z.string(), en: z.string() });
export type Localized = z.infer<typeof LocalizedSchema>;

export const ARMOR_PIECES = ["helmet", "chest", "leggings", "boots"] as const;
export type ArmorPiece = (typeof ARMOR_PIECES)[number];

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const VariantSchema = z.enum(["normal", "unique"]);

export const EntrySchema = z.object({
  id: z.string().min(1),
  slug: SlugSchema,
  category: z.enum(CATEGORIES),
  variant: VariantSchema,
  release: z.enum(["base", "upcoming"]),
  name: LocalizedSchema,
  description: LocalizedSchema.optional(),
  descriptionLong: LocalizedSchema.optional(),
  icon: z.string().optional(),
  armorPiece: z.enum(ARMOR_PIECES).optional(),
  untranslated: z.array(z.enum(LANGS)).optional(),
  links: z.object({
    variants: z.array(SlugSchema).optional(),
    enchantmentBook: SlugSchema.optional(),
    enchantment: SlugSchema.optional(),
    armorSet: SlugSchema.optional(),
  }),
});
export type Entry = z.infer<typeof EntrySchema>;

export const ArmorSetSchema = z.object({
  id: z.string().min(1),
  slug: SlugSchema,
  variant: VariantSchema,
  name: LocalizedSchema,
  pieces: z.object({
    helmet: SlugSchema.optional(),
    chest: SlugSchema.optional(),
    leggings: SlugSchema.optional(),
    boots: SlugSchema.optional(),
  }),
});
export type ArmorSet = z.infer<typeof ArmorSetSchema>;

export const FramesSchema = z.object({
  enchantment: z.string().optional(),
  artifact: z.string().optional(),
});
export type Frames = z.infer<typeof FramesSchema>;

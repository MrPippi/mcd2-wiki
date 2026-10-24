/** Output shape of src/data/game-changes.json: what changed in the site's game data between two game versions. */
import { z } from "zod";
import { LocalizedSchema } from "./schemas";

/** The data compared, in page order. */
export const DIFF_SOURCES = ["items", "weapons", "enchantments", "artifacts", "talismans", "mobs", "soulEnchantments"] as const;
export type DiffSource = (typeof DIFF_SOURCES)[number];

export const DiffFieldSchema = z.object({
  /** Where the value sits in the record, e.g. "melee.swings[0].damage" or "compatible[effect=looting].tiers". */
  path: z.string().min(1),
  /** The value as text; missing when the field was added (before) or removed (after). */
  before: z.string().optional(),
  after: z.string().optional(),
});
export type DiffField = z.infer<typeof DiffFieldSchema>;

export const DiffEntitySchema = z.object({
  slug: z.string().min(1),
  name: LocalizedSchema,
  /** Path under the language of the entity's page, when it has one. */
  link: z.string().optional(),
  status: z.enum(["added", "removed", "changed"]),
  /** The changed fields; empty for an added or removed entity. */
  fields: z.array(DiffFieldSchema),
});
export type DiffEntity = z.infer<typeof DiffEntitySchema>;

export const VersionChangesSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  groups: z.array(z.object({ source: z.enum(DIFF_SOURCES), entities: z.array(DiffEntitySchema).min(1) })),
});
export type VersionChanges = z.infer<typeof VersionChangesSchema>;

/** Newest comparison first, one per target version. */
export const GameChangesSchema = z.array(VersionChangesSchema);
export type GameChanges = z.infer<typeof GameChangesSchema>;

/** Shape of src/data/map.json: one entry per world with its frame, top zoom and markers (spec §4.2). */
import { z } from "zod";
import { MARKER_KINDS, type MarkerKind } from "./map/kinds";
import { WORLD_KEYS } from "./map/worlds";
import { CATEGORIES } from "./config";
import { LocalizedSchema } from "./schemas";

export { MARKER_KINDS, type MarkerKind };

/** A quest a marker leads to: its page slug and title. */
export const MarkerQuestSchema = z.object({
  slug: z.string().min(1),
  title: LocalizedSchema,
});
export type MarkerQuest = z.infer<typeof MarkerQuestSchema>;

/** A wiki entry a marker leads to (a talisman chest links to its talisman). */
export const MarkerEntrySchema = z.object({
  category: z.enum(CATEGORIES),
  slug: z.string().min(1),
});
export type MarkerEntry = z.infer<typeof MarkerEntrySchema>;

export const MarkerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(MARKER_KINDS),
  /** Pixel on the full-size render. */
  px: z.number(),
  py: z.number(),
  name: LocalizedSchema,
  area: LocalizedSchema.optional(),
  note: LocalizedSchema.optional(),
  /** Published path under public/. */
  icon: z.string().optional(),
  /** Quest markers: the quests found here, linked from the popup. */
  quests: z.array(MarkerQuestSchema).min(1).optional(),
  /** Talisman chests: the talisman inside, linked from the popup. */
  entry: MarkerEntrySchema.optional(),
});
export type MapMarker = z.infer<typeof MarkerSchema>;

export const WorldFrameSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minY: z.number(),
  maxY: z.number(),
  span: z.number().positive(),
  ratio: z.number().positive(),
  imageSize: z.number().int().positive(),
});

export const WorldMapSchema = z.object({
  key: z.enum(WORLD_KEYS),
  name: LocalizedSchema,
  frame: WorldFrameSchema,
  zMax: z.number().int().min(0),
  markers: z.array(MarkerSchema),
});
export type WorldMap = z.infer<typeof WorldMapSchema>;

export const MapDataSchema = z.object({
  worlds: z.array(WorldMapSchema),
  /** Published icon path per marker kind, for the filter swatches. */
  legend: z.partialRecord(z.enum(MARKER_KINDS), z.string()),
});
export type MapData = z.infer<typeof MapDataSchema>;

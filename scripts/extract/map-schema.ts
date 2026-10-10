/** Shape of src/data/map.json: one entry per world with its frame, top zoom and markers (spec §4.2). */
import { z } from "zod";
import { MARKER_KINDS, type MarkerKind } from "../../src/lib/map/kinds";
import { WORLD_KEYS } from "../../src/lib/map/worlds";
import { LocalizedSchema } from "./schemas";

export { MARKER_KINDS, type MarkerKind };

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

export const MapDataSchema = z.object({ worlds: z.array(WorldMapSchema) });
export type MapData = z.infer<typeof MapDataSchema>;

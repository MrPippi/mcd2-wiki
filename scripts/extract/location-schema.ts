/**
 * Location shapes: the hand-kept region list (location-regions.json) that decides which DT_AreaDefinition rows are
 * region pages, which fold into a region as sub-locations and which are left out, and the output src/data/locations.json.
 */
import { z } from "zod";
import { LANGS } from "./config";
import { MobAreaSchema } from "./mob-schema";
import { LocalizedSchema } from "./schemas";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RegionRuleSchema = z.object({
  slug: z.string().regex(SLUG),
  /** The rows that are the region itself: its name, icon, level and map marker come from these, the first one first. */
  areas: z.array(z.string()).min(1),
  /** Further tags the region owns (with every tag below them); `areas` are owned the same way. */
  members: z.array(z.string()).optional(),
});
export type RegionRule = z.infer<typeof RegionRuleSchema>;

export const RegionListSchema = z.object({
  /** In page order. */
  regions: z.array(RegionRuleSchema).min(1),
  /** Tag → why it is left out. A key ending in ".*" also covers every tag below it. */
  excluded: z.record(z.string(), z.string().min(1)),
});
export type RegionList = z.infer<typeof RegionListSchema>;

const LangsSchema = z.array(z.enum(LANGS));

export const SubLocationSchema = z.object({
  name: LocalizedSchema,
  untranslated: LangsSchema,
  /** The game's area tags that carry this name, in table order; procedural repeats share one name. */
  areaIds: z.array(z.string()).min(1),
});
export type SubLocation = z.infer<typeof SubLocationSchema>;

export const LocationSchema = z.object({
  slug: z.string().regex(SLUG),
  /** The region's first own row; with `name` and `map` this is a MobArea, so the map link helper takes it. */
  areaId: z.string(),
  name: LocalizedSchema,
  untranslated: LangsSchema,
  map: MobAreaSchema.shape.map,
  /** Published path of the game's area icon, when it has one. */
  icon: z.string().optional(),
  /** The player levels the game's progression table sets for the region's own rows, ascending; empty when none. */
  levels: z.array(z.number().int().positive()),
  subLocations: z.array(SubLocationSchema),
  /** Bestiary slugs of the mobs mobs.json places in the region. */
  mobs: z.array(z.string()),
  /** Quest slugs whose region lies in this one, in quest list order. */
  quests: z.array(z.string()),
  /** loot-sources.json area source ids ("area:<tag>") of the region's drop pools. */
  lootSources: z.array(z.string()),
});
export type Location = z.infer<typeof LocationSchema>;

export const LocationDataSchema = z.object({
  /** In the region list's order. */
  locations: z.array(LocationSchema),
  /** Every area id mobs.json, quests.json and loot-sources.json use → the slug of the location it belongs to. */
  areas: z.record(z.string(), z.string().regex(SLUG)),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

export const EMPTY_LOCATIONS: LocationData = { locations: [], areas: {} };

import { z } from "zod";
import { SlugSchema } from "../extract/schemas";

const TierValuesSchema = z.tuple([z.string(), z.string(), z.string()]);

/** Weapon effect data taken from the Minecraft Wiki (CC BY-NC-SA 3.0), keyed by weapon entry slug. */
export const WeaponEffectsSchema = z.object({
  source: z.object({
    site: z.string(),
    url: z.url(),
    license: z.string(),
    licenseUrl: z.url(),
  }),
  weapons: z.record(
    SlugSchema,
    z.object({
      /** Wiki page title, e.g. "Dungeons II:Axe". */
      page: z.string(),
      /** Wiki revision the data was read from. */
      revision: z.number().int(),
      /** Effects the weapon can roll, with their tier I, II and III values. */
      compatible: z.array(z.object({ effect: SlugSchema, values: TierValuesSchema })),
      /** A unique weapon's fixed, non-rerollable effect or enchantment. */
      fixed: z
        .object({ kind: z.enum(["effect", "enchantment"]), slug: SlugSchema, value: z.string().optional() })
        .optional(),
    }),
  ),
});

export type WeaponEffects = z.infer<typeof WeaponEffectsSchema>;
export type WeaponEffectData = WeaponEffects["weapons"][string];

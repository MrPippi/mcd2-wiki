/** Output shapes of the bestiary (src/data/mobs.json) and item sources (src/data/loot-sources.json). */
import { z } from "zod";
import { LANGS } from "./config";
import { LocalizedSchema } from "./schemas";

/** Stats shown on a mob page, in display order. resistBase and resistTnt come from controller ruling R19. */
export const STAT_KEYS = [
  "health", "movementSpeed", "poise", "poiseDelay", "poiseRecovery", "sightRadius", "mass", "soulYield",
  "meleeAttackSpeed", "rangedAttackSpeed", "shield", "knockbackResistance",
  "resistBlast", "resistMelee", "resistRanged", "resistFire", "resistIce", "resistLightning", "resistPoison", "resistSoul", "resistElemental",
  "resistBase", "resistTnt",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** The attribute tags each stat is read from; the first one a mob has wins. */
export const STAT_ATTRIBUTES: Readonly<Record<StatKey, readonly string[]>> = {
  health: ["SW.Attribute.Health"],
  movementSpeed: ["SW.Attribute.MovementSpeed"],
  poise: ["SW.Attribute.Poise"],
  poiseDelay: ["SW.Attribute.PoiseDelay"],
  poiseRecovery: ["SW.Attribute.PoiseRecovery"],
  sightRadius: ["SW.Attribute.AI.SightPerceptionRadius"],
  mass: ["SW.Attribute.Mass"],
  soulYield: ["SW.Attribute.SoulYield"],
  meleeAttackSpeed: ["SW.Attribute.MeleeAttackSpeed"],
  rangedAttackSpeed: ["SW.Attribute.RangedAttackSpeed"],
  shield: ["SW.Attribute.Shield"],
  knockbackResistance: ["SW.Attribute.Resistance.KnockbackResistanceMultiplier"],
  resistBlast: ["SW.Attribute.BlastDamageResistanceMultiplier"],
  resistMelee: ["SW.Attribute.MeleeDamageResistanceMultiplier"],
  resistRanged: ["SW.Attribute.RangedDamageResistanceMultiplier", "SW.Attribute.Resistance.RangedDamageResistanceMultiplier"],
  resistFire: ["SW.Attribute.FireDamageResistanceMultiplier"],
  resistIce: ["SW.Attribute.IceDamageResistanceMultiplier"],
  resistLightning: ["SW.Attribute.LightningDamageResistanceMultiplier"],
  resistPoison: ["SW.Attribute.PoisonDamageResistanceMultiplier"],
  resistSoul: ["SW.Attribute.SoulDamageResistanceMultiplier"],
  resistElemental: ["SW.Attribute.ElementalDamageResistanceMultiplier"],
  resistBase: ["SW.Attribute.Resistance.BaseDamageResistanceMultiplier"],
  resistTnt: ["SW.Attribute.Resistance.TNTDamageResistanceMultiplier"],
};

export const LOOT_SLOT_KEYS = ["item", "specialGear", "enchantedBook", "talismans", "emeralds", "springStone", "consumable", "tnt"] as const;
export type LootSlotKey = (typeof LOOT_SLOT_KEYS)[number];

export const StatSchema = z.object({ key: z.enum(STAT_KEYS), value: z.number() });

export const MobDropSchema = z.object({
  slot: z.enum(LOOT_SLOT_KEYS),
  guaranteed: z.number(),
  rolls: z.number(),
  chancePerRoll: z.number(),
  pool: z.enum(["area", "own", "none"]),
});
export type MobDrop = z.infer<typeof MobDropSchema>;

export const MobAreaSchema = z.object({
  areaId: z.string(),
  name: LocalizedSchema,
  map: z.object({ world: z.enum(["overworld", "sift", "camp"]), px: z.number(), py: z.number() }).optional(),
});
export type MobArea = z.infer<typeof MobAreaSchema>;

export const MobSchema = z.object({
  slug: z.string(),
  id: z.string(),
  kind: z.enum(["regular", "miniboss", "boss", "variant"]),
  world: z.enum(["overworld", "wellspring"]).nullable(),
  name: LocalizedSchema,
  untranslated: z.array(z.enum(LANGS)),
  portrait: z.string().optional(),
  stats: z.array(StatSchema),
  soulCorrupted: z.object({ stats: z.array(StatSchema), drops: z.array(MobDropSchema) }).optional(),
  variants: z.array(z.string()),
  variantOf: z.string().optional(),
  areas: z.array(MobAreaSchema),
  drops: z.array(MobDropSchema),
});
export type Mob = z.infer<typeof MobSchema>;

export const MobDataSchema = z.object({ mobs: z.array(MobSchema) });
export type MobData = z.infer<typeof MobDataSchema>;

export const ItemSourceSchema = z.object({
  areas: z.array(z.object({ areaId: z.string(), name: LocalizedSchema })),
  chests: z.array(z.object({ id: z.string(), name: LocalizedSchema, pool: z.enum(["area", "fixed"]) })),
  quests: z.array(
    z.object({
      id: z.string(),
      name: LocalizedSchema,
      guaranteed: z.literal(true),
      picks: z.object({ count: z.number(), of: z.number() }).optional(),
    }),
  ),
  merchants: z.array(z.object({ id: z.string(), name: LocalizedSchema, byCategory: z.literal(true) })),
  bookPools: z.array(z.object({ id: z.string(), name: LocalizedSchema })),
  untranslated: z.array(z.enum(LANGS)).optional(),
});
export type ItemSources = z.infer<typeof ItemSourceSchema>;

/** Keyed by `${category}/${slug}`. */
export const ItemSourcesSchema = z.record(z.string(), ItemSourceSchema);
export type ItemSourcesData = z.infer<typeof ItemSourcesSchema>;

import { buildArmorEffects } from "../armor-effects";
import { buildArtifactData } from "../artifacts";
import { buildEffectData } from "../effects";
import { buildEnchantmentData } from "../enchantments";
import { DATATABLES_DIR, loadGameTables } from "../game-tables";
import { ArmorEffectDataSchema, ArtifactDataSchema, EnchantmentDataSchema } from "../gear-schema";
import { issue } from "../issues";
import { defineStep } from "../step";
import { WeaponDataSchema, type WeaponData } from "../weapon-schema";
import { buildWeaponData } from "../weapons";
import { entriesStep } from "./entries";

/** The gear DataTables; undefined when source-data has none, and the gear steps below then write empty files. */
export const gameTablesStep = defineStep({
  name: "game-tables",
  needs: {},
  writes: [],
  async run({ options }) {
    return { value: await loadGameTables(options.sourceRoot) };
  },
});

const needs = { entries: entriesStep, tables: gameTablesStep };

export const weaponsStep = defineStep({
  name: "weapons",
  needs,
  writes: ["weapons.json"],
  run(_context, { entries, tables }) {
    const weapons = tables
      ? buildWeaponData(entries.output.entries, tables)
      : { data: { weapons: {}, effectFormats: {} } satisfies WeaponData, issues: [issue("missing-datatables", DATATABLES_DIR)] };
    return { value: undefined, issues: weapons.issues, files: { "weapons.json": WeaponDataSchema.parse(weapons.data) } };
  },
});

export const artifactsStep = defineStep({
  name: "artifacts",
  needs,
  writes: ["artifacts.json"],
  run(_context, { entries, tables }) {
    const artifacts = tables ? buildArtifactData(entries.output.entries, tables) : { data: {}, issues: [] };
    return { value: undefined, issues: artifacts.issues, files: { "artifacts.json": ArtifactDataSchema.parse(artifacts.data) } };
  },
});

export const armorEffectsStep = defineStep({
  name: "armor-effects",
  needs,
  writes: ["armor-effects.json"],
  run(_context, { entries, tables }) {
    const armorEffects = tables ? buildArmorEffects(entries.output.entries, tables) : { data: {}, issues: [] };
    return { value: undefined, issues: armorEffects.issues, files: { "armor-effects.json": ArmorEffectDataSchema.parse(armorEffects.data) } };
  },
});

export const enchantmentsStep = defineStep({
  name: "enchantments",
  needs,
  writes: ["enchantments.json"],
  run(_context, { entries, tables }) {
    const enchantments = tables ? buildEnchantmentData(entries.output.entries, tables) : { data: {}, issues: [] };
    return { value: undefined, issues: enchantments.issues, files: { "enchantments.json": EnchantmentDataSchema.parse(enchantments.data) } };
  },
});

export const effectsStep = defineStep({
  name: "effects",
  needs,
  writes: ["effects.json"],
  run(_context, { entries, tables }) {
    const effectValues = tables ? buildEffectData(entries.output.entries, tables) : {};
    return { value: undefined, files: { "effects.json": EnchantmentDataSchema.parse(effectValues) } };
  },
});

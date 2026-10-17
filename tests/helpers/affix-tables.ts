/** Hand-made drop table and group rows with weights, on top of the weapon test tables, for the affix pool tests. */
import type { GameTables } from "../../scripts/extract/game-tables";
import { TABLES } from "./datatables";

type Op = "Set" | "Add" | "Multiply";
const tag = (name: string, Weight = 1, Operation: Op = "Set") => ({ TypeTag: { TagName: name }, Weight, Operation });
const template = (effect: string, ...tiers: ("I" | "II" | "III")[]) => (weight: number, operation: Op = "Set") =>
  (tiers.length > 0 ? tiers : (["I", "II", "III"] as const)).map((tier) => tag(`SW.EffectTemplate.${effect}.${tier}`, weight, operation));

const ETG = (name: string) => `SW.EffectTemplateGroup.${name}`;
const dropRow = (itemTag: string, ...groups: ReturnType<typeof tag>[]) => ({ TypeTag: { TagName: itemTag }, PrimaryETG: { Tags: groups }, SecondaryETG: {} });

/**
 * Pools: every gear piece gets the Utility group at 0.25 (Looting), melee and ranged weapons the Weapon group, artifacts
 * the Artifact group, the Ranger archetype its own group (Power), and fire items a group that halves Sharpness.
 */
export const AFFIX_TABLES: GameTables = {
  ...TABLES,
  dropTable: [
    dropRow("SW.Item.Property.Gear", tag(ETG("Archetype.Utility"), 0.25)),
    dropRow("SW.Item.Property.MeleeWeapon", tag(ETG("Weapon"))),
    dropRow("SW.Item.Property.RangedWeapon", tag(ETG("Weapon"))),
    dropRow("SW.Item.Property.Artifact", tag(ETG("Artifact"))),
    dropRow("SW.Archetype.Ranger", tag(ETG("Archetype.Ranger"))),
    dropRow("SW.Archetype.Utility", tag(ETG("Archetype.Utility"))),
    dropRow("SW.Item.Property.Elemental.Fire", tag(ETG("Elemental.Fire"))),
  ],
  groups: [
    { TypeTag: { TagName: ETG("Weapon") }, TagList: { Tags: [...template("Sharpness")(1), ...template("Power")(1), ...template("CriticalEdge")(0.75)] } },
    { TypeTag: { TagName: ETG("Artifact") }, TagList: { Tags: template("Cooldown")(1) } },
    { TypeTag: { TagName: ETG("Archetype.Ranger") }, TagList: { Tags: template("Power")(1) } },
    { TypeTag: { TagName: ETG("Archetype.Utility") }, TagList: { Tags: template("Looting")(1) } },
    { TypeTag: { TagName: ETG("Elemental.Fire") }, TagList: { Tags: [...template("Sharpness")(0.5, "Multiply"), ...template("Sharpness")(0.5, "Multiply")] } },
  ],
};

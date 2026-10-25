/** Server side: which effects a piece of gear can roll and what it always carries, from the extracted data. */
import type { ArmorEffectData, ArtifactData } from "../../../shared/gear-schema";
import type { Entry } from "../../../shared/schemas";
import type { WeaponData } from "../../../shared/weapon-schema";
import { armorEffectData, artifactData } from "../gear-values";
import { weaponData } from "../weapon-effects";

export interface GearSources {
  readonly weapons: WeaponData["weapons"];
  readonly artifacts: ArtifactData;
  readonly armor: ArmorEffectData;
}

export const GEAR: GearSources = { weapons: weaponData.weapons, artifacts: artifactData, armor: armorEffectData };

/** The effects an item can roll with their raw tier I/II/III magnitudes; empty for items that roll none (talismans) or have no data. */
export function compatibleRowsOf(entry: Entry, gear: GearSources = GEAR): { effect: string; tiers: number[] }[] {
  const rows =
    entry.category === "melee" || entry.category === "ranged"
      ? gear.weapons[entry.slug]?.compatible
      : entry.category === "artifact"
        ? gear.artifacts[entry.slug]?.compatible
        : entry.category === "armor"
          ? gear.armor[entry.slug]?.compatible
          : undefined;
  return (rows ?? []).map((row) => ({ effect: row.effect, tiers: [...row.tiers] }));
}

/** The effect or enchantment a unique item always carries, as a category and slug, with an effect's raw magnitude when known. */
export function fixedOf(entry: Entry, gear: GearSources = GEAR): { kind: "effect" | "enchantment" | "enchantment-book"; slug: string; value?: number } | undefined {
  if (entry.category === "melee" || entry.category === "ranged") {
    const fixed = gear.weapons[entry.slug]?.fixed;
    return fixed ? { kind: fixed.kind, slug: fixed.slug, ...(fixed.kind === "effect" && fixed.value !== undefined ? { value: fixed.value } : {}) } : undefined;
  }
  const armor = entry.category === "armor" ? gear.armor[entry.slug]?.fixed : undefined;
  return armor ? { kind: "effect", slug: armor.effect, value: armor.value } : undefined;
}

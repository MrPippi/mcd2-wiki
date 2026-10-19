/** Artifact numbers and rollable effects from DT_ItemDefinitionArtifact. */
import { blocks, compatibleEffects, effectEntries, entryIndex, GEAR_TAG, locId, tagNames } from "./game-rows";
import type { GameTables } from "./game-tables";
import { issue, type Issue } from "./issues";
import type { Entry } from "../../shared/schemas";
import type { ArtifactData } from "../../shared/gear-schema";

const KEY = {
  cooldownSeconds: "SW.KeyValue.CooldownDuration",
  soulCost: "SW.KeyValue.SoulArtifact.ActivationCost",
  lifetimeSeconds: "SW.KeyValue.Lifetime",
  range: "SW.KeyValue.EffectiveRange",
} as const;

export function buildArtifactData(entries: readonly Entry[], tables: GameTables): { data: ArtifactData; issues: Issue[] } {
  const find = entryIndex(entries);
  const effects = effectEntries(tables, find);
  const built = tables.artifacts.flatMap((item) => {
    const artifact = find("artifact", locId(item.TypeTextData));
    if (!artifact) return [];
    const number = (key: string) => {
      const found = item.KeyValues?.find((keyValue) => keyValue.TypeTag.TagName === key);
      return found?.Float ?? found?.Int;
    };
    const numbers = Object.fromEntries(
      Object.entries(KEY).flatMap(([field, key]) => {
        const value = number(key);
        return value === undefined ? [] : [[field, field === "range" ? blocks(value) : value]];
      }),
    );
    const { compatible, unmatched } = compatibleEffects(new Set([...tagNames(item.Traits), GEAR_TAG]), tables, effects);
    return [{ slug: artifact.slug, data: { ...numbers, compatible }, issues: unmatched.map((tag) => issue("weapon-unmatched", `${artifact.id}: ${tag}`)) }];
  });
  return {
    data: Object.fromEntries(built.map(({ slug, data }) => [slug, data])),
    issues: built.flatMap((artifact) => artifact.issues),
  };
}

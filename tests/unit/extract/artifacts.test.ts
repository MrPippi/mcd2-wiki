import { describe, expect, it } from "vitest";
import { buildArtifactData } from "../../../scripts/extract/artifacts";
import type { Entry } from "../../../scripts/extract/schemas";
import { TABLES } from "../../helpers/datatables";
import { loc } from "../../helpers/localized";

const entry = (category: Entry["category"], slug: string, id: string): Entry => ({
  id,
  slug,
  category,
  variant: "normal",
  release: "base",
  name: loc({ zh: id, en: id }),
  links: {},
});

const ENTRIES: readonly Entry[] = [
  entry("artifact", "totem-of-shielding", "Artifact_TotemOfShielding"),
  entry("artifact", "firework-quiver", "Artifact_FireworkQuiver"),
  entry("effect", "cooldown", "Cooldown"),
  entry("effect", "looting", "Looting"),
];

describe("buildArtifactData", () => {
  const { data } = buildArtifactData(ENTRIES, TABLES);

  it("reads cooldown, soul cost, lifetime and range (in blocks) from the item's key values", () => {
    expect(data["totem-of-shielding"]).toMatchObject({ cooldownSeconds: 24, soulCost: 40, lifetimeSeconds: 10, range: 12 });
  });

  it("reads Int key values and leaves out numbers the artifact does not have", () => {
    expect(data["firework-quiver"]).toMatchObject({ cooldownSeconds: 15, soulCost: 20 });
    expect(data["firework-quiver"]?.lifetimeSeconds).toBeUndefined();
  });

  it("rolls artifact effects for artifacts, and only gear-wide ones for items without the artifact tag", () => {
    expect(data["totem-of-shielding"]?.compatible.map((row) => row.effect)).toEqual(["cooldown", "looting"]);
    expect(data["firework-quiver"]?.compatible.map((row) => row.effect)).toEqual(["looting"]);
  });
});

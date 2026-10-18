import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NO_DROPS } from "../../../scripts/extract/drop-models";
import { extractDrops } from "../../../scripts/extract/drops";

describe("extractDrops", () => {
  it("leaves the drop odds out and says which tables are missing when source-data has none", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-nodrops-"));
    const result = await extractDrops({
      sourceRoot: root,
      entries: [],
      threat: [],
      sources: { sources: {}, items: {}, bookDrops: [] },
      quests: { quests: [], rewardSources: {} },
      mobs: { mobs: [] },
      tagIndex: new Map(),
    });
    expect(result.data).toEqual(NO_DROPS);
    expect(result.issues.map((one) => one.type)).toContain("missing-drop-tables");
    expect(result.issues.map((one) => one.detail)).toContain("DT_LootSourceDefinition_Area.json");
    expect(result.tablesRead).toEqual([]);
  });
});

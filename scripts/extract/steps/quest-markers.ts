import { existsSync } from "node:fs";
import path from "node:path";
import { addQuestMarkers, loadQuestLocations } from "../map-quests";
import { defineStep } from "../step";
import { mapStep } from "./map";
import { questsStep } from "./quests";

/**
 * The plain map plus the quest pins. map.json is written with them (see spot-markers),
 * while the other extractors read the plain map step.
 */
export const questMarkersStep = defineStep({
  name: "quest-markers",
  needs: { map: mapStep, quests: questsStep },
  writes: [],
  async run({ options }, { map, quests }) {
    const questMap = addQuestMarkers(map.data, quests.quests, await loadQuestLocations(options.sourceRoot), (relative) =>
      existsSync(path.join(options.sourceRoot, ...relative.split("/"))),
    );
    return { value: questMap.data, issues: questMap.issues };
  },
});

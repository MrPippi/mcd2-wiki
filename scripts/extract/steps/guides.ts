import { extractGuides } from "../guides";
import { defineStep, siblingOfOverrides } from "../step";
import { entriesStep } from "./entries";
import { localesStep } from "./locales";

export const guidesStep = defineStep({
  name: "guides",
  needs: { locales: localesStep, entries: entriesStep },
  writes: ["guides.json"],
  async run({ options }, { locales, entries }) {
    const guides = await extractGuides({
      sourceRoot: options.sourceRoot,
      locales,
      entries: entries.output.entries,
      statusPath: options.guidesStatusPath ?? siblingOfOverrides(options, "guides-status.json"),
    });
    return { value: guides.data, issues: guides.issues, files: { "guides.json": guides.data }, tablesRead: guides.tablesRead };
  },
});

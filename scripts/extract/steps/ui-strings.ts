import { defineStep } from "../step";
import uiGameKeys from "../ui-game-keys.json";
import { buildUiGameStrings } from "../ui-game-strings";
import { localesStep } from "./locales";

export const uiStringsStep = defineStep({
  name: "ui-strings",
  needs: { locales: localesStep },
  writes: ["ui-game-strings.json"],
  run(_context, { locales }) {
    const uiStrings = buildUiGameStrings(locales, uiGameKeys);
    return { value: undefined, issues: uiStrings.issues, files: { "ui-game-strings.json": uiStrings.strings } };
  },
});

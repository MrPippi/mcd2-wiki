import type { Lang } from "../config";
import type { LocaleFile } from "../schemas";
import { loadLocales } from "../parse-locale";
import { defineStep } from "../step";

export type Locales = Readonly<Record<Lang, LocaleFile>>;

export const localesStep = defineStep({
  name: "locales",
  needs: {},
  writes: [],
  async run({ options }) {
    return { value: await loadLocales(options.sourceRoot) };
  },
});

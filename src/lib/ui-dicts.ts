import { z } from "zod";
import type { Lang } from "../../scripts/extract/langs";
import { byLang } from "./lang";
import de from "../i18n/de.json";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import fr from "../i18n/fr.json";
import it from "../i18n/it.json";
import ja from "../i18n/ja.json";
import ko from "../i18n/ko.json";
import nl from "../i18n/nl.json";
import pl from "../i18n/pl.json";
import pt from "../i18n/pt.json";
import ru from "../i18n/ru.json";
import sv from "../i18n/sv.json";
import tr from "../i18n/tr.json";
import uk from "../i18n/uk.json";
import zhHans from "../i18n/zh-hans.json";
import zh from "../i18n/zh.json";

/** Plural forms of a unit; `other` is always present, the rest depend on the language. */
export const PluralFormsSchema = z.object({
  one: z.string().optional(),
  few: z.string().optional(),
  many: z.string().optional(),
  other: z.string(),
});
export type PluralForms = z.infer<typeof PluralFormsSchema>;

export const UiValueSchema = z.union([z.string(), PluralFormsSchema]);
export type UiValue = z.infer<typeof UiValueSchema>;

/**
 * A language file: strings (or plural forms) by key, plus optional key lists: `_machine` (machine-translated) and
 * `_english` (a known language problem, so the key shows the English text instead).
 */
export const UiFileSchema = z
  .object({ _machine: z.array(z.string()).optional(), _english: z.array(z.string()).optional() })
  .catchall(UiValueSchema);

export interface UiDict {
  readonly values: Readonly<Record<string, UiValue>>;
  readonly machine: readonly string[];
  readonly english: readonly string[];
}

function parseFile(lang: Lang, raw: unknown): UiDict {
  const parsed = UiFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`src/i18n/${lang}.json: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  const { _machine, _english, ...values } = parsed.data;
  return { values, machine: _machine ?? [], english: _english ?? [] };
}

const RAW_FILES: Readonly<Record<Lang, unknown>> = { zh, "zh-hans": zhHans, en, ja, ko, de, fr, es, it, pt, ru, pl, nl, sv, tr, uk };

/** Every language file, validated once on load. */
export const UI_DICTS: Readonly<Record<Lang, UiDict>> = byLang((lang) => parseFile(lang, RAW_FILES[lang]));

/** The language file's own text for a key, ignoring the game's strings. */
export const fileValue = (lang: Lang, key: string): UiValue | undefined => UI_DICTS[lang].values[key];

/** The text a value shows without a number: the plural form `other`. */
export const plainText = (value: UiValue): string => (typeof value === "string" ? value : value.other);

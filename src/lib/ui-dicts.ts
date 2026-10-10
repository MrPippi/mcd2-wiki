import { z } from "zod";
import type { Lang } from "../../scripts/extract/langs";
import en from "../i18n/en.json";
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

/** A language file: strings (or plural forms) by key, plus an optional list of machine-translated keys. */
export const UiFileSchema = z.object({ _machine: z.array(z.string()).optional() }).catchall(UiValueSchema);

export interface UiDict {
  readonly values: Readonly<Record<string, UiValue>>;
  readonly machine: readonly string[];
}

function parseFile(lang: Lang, raw: unknown): UiDict {
  const parsed = UiFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`src/i18n/${lang}.json: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  const { _machine, ...values } = parsed.data;
  return { values, machine: _machine ?? [] };
}

/** Every language file, validated once on load. */
export const UI_DICTS: Readonly<Record<Lang, UiDict>> = { zh: parseFile("zh", zh), en: parseFile("en", en) };

/** The language file's own text for a key, ignoring the game's strings. */
export const fileValue = (lang: Lang, key: string): UiValue | undefined => UI_DICTS[lang].values[key];

/** The text a value shows without a number: the plural form `other`. */
export const plainText = (value: UiValue): string => (typeof value === "string" ? value : value.other);

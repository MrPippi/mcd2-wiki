import type { Lang } from "../../scripts/extract/config";
import type { LocaleFile } from "../../scripts/extract/schemas";

export const ns = (table: string): string => `Text/Release/${table}.csv`;

type Rows = Record<string, Record<string, readonly [en: string, zh: string]>>;

export function makeLocales(rows: Rows): Record<Lang, LocaleFile> {
  const pick = (index: 0 | 1): LocaleFile =>
    Object.fromEntries(
      Object.entries(rows).map(([namespace, keys]) => [
        namespace,
        Object.fromEntries(Object.entries(keys).map(([key, pair]) => [key, pair[index]])),
      ]),
    );
  return { en: pick(0), zh: pick(1) };
}

import { LANGS } from "../../shared/langs";
import type { Lang } from "../../shared/config";
import type { LocaleFile } from "../../shared/schemas";

const LOCTABLE = /^LOCTABLE\("([^"]+)",\s*"([^"]+)"\)$/;

export interface LocRef {
  readonly namespace: string;
  readonly key: string;
}

/** `LOCTABLE("VendorLabels.csv", "key")` → the locale file namespace and key it points at. */
export function locRef(text: string): LocRef | undefined {
  const match = LOCTABLE.exec(text.trim());
  return match ? { namespace: `Text/Release/${match[1]}`, key: match[2] } : undefined;
}

/** The game's own text in each language that has it (non-empty); undefined when there is no English. */
export function gameTexts(locales: Readonly<Record<Lang, LocaleFile>>, namespace: string, key: string): Partial<Record<Lang, string>> | undefined {
  if (!locales.en[namespace]?.[key]) return undefined;
  return Object.fromEntries(LANGS.flatMap((lang) => {
    const text = locales[lang][namespace]?.[key];
    return text ? [[lang, text]] : [];
  }));
}

import { localizedFrom } from "../../src/lib/lang";
import { LANGS } from "./langs";
import type { Lang } from "./config";
import type { LocaleFile, Localized } from "./schemas";

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

/** Languages that have no text of their own for an English key (and so show English). */
export function englishFallbacks(locales: Readonly<Record<Lang, LocaleFile>>, namespace: string, key: string): Lang[] {
  const texts = gameTexts(locales, namespace, key);
  return texts ? LANGS.filter((lang) => !texts[lang]) : [];
}

/** Text in every language; a missing language falls back to English, and no English means no text. */
export function localize(locales: Readonly<Record<Lang, LocaleFile>>, namespace: string, key: string): Localized | undefined {
  const texts = gameTexts(locales, namespace, key);
  if (!texts) return undefined;
  const en = texts.en ?? "";
  return localizedFrom((lang) => texts[lang] ?? en);
}

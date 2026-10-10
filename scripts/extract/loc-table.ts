import { localizedFrom } from "../../src/lib/lang";
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

/** Text in every language; a missing language falls back to English, and no English means no text. */
export function localize(locales: Readonly<Record<Lang, LocaleFile>>, namespace: string, key: string): Localized | undefined {
  const en = locales.en[namespace]?.[key];
  if (!en) return undefined;
  return localizedFrom((lang) => locales[lang][namespace]?.[key] || en);
}

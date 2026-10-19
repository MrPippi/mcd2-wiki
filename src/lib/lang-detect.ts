import { ALL_LANGS, LANG_META, type Lang } from "../../shared/langs";

const FALLBACK: Lang = "zh";
const isLang = (code: string): code is Lang => ALL_LANGS.some((lang) => lang === code);

/** The site language a browser language tag stands for, or undefined when the site has none. */
function fromBrowserTag(tag: string): Lang | undefined {
  const lower = tag.toLowerCase();
  const [primary = ""] = lower.split("-");
  if (primary === "zh") {
    return /^zh-(cn|sg|hans)/.test(lower) ? "zh-hans" : "zh";
  }
  if (isLang(lower)) return lower;
  if (isLang(primary)) return primary;
  return ALL_LANGS.find((lang) => LANG_META[lang].htmlLang.toLowerCase() === lower);
}

/** Picks the site language: a stored choice wins, then the first supported browser language, then Traditional Chinese. */
export function detectLang(stored: string | null, browser: readonly string[]): Lang {
  if (stored !== null && isLang(stored)) return stored;
  for (const tag of browser) {
    const found = fromBrowserTag(tag);
    if (found) return found;
  }
  return FALLBACK;
}

/** Checks what a visitor sends: the build link, its title and language. Pure, so the tests and the site can share it. */

/** The build page's query parameters (src/lib/build/code.ts): version, game version, item lists, enchantments, effects. */
const ITEM_PARAMS = ["m", "r", "h", "c", "l", "b", "a", "t"] as const;
const PARAM_ORDER = ["v", "gv", ...ITEM_PARAMS, "e", "x"] as const;
const VALUE_PATTERN: Readonly<Record<string, RegExp>> = {
  v: /^1$/,
  gv: /^[0-9A-Za-z._-]{1,32}$/,
  e: /^[a-z0-9,:-]{1,300}$/,
  x: /^[a-z0-9,:~-]{1,600}$/,
};
const ITEM_PATTERN = /^[a-z0-9,-]{1,300}$/;
export const MAX_CODE_LENGTH = 1200;
export const MAX_TITLE_LENGTH = 40;
export const LANGS = ["zh", "zh-hans", "en", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "pl", "nl", "sv", "tr", "uk"] as const;
// Links, markup and control characters have no place in a build's name.
const FORBIDDEN_TITLE = /https?:|www\.|[<>]|[\u0000-\u001f\u007f]|\.(?:com|net|org|io|gg|xyz|tw|cn)\b/i;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A build link's query string in one canonical form (parameters in a fixed order, nothing else), so the same build
 * is stored once. It must name at least one item.
 */
export function normalizeCode(raw: unknown): Checked<string> {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_CODE_LENGTH) return { ok: false, error: "code" };
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const kept: string[] = [];
  for (const key of PARAM_ORDER) {
    const values = params.getAll(key);
    if (values.length > 1) return { ok: false, error: "code" };
    const value = values[0];
    if (value === undefined || value === "") continue;
    const pattern = VALUE_PATTERN[key] ?? ITEM_PATTERN;
    if (!pattern.test(value)) return { ok: false, error: "code" };
    kept.push(`${key}=${value}`);
  }
  if (params.get("v") !== "1") return { ok: false, error: "code" };
  if (!ITEM_PARAMS.some((key) => (params.get(key) ?? "").replace(/,/g, "") !== "")) return { ok: false, error: "empty" };
  return { ok: true, value: kept.join("&") };
}

/** A title: trimmed, inner whitespace collapsed, 1–40 characters, no links or markup. */
export function normalizeTitle(raw: unknown): Checked<string> {
  if (typeof raw !== "string") return { ok: false, error: "title" };
  const title = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  const length = [...title].length;
  if (length === 0 || length > MAX_TITLE_LENGTH || FORBIDDEN_TITLE.test(title)) return { ok: false, error: "title" };
  return { ok: true, value: title };
}

export const isLang = (raw: unknown): raw is (typeof LANGS)[number] => typeof raw === "string" && (LANGS as readonly string[]).includes(raw);

/** The game version in a normalized code, or "" when it has none. */
export const gameVersionOf = (code: string): string => new URLSearchParams(code).get("gv") ?? "";

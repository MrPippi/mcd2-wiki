import { LANGS, LANG_META, type Lang } from "./config";

const MIN_SET_NAME_LENGTH = 2;
const MIN_COMPOUND_PREFIX_LENGTH = 4;
/** A piece tail (the part after the set name) must occur in this many different sets to count as a known one. */
export const MIN_TAIL_SETS = 3;
/** Joiners that end a CJK set-name prefix (之 zh, の ja, 의 ko) and any space after it. */
const TRAILING_CONNECTOR = /[\s之の의]+$/u;
/** A German compound joined with a hyphen (Sifter-Helm) shares the hyphen too. */
const GERMAN_COMPOUND_HYPHEN = /-$/;
const TAIL_PADDING = /^[\s-]+|[\s-]+$/gu;
const KATAKANA = /[゠-ヿ]/u;
/**
 * A last word ending like this is an adjective or a genitive, not a set name, so the set takes the English name.
 * ru: -ые -ый -ий -ой -ая -яя -ое -ее -ие; uk: -ий -ій -а -е -і (as the controller ruled; feminine -а nouns fall back too).
 */
const ADJECTIVE_ENDINGS: Readonly<Partial<Record<Lang, readonly string[]>>> = {
  ru: ["ые", "ый", "ий", "ой", "ая", "яя", "ое", "ее", "ие", "і"],
  uk: ["ий", "ій", "а", "е", "і"],
};

/** For each language, the piece tails that occur in at least MIN_TAIL_SETS different sets. */
export type SetTails = Readonly<Partial<Record<Lang, ReadonlySet<string>>>>;
/** The pieces' names of one set, per language (a language is left out when its names are not the game's own). */
export type NamesByLang = Readonly<Partial<Record<Lang, readonly string[]>>>;

interface Candidate {
  readonly name: string;
  readonly tails: readonly string[];
}

const charCount = (text: string): number => [...text].length;
const normalizeTail = (rest: string): string => rest.replace(TAIL_PADDING, "").toLowerCase();

export function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  return values.reduce((prefix, value) => {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    return prefix.slice(0, i);
  });
}

function atWordBoundary(prefix: string, names: readonly string[]): boolean {
  const endsWord = (name: string): boolean => name.length === prefix.length || /\s/.test(name.charAt(prefix.length));
  return /\s$/.test(prefix) || names.every(endsWord);
}

function trimToWordBoundary(prefix: string, names: readonly string[]): string {
  return atWordBoundary(prefix, names) ? prefix : prefix.slice(0, prefix.lastIndexOf(" ") + 1);
}

/** German glues the piece name onto the set name (Jünger|helm): a long enough prefix that every piece continues with a letter. */
function isGermanCompound(prefix: string, names: readonly string[]): boolean {
  const continuesWithLetter = (name: string): boolean => /^\p{L}/u.test(name.slice(prefix.length));
  return charCount(prefix) >= MIN_COMPOUND_PREFIX_LENGTH && names.every(continuesWithLetter);
}

/** A cut inside a katakana run (ハイ|ブマインド) is not a word end. */
function splitsKatakanaRun(prefix: string, names: readonly string[]): boolean {
  return KATAKANA.test(prefix.slice(-1)) && names.some((name) => KATAKANA.test(name.charAt(prefix.length)));
}

function cutPrefix(lang: Lang, prefix: string, names: readonly string[]): string | undefined {
  switch (LANG_META[lang].fontScript) {
    case "tc":
    case "sc":
    case "jp":
    case "kr":
      return splitsKatakanaRun(prefix, names) ? undefined : prefix.replace(TRAILING_CONNECTOR, "");
    default:
      if (lang === "de" && isGermanCompound(prefix, names)) return prefix.replace(GERMAN_COMPOUND_HYPHEN, "");
      return trimToWordBoundary(prefix, names);
  }
}

function endsLikeAdjective(lang: Lang, name: string): boolean {
  const lastWord = name.split(/\s+/).pop() ?? "";
  return (ADJECTIVE_ENDINGS[lang] ?? []).some((ending) => lastWord.endsWith(ending));
}

/** The shared prefix with its tails, before the known-tail check; undefined when it is no usable set name. */
function candidateFor(lang: Lang, names: readonly string[]): Candidate | undefined {
  if (names.length < 2 || lang === "sv") return undefined;
  const raw = cutPrefix(lang, commonPrefix(names), names);
  if (raw === undefined) return undefined;
  const name = raw.trim();
  const usable = charCount(name) >= MIN_SET_NAME_LENGTH && !names.includes(name) && !endsLikeAdjective(lang, name);
  return usable ? { name, tails: names.map((piece) => normalizeTail(piece.slice(raw.length))) } : undefined;
}

/** The gate applies to Latin and Cyrillic names other than English, which is the source of the fallback itself. */
const needsKnownTails = (lang: Lang): boolean => {
  const script = LANG_META[lang].fontScript;
  return lang !== "en" && (script === "latin" || script === "cyrillic");
};

/**
 * The part of the pieces' names they share, cut where each writing system ends a word.
 * Undefined (English takes over) when nothing usable is left, the last word is an adjective or genitive, the language is
 * Swedish, or `tails` is given and a piece's remainder is not a known tail of that language.
 */
export function setNameFor(lang: Lang, names: readonly string[], tails?: ReadonlySet<string>): string | undefined {
  const candidate = candidateFor(lang, names);
  if (!candidate) return undefined;
  const known = !tails || !needsKnownTails(lang) || candidate.tails.every((tail) => tails.has(tail));
  return known ? candidate.name : undefined;
}

/** First pass over every set: the tails that recur in at least MIN_TAIL_SETS sets, per language. */
export function collectTails(groups: readonly NamesByLang[]): SetTails {
  const counts = new Map<Lang, Map<string, number>>();
  for (const group of groups) {
    for (const lang of LANGS) {
      const names = group[lang];
      const candidate = names && candidateFor(lang, names);
      if (!candidate) continue;
      const seen = counts.get(lang) ?? new Map<string, number>();
      for (const tail of new Set(candidate.tails)) seen.set(tail, (seen.get(tail) ?? 0) + 1);
      counts.set(lang, seen);
    }
  }
  return Object.fromEntries(
    [...counts].map(([lang, seen]) => [lang, new Set([...seen].filter(([, n]) => n >= MIN_TAIL_SETS).map(([tail]) => tail))]),
  );
}

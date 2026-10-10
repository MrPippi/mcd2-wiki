/** Parses the Minecraft Wiki's Dungeons II weapon pages (raw wikitext). */

export interface CompatibleEffect {
  /** English effect name, as in the wiki's Effect# anchor. */
  readonly name: string;
  /** Tier I, II and III values as printed, e.g. "10%". */
  readonly values: readonly [string, string, string];
}

export interface FixedBonus {
  readonly kind: "effect" | "enchantment";
  /** English name of the effect or enchantment. */
  readonly name: string;
  /** The first percentage in the wiki's one-line description, when there is one. */
  readonly value?: string;
}

const LEVEL2_HEADING = /^==([^=].*?)==\s*$/;
const EFFECT_LINK = /\{\{MCD2\|Effect#([^|}]+)(?:\|[^}]*)?\}\}/;
const PERCENT = /\d+(?:\.\d+)?%/;
const TIER_COUNT = 3;

/** The body of a level-2 section (`== heading ==`), subsections included; undefined when the page has none. */
export function wikiSection(text: string, heading: string): string | undefined {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => LEVEL2_HEADING.exec(line)?.[1].trim() === heading);
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => LEVEL2_HEADING.test(line));
  return rest.slice(0, end === -1 ? undefined : end).join("\n");
}

/** Splits a wikitable row into cells, whether each cell is on its own `|` line or joined with `||`. */
function rowCells(row: string): string[] {
  return row
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.startsWith("|}"))
    .flatMap((line) => line.slice(1).split("||"))
    .map((cell) => cell.trim());
}

/** Rows of the "Compatible effects" table: effect name plus its three tier values. */
export function parseCompatibleEffects(section: string): CompatibleEffect[] {
  return section
    .split(/^\|-\s*$/m)
    .slice(1)
    .flatMap((row) => {
      const cells = rowCells(row);
      const name = EFFECT_LINK.exec(cells[0] ?? "")?.[1].trim();
      const tiers = cells.slice(-TIER_COUNT);
      if (!name || cells.length < 2 + TIER_COUNT || tiers.some((tier) => tier === "")) return [];
      return [{ name, values: [tiers[0], tiers[1], tiers[2]] as const }];
    });
}

/** The fixed effect or enchantment named in a "Unique effect" section; undefined when the wiki does not name it. */
export function parseFixedBonus(section: string): FixedBonus | undefined {
  const sentence = /The fixed (.+?) of .+? is (.+?), which cannot be rerolled/.exec(section);
  if (!sentence) return undefined;
  const [, kindText, subject] = sentence;
  const effect = EFFECT_LINK.exec(subject)?.[1].trim();
  const value = PERCENT.exec(section.slice(sentence.index + sentence[0].length))?.[0];
  if (effect) return { kind: "effect", name: effect, ...(value ? { value } : {}) };
  if (!/enchantment/i.test(kindText) || /\{\{MCD2\|Enchanting/.test(subject)) return undefined;
  const name = (/^\{\{MCD2\|([^|}]+)\}\}$/.exec(subject.trim())?.[1] ?? subject).trim();
  return /[{}[\]]/.test(name) ? undefined : { kind: "enchantment", name };
}

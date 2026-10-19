/** Icon textures named by the DataTables' IconReference, resolved to files under source-data. */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Category } from "../../shared/config";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue } from "./issues";
import { readTableFile } from "./table-reader";

const Rows = z.array(z.object({ Name: z.string(), IconReference: z.string().optional() }));
type RowList = z.infer<typeof Rows>;

/**
 * The tables each category's IconReference comes from. Artifacts, talismans, capes and pets are left out:
 * their row names (RallyingHorn, BrawlingTalisman…) do not match the entry ids, and file-name matching
 * already finds their icons.
 */
const CATEGORY_TABLES: Readonly<Partial<Record<Category, string>>> = {
  melee: "DT_ItemDefinitionMelee",
  ranged: "DT_ItemDefinitionRanged",
  armor: "DT_ItemDefinitionArmor",
  "enchantment-book": "DT_ItemDefinitionEnchantmentBook",
  enchantment: "DT_EnchantmentDefinition",
  effect: "DT_EffectDefinition",
  status: "DT_StatusDefinition",
};

/**
 * Tables to try, in order, for an entry. A book looks in the book table first; the enchantment table is
 * the intended fallback for books without a reference (the game shows the enchantment's icon on them).
 */
const LOOKUP_ORDER: Readonly<Partial<Record<Category, readonly Category[]>>> = {
  "enchantment-book": ["enchantment-book", "enchantment"],
};

/** Only enchantments have Unique-tier rows (MaulerDive.Unique) that stand for the plain id. */
const UNIQUE_FALLBACK: ReadonlySet<Category> = new Set(["enchantment", "enchantment-book"]);

const BOOK_PREFIX = /^EnchantmentBook_/;

export type IconReferences = ReadonlyMap<Category, ReadonlyMap<string, string>>;

/** Row names use dots (MaulerDive.Unique); entry ids use underscores. */
export const rowKey = (name: string): string => name.replace(/\./g, "_").toLowerCase();

export function buildIconReferences(tables: Readonly<Partial<Record<Category, RowList>>>): IconReferences {
  return new Map(
    Object.entries(tables).map(([category, rows]) => [
      category as Category,
      new Map(
        (rows ?? []).flatMap((row) =>
          row.IconReference && row.IconReference !== "None" ? [[rowKey(row.Name), row.IconReference] as const] : [],
        ),
      ),
    ]),
  );
}

/** Reads the category tables; empty when source-data has no DataTables folder or a table is absent. */
export async function loadIconReferences(sourceRoot: string): Promise<IconReferences> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(dir)) return new Map();
  const loaded = await Promise.all(
    Object.entries(CATEGORY_TABLES).map(async ([category, name]) => {
      const json = await readTableFile(path.join(dir, `${name}.json`), `資料表 ${name}`);
      if (json === undefined) return [category, []] as const;
      const parsed = Rows.safeParse(json);
      if (!parsed.success) throw new ExtractError(`資料表 ${name} 不是預期的列陣列：${formatZodIssue(parsed.error.issues[0])}`);
      return [category, parsed.data] as const;
    }),
  );
  return buildIconReferences(Object.fromEntries(loaded));
}

/** The raw IconReference of an entry, or undefined when the game names none. */
export function referenceFor(references: IconReferences, category: Category, id: string): string | undefined {
  const key = (category === "enchantment-book" ? id.replace(BOOK_PREFIX, "") : id).toLowerCase();
  for (const table of LOOKUP_ORDER[category] ?? [category]) {
    const rows = references.get(table);
    const found = rows?.get(key) ?? (UNIQUE_FALLBACK.has(table) ? rows?.get(`${key}_unique`) : undefined);
    if (found) return found;
  }
  return undefined;
}

/** Source-relative png paths a reference can live at, most likely first. */
export function referencePaths(reference: string): string[] {
  const asset = reference.replace(/\.[^/.]*$/, "");
  const game = /^\/Game\/Spicewood\/(.+)$/.exec(asset);
  if (game) return [`Assets/${game[1]}.png`];
  const plugin = /^\/([^/]+)\/(.+)$/.exec(asset);
  return plugin ? [`Plugins/${plugin[1]}/Content/${plugin[2]}.png`, `Assets/${plugin[2]}.png`] : [];
}

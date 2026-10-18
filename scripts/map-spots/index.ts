/**
 * One-off: reads the raw game export's overworld World Partition cells and writes a small map-spots.json into source-data,
 * which the extractor then reads (the raw export is ~1.4 GB and not in CI).
 * Run: npx tsx scripts/map-spots/index.ts <raw-export-dir> [source-data]
 * Finds the Soul Storm generator slots, the talisman chests and the dungeon doors; positions are in cm, as the cells store them.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSpots, type RawObject } from "./collect";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CELLS = ["Content", "Spicewood", "Maps", "Overworld", "Overworld", "_Generated_"];
const OUTPUT = ["MapSpots", "map-spots.json"] as const;
/** Cheap pre-filter: only cells mentioning one of these are parsed. */
const NEEDLES = ["SW.SpawnDefinition.Storminator", "SW.LootActor.TalismansChest.", "ETeleportDoorVisualType::Dungeon"];

async function readCell(file: string): Promise<RawObject[] | undefined> {
  const text = await readFile(file, "utf8");
  if (!NEEDLES.some((needle) => text.includes(needle))) return undefined;
  const cell: unknown = JSON.parse(text);
  if (!Array.isArray(cell)) throw new Error(`${file}: expected an array of objects`);
  return cell as RawObject[];
}

async function main(): Promise<void> {
  const exportDir = process.argv[2];
  if (!exportDir) throw new Error("usage: tsx scripts/map-spots/index.ts <raw-export-dir> [source-data]");
  const sourceRoot = path.resolve(process.argv[3] ?? path.join(projectRoot, "source-data"));
  const dir = path.join(path.resolve(exportDir), ...CELLS);
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  const cells: RawObject[][] = [];
  for (const name of files) {
    const cell = await readCell(path.join(dir, name));
    if (cell) cells.push(cell);
  }
  const spots = collectSpots(cells);
  const out = path.join(sourceRoot, ...OUTPUT);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(spots)}\n`);
  console.log(`${files.length} cells scanned, ${cells.length} used: ${spots.storm.length} storm slots, ${spots.talismanChests.length} talisman chests, ${spots.dungeons.length} dungeon doors -> ${out}`);
}

main().catch((error: unknown) => {
  console.error(`map-spots failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

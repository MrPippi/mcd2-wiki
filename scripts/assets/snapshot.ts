import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

/** How a file compares with the previous run. */
export const CHANGES = {
  new: "新增",
  changed: "變更",
  same: "未變",
} as const;
export type Change = keyof typeof CHANGES;

const SnapshotSchema = z.object({ files: z.record(z.string(), z.string()) }).strict();
export type Snapshot = z.infer<typeof SnapshotSchema>;

export interface SnapshotDiff {
  /** True on the first run: there is nothing to compare against yet. */
  readonly isBaseline: boolean;
  readonly changes: ReadonlyMap<string, Change>;
  readonly removed: readonly string[];
}

/** Compares this run's path → hash map with the last saved snapshot. */
export function diffSnapshot(previous: Snapshot | undefined, current: ReadonlyMap<string, string>): SnapshotDiff {
  if (!previous) {
    return { isBaseline: true, changes: new Map([...current.keys()].map((file) => [file, "same" as const])), removed: [] };
  }
  const changeOf = (file: string, hash: string): Change => {
    const before = previous.files[file];
    if (before === undefined) return "new";
    return before === hash ? "same" : "changed";
  };
  return {
    isBaseline: false,
    changes: new Map([...current].map(([file, hash]) => [file, changeOf(file, hash)])),
    removed: Object.keys(previous.files).filter((file) => !current.has(file)).sort(),
  };
}

export function parseSnapshot(text: string): Snapshot {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`素材快照不是有效的 JSON：${(error as Error).message}`);
  }
  const parsed = SnapshotSchema.safeParse(json);
  if (!parsed.success) throw new Error(`素材快照格式錯誤：${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`);
  return parsed.data;
}

/** Sorted keys, one file per line, so the committed snapshot diffs cleanly between game versions. */
export function serializeSnapshot(current: ReadonlyMap<string, string>): string {
  const files = Object.fromEntries([...current].sort(([a], [b]) => a.localeCompare(b, "en")));
  return `${JSON.stringify({ files }, null, 2)}\n`;
}

export async function readSnapshot(filePath: string): Promise<Snapshot | undefined> {
  return existsSync(filePath) ? parseSnapshot(await readFile(filePath, "utf8")) : undefined;
}

export const writeSnapshot = (filePath: string, current: ReadonlyMap<string, string>): Promise<void> =>
  writeFile(filePath, serializeSnapshot(current), "utf8");

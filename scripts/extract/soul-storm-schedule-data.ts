/** The Soul Storm clock (anchor, length, cadence) and the area rotation, with each area named, placed on the map and checked for missing translations. */
import { localizedFrom } from "../../src/lib/lang";
import { LANGS, type Lang } from "./config";
import { ExtractError, issue, type Issue } from "./issues";
import { englishFallbacks, localize, locRef } from "./loc-table";
import type { AreaMarker } from "./mob-areas";
import type { MobArea } from "./mob-schema";
import type { AreaRow } from "./mob-tables";
import { tagKey } from "./mob-tags";
import type { LocaleFile } from "./schemas";
import type { SoulStormData, SoulStormStatus } from "./soul-storm-schema";
import type { RotationRow, ScheduleRow } from "./soul-storm-tables";

type Locales = Readonly<Record<Lang, LocaleFile>>;

const UE_TIMESTAMP = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})$/;
const MS_PER_MINUTE = 60_000;
const NAME_KEY = 'TagName="SW.TextEntry.Name"';
const TAG_TAIL_SEGMENTS = 2;

/** "2026.01.01-00.00.00" read as UTC minus offsetMinutes → ISO string; throws ExtractError on any other format. */
export function parseUeTimestamp(raw: string, offsetMinutes: number): string {
  const match = UE_TIMESTAMP.exec(raw);
  if (!match) throw new ExtractError(`Soul Storm 時間戳記格式不符（預期 YYYY.MM.DD-HH.mm.ss）：「${raw}」`);
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(utc);
  const roundTrips = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    && check.getUTCHours() === hour && check.getUTCMinutes() === minute && check.getUTCSeconds() === second;
  if (!roundTrips) throw new ExtractError(`Soul Storm 時間戳記不是有效的日期時間：「${raw}」`);
  return new Date(utc - offsetMinutes * MS_PER_MINUTE).toISOString();
}

export function buildSchedule(row: ScheduleRow, status: SoulStormStatus): SoulStormData["schedule"] {
  const { DurationInSeconds: duration, CadenceInSeconds: cadence } = row;
  if (!(duration > 0 && cadence > duration)) {
    throw new ExtractError(`Soul Storm 時程不合理：持續 ${duration} 秒、週期 ${cadence} 秒（必須 週期 > 持續 > 0）`);
  }
  return {
    anchorRaw: row.Timestamp,
    anchorUtc: parseUeTimestamp(row.Timestamp, status.anchorOffsetMinutes),
    anchorOffsetMinutes: status.anchorOffsetMinutes,
    durationSeconds: duration,
    cadenceSeconds: cadence,
    rotationOffset: status.rotationOffset,
  };
}

export interface RotationResult {
  readonly rotation: MobArea[];
  readonly untranslated: Lang[];
  readonly issues: Issue[];
}

interface NamedArea {
  readonly area: MobArea;
  readonly fallbacks: readonly Lang[];
  readonly issue?: Issue;
}

/** "SW.Area.Forest.A1" → "Forest A1": the last two tag segments, for an area the game gives no name. */
const tagLabel = (tag: string): string => tag.split(".").slice(-TAG_TAIL_SEGMENTS).join(" ");

function nameRef(row: AreaRow | undefined): ReturnType<typeof locRef> {
  const entry = Object.entries(row?.TypeTextData?.Texts ?? {}).find(([key]) => key.includes(NAME_KEY));
  return entry ? locRef(entry[1].Text) : undefined;
}

function nameArea(tag: string, rows: ReadonlyMap<string, AreaRow>, locales: Locales, markers: ReadonlyMap<string, AreaMarker>): NamedArea {
  const ref = nameRef(rows.get(tagKey(tag)));
  const name = ref ? localize(locales, ref.namespace, ref.key) : undefined;
  const marker = markers.get(tagKey(tag));
  const map = marker ? { map: { world: marker.world, px: marker.px, py: marker.py } } : {};
  if (!ref || !name?.en) {
    const label = tagLabel(tag);
    return { area: { areaId: tag, name: localizedFrom(() => label), ...map }, fallbacks: LANGS.filter((lang) => lang !== "en"), issue: issue("soul-storm-area-unnamed", tag) };
  }
  return { area: { areaId: tag, name, ...map }, fallbacks: englishFallbacks(locales, ref.namespace, ref.key) };
}

export function buildRotation(row: RotationRow, areas: readonly AreaRow[], locales: Locales, markers: ReadonlyMap<string, AreaMarker>): RotationResult {
  const rows = new Map<string, AreaRow>();
  for (const area of areas) if (!rows.has(tagKey(area.TypeTag.TagName))) rows.set(tagKey(area.TypeTag.TagName), area);
  const named = row.AreaTags.map(({ TagName }) => nameArea(TagName, rows, locales, markers));
  const missing = new Set(named.flatMap((entry) => entry.fallbacks));
  return {
    rotation: named.map((entry) => entry.area),
    untranslated: LANGS.filter((lang) => missing.has(lang)),
    issues: named.flatMap((entry) => (entry.issue ? [entry.issue] : [])),
  };
}

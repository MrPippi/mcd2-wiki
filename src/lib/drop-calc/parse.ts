/** The calculator's JSON payload and its check in the browser (no zod: it would ship with the page). */

export interface CalcItem {
  readonly key: string;
  readonly name: string;
  /** Folded names the filter matches against. */
  readonly search: string;
  readonly href: string;
  readonly icon?: string;
}

export interface CalcLabel {
  readonly name: string;
  readonly href?: string;
  readonly note?: string;
  /** The data does not say where the source appears. */
  readonly unplaced?: true;
  /** Area labels: the area's game icon URL. */
  readonly icon?: string;
}

export interface CalcLabels {
  readonly pick: string; readonly item: string; readonly filter: string; readonly noItems: string;
  readonly threat: string; readonly difficulty: string; readonly rarity: string;
  readonly source: string; readonly area: string; readonly chance: string;
  readonly allSources: string; readonly allAreas: string; readonly anyArea: string; readonly unplaced: string;
  /** Has {item}, {threat}, {difficulty}, {rarity} and {count} placeholders. */
  readonly summary: string; readonly none: string; readonly empty: string; readonly gearOnly: string;
}

export interface CalcPayload {
  /** False when the build has no drop data; the page then says so instead of loading the calculator. */
  readonly available: boolean;
  readonly items: readonly CalcItem[];
  readonly levels: readonly number[];
  readonly defaultLevel: number;
  readonly difficulties: readonly { readonly id: string; readonly name: string }[];
  readonly rarities: readonly { readonly id: string; readonly name: string }[];
  readonly sources: Readonly<Record<string, CalcLabel>>;
  readonly areas: Readonly<Record<string, CalcLabel>>;
  readonly labels: CalcLabels;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const named = (value: unknown): boolean => isRecord(value) && isText(value.name);

/** The payload when it has the shape the page renders; undefined otherwise (the caller reports it). */
export function parseCalcPayload(raw: unknown): CalcPayload | undefined {
  if (!isRecord(raw) || typeof raw.available !== "boolean" || !isRecord(raw.labels) || !isRecord(raw.sources) || !isRecord(raw.areas)) return undefined;
  const list = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;
  const ok =
    list(raw.items) && raw.items.every((one) => isRecord(one) && isText(one.key) && isText(one.name) && typeof one.search === "string" && isText(one.href)) &&
    list(raw.levels) && raw.levels.every((one) => Number.isInteger(one)) && Number.isInteger(raw.defaultLevel) &&
    list(raw.difficulties) && raw.difficulties.every((one) => isRecord(one) && isText(one.id) && isText(one.name)) &&
    list(raw.rarities) && raw.rarities.every((one) => isRecord(one) && isText(one.id) && isText(one.name)) &&
    Object.values(raw.sources).every(named) && Object.values(raw.areas).every(named) &&
    Object.values(raw.labels).every(isText);
  return ok ? (raw as unknown as CalcPayload) : undefined;
}

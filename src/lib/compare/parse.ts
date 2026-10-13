/** The comparison page's JSON payload and its check in the browser (no zod: it would ship with the page). */

export interface CompareWeapon {
  readonly slug: string;
  readonly kind: "melee" | "ranged";
  readonly name: string;
  readonly icon?: string;
  readonly href: string;
  readonly unique?: true;
  /** Cells by row key: printed text, and the number the row ranks by. */
  readonly cells: Readonly<Record<string, { readonly text: string; readonly value?: number }>>;
  /** Names of the effects the weapon can roll. */
  readonly effects: readonly string[];
  /** The built-in bonus's name, for unique weapons. */
  readonly fixed?: string;
}

export interface CompareLabels {
  readonly pick: string;
  /** Has an `{n}` placeholder. */
  readonly column: string;
  readonly stat: string;
  readonly effects: string;
  readonly best: string;
  readonly builtIn: string;
  readonly empty: string;
  /** Has an `{n}` placeholder. */
  readonly dropped: string;
  readonly melee: string;
  readonly ranged: string;
  readonly copied: string;
  readonly copyFailed: string;
}

export interface ComparePayload {
  readonly rows: readonly { readonly key: string; readonly label: string; readonly better: "high" | "low" | "none" }[];
  readonly weapons: readonly CompareWeapon[];
  readonly labels: CompareLabels;
}

const LABEL_KEYS = ["pick", "column", "stat", "effects", "best", "builtIn", "empty", "dropped", "melee", "ranged", "copied", "copyFailed"] as const satisfies readonly (keyof CompareLabels)[];
const PLACEHOLDERS: Partial<Record<keyof CompareLabels, string>> = { column: "{n}", dropped: "{n}" };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const optionalText = (value: unknown): boolean => value === undefined || isText(value);

const isCell = (value: unknown): boolean => isRecord(value) && typeof value.text === "string" && (value.value === undefined || Number.isFinite(value.value));

const isWeapon = (value: unknown): value is CompareWeapon =>
  isRecord(value) &&
  isText(value.slug) &&
  (value.kind === "melee" || value.kind === "ranged") &&
  isText(value.name) &&
  optionalText(value.icon) &&
  isText(value.href) &&
  (value.unique === undefined || value.unique === true) &&
  isRecord(value.cells) &&
  Object.values(value.cells).every(isCell) &&
  Array.isArray(value.effects) &&
  value.effects.every(isText) &&
  optionalText(value.fixed);

const isRow = (value: unknown): boolean =>
  isRecord(value) && isText(value.key) && isText(value.label) && (value.better === "high" || value.better === "low" || value.better === "none");

const isLabels = (value: unknown): value is CompareLabels =>
  isRecord(value) && LABEL_KEYS.every((key) => isText(value[key]) && (PLACEHOLDERS[key] === undefined || (value[key] as string).includes(PLACEHOLDERS[key] as string)));

/** The payload when it has the expected shape, else undefined. */
export function parseComparePayload(value: unknown): ComparePayload | undefined {
  if (!isRecord(value) || !Array.isArray(value.rows) || !Array.isArray(value.weapons) || !isLabels(value.labels)) return undefined;
  if (!value.rows.every(isRow) || !value.weapons.every(isWeapon)) return undefined;
  return value as unknown as ComparePayload;
}

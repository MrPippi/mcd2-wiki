/** The calculator's choices, their place in the page URL (`?item=melee/sword&threat=20&diff=normal&rarity=any`), and the rows they give. */
import { formatDropOdds } from "../drop-format";
import { itemRows } from "../../../shared/drop-odds";
import type { DropFile, DropRow, TargetRarity } from "../../../shared/drop-types";
import type { CalcPayload } from "./parse";

export interface CalcState {
  readonly item: string;
  readonly level: number;
  readonly difficulty: string;
  readonly rarity: TargetRarity;
  /** "" for all sources. */
  readonly source: string;
  /** "" for all areas. */
  readonly area: string;
}

const RARITIES: readonly string[] = ["any", "common", "rare", "special", "unique"];

/** The state a URL asks for, with anything unknown replaced by the default. */
export function decodeState(search: string, payload: CalcPayload): CalcState {
  const params = new URLSearchParams(search);
  const item = params.get("item") ?? "";
  const level = Number(params.get("threat"));
  const difficulty = params.get("diff") ?? "";
  const rarity = params.get("rarity") ?? "";
  return {
    item: payload.items.some((one) => one.key === item) ? item : "",
    level: payload.levels.includes(level) ? level : payload.defaultLevel,
    difficulty: payload.difficulties.some((one) => one.id === difficulty) ? difficulty : (payload.difficulties.find((one) => one.id === "normal") ?? payload.difficulties[0]).id,
    rarity: RARITIES.includes(rarity) ? (rarity as TargetRarity) : "any",
    source: "",
    area: "",
  };
}

/** `search` with the state's choices written, other parameters kept: "?...", or empty. */
export function encodeState(search: string, state: CalcState, payload: CalcPayload): string {
  const params = new URLSearchParams(search);
  for (const name of ["item", "threat", "diff", "rarity"]) params.delete(name);
  const own = [
    state.item ? `item=${encodeURIComponent(state.item)}` : "",
    state.level !== payload.defaultLevel ? `threat=${state.level}` : "",
    state.difficulty !== "normal" ? `diff=${encodeURIComponent(state.difficulty)}` : "",
    state.rarity !== "any" ? `rarity=${state.rarity}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const query = [params.toString(), own].filter(Boolean).join("&");
  return query ? `?${query}` : "";
}

/** Every source and area that can give the chosen item, before the source and area choices narrow them. */
export function allRows(file: DropFile, state: CalcState): DropRow[] {
  return state.item ? itemRows(file, state.item, { level: state.level, difficulty: state.difficulty, rarity: state.rarity }) : [];
}

/** The rows the source and area choices keep. */
export const narrowRows = (rows: readonly DropRow[], state: CalcState): DropRow[] =>
  rows.filter((row) => (state.source === "" || row.source === state.source) && (state.area === "" || row.area === state.area));

/** Every source and area that can give the chosen item, narrowed by the source and area choices. */
export const stateRows = (file: DropFile, state: CalcState): DropRow[] => narrowRows(allRows(file, state), state);

/** The sources and areas the unnarrowed rows have, for the two narrowing menus. */
export function narrowing(rows: readonly DropRow[]): { sources: string[]; areas: string[] } {
  return { sources: [...new Set(rows.map((row) => row.source))], areas: [...new Set(rows.map((row) => row.area).filter((area) => area !== ""))] };
}

export { formatDropOdds };

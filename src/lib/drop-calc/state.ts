/** The calculator's choices, their place in the page URL (`?item=melee/sword&threat=20&diff=normal&rarity=any`), and the rows they give. */
import { formatOdds } from "../affix-odds";
import { itemRows } from "../drop-odds";
import type { DropFile, DropRow, TargetRarity } from "../drop-types";
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
    state.item ? `item=${state.item}` : "",
    state.level !== payload.defaultLevel ? `threat=${state.level}` : "",
    state.difficulty !== "normal" ? `diff=${encodeURIComponent(state.difficulty)}` : "",
    state.rarity !== "any" ? `rarity=${state.rarity}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const query = [params.toString(), own].filter(Boolean).join("&");
  return query ? `?${query}` : "";
}

/** Every source and area that can give the chosen item, narrowed by the source and area choices. */
export function stateRows(file: DropFile, state: CalcState): DropRow[] {
  if (!state.item) return [];
  return itemRows(file, state.item, { level: state.level, difficulty: state.difficulty, rarity: state.rarity }).filter(
    (row) => (state.source === "" || row.source === state.source) && (state.area === "" || row.area === state.area),
  );
}

/** The sources and areas the unnarrowed rows have, for the two narrowing menus. */
export function narrowing(rows: readonly DropRow[]): { sources: string[]; areas: string[] } {
  return { sources: [...new Set(rows.map((row) => row.source))], areas: [...new Set(rows.map((row) => row.area).filter((area) => area !== ""))] };
}

export { formatOdds };

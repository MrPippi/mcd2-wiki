import type { WorldKey } from "./worlds";

/** A map view: zoom level and centre, as pixels on the full-size render. */
export interface View {
  readonly z: number;
  readonly px: number;
  readonly py: number;
}

export interface ViewLimits {
  readonly zMin: number;
  readonly zMax: number;
  readonly imageSize: number;
}

const NUMBER = String.raw`(-?\d+(?:\.\d+)?)`;
const VIEW_HASH = new RegExp(`^#${NUMBER}/${NUMBER}/${NUMBER}$`);

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export function parseWorld(search: string, available: readonly WorldKey[]): WorldKey | undefined {
  const wanted = new URLSearchParams(search).get("world");
  return available.find((key) => key === wanted) ?? available[0];
}

/** The view in a `#z/px/py` hash, pulled back inside the map; undefined when the hash is not a view. */
export function parseView(hash: string, limits: ViewLimits): View | undefined {
  const match = VIEW_HASH.exec(hash);
  if (!match) return undefined;
  const [z, px, py] = match.slice(1).map(Number);
  return {
    z: clamp(Math.round(z), limits.zMin, limits.zMax),
    px: clamp(px, 0, limits.imageSize),
    py: clamp(py, 0, limits.imageSize),
  };
}

export const formatView = (view: View): string => `#${Math.round(view.z)}/${Math.round(view.px)}/${Math.round(view.py)}`;

export function worldSearch(search: string, world: WorldKey): string {
  const params = new URLSearchParams(search);
  params.set("world", world);
  return `?${params.toString()}`;
}

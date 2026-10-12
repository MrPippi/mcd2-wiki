/** The build in the page URL: `?v=1&m=sword&a=horn,,wind…`. Shared by the browser script and the tests. */
import { BUILD_SLOTS, type Build, type PoolKey, type SlotKey } from "./slots";

export const BUILD_VERSION = 1;
const VERSION_PARAM = "v";
const LIST_SEPARATOR = ",";

/** The slugs each pool offers. */
export type Pools = Readonly<Record<PoolKey, ReadonlySet<string>>>;

export interface DecodedBuild {
  readonly build: Build;
  /** Slugs left out: unknown to their slot, repeated in a list, or past its last slot. */
  readonly dropped: number;
  /** The URL holds a build this version cannot read; `build` is empty. */
  readonly unsupported: boolean;
}

const PARAMS: readonly string[] = [...new Set(BUILD_SLOTS.map((slot) => slot.param))];
const slotsFor = (param: string) => BUILD_SLOTS.filter((slot) => slot.param === param).sort((a, b) => a.index - b.index);

/** The query string (without "?") for a build; empty when no slot is filled. */
export function encodeBuild(build: Build): string {
  const params = new URLSearchParams();
  for (const param of PARAMS) {
    const values = slotsFor(param).map((slot) => build[slot.key] ?? "");
    while (values.length > 0 && values[values.length - 1] === "") values.pop();
    if (values.length > 0) params.set(param, values.join(LIST_SEPARATOR));
  }
  if ([...params.keys()].length === 0) return "";
  return `${VERSION_PARAM}=${BUILD_VERSION}&${params.toString()}`;
}

/** Reads a build from `location.search`, keeping only what each slot offers. */
export function decodeBuild(search: string, pools: Pools): DecodedBuild {
  const params = new URLSearchParams(search);
  const present = PARAMS.filter((param) => params.has(param));
  if (present.length === 0) return { build: {}, dropped: 0, unsupported: false };
  if (params.get(VERSION_PARAM) !== String(BUILD_VERSION)) return { build: {}, dropped: 0, unsupported: true };

  const build: Partial<Record<SlotKey, string>> = {};
  let dropped = 0;
  for (const param of present) {
    const slots = slotsFor(param);
    const values = (params.get(param) ?? "").split(LIST_SEPARATOR);
    const used = new Set<string>();
    values.forEach((slug, index) => {
      if (slug === "") return;
      const slot = slots[index];
      if (!slot || !pools[slot.pool].has(slug) || used.has(slug)) {
        dropped += 1;
        return;
      }
      used.add(slug);
      build[slot.key] = slug;
    });
  }
  return { build, dropped, unsupported: false };
}

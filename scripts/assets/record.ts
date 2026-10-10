import { KINDS, type Kind } from "./classify";
import type { Change } from "./snapshot";
import type { Usage } from "./usage";

/** One raw asset file with its place in the index and how the site uses it. */
export interface AssetRecord {
  /** Forward-slash path relative to source-data, e.g. Assets/UI/Icons/Statuses/T_UI_Burning.png. */
  readonly path: string;
  readonly name: string;
  readonly group: string;
  readonly sub: string;
  readonly detail: string;
  /** False when no rule matched and the file fell back to the "other" group. */
  readonly matched: boolean;
  readonly kind: Kind;
  readonly usage: Usage;
  /** Site icons with identical bytes, relative to public/. */
  readonly published: readonly string[];
  readonly change: Change;
  readonly bytes: number;
}

const KIND_ORDER = Object.keys(KINDS) as Kind[];

/** Display order: group, sub-item, detail, then icons before textures and maps, then path. */
export function sortRecords(records: readonly AssetRecord[], groupOrder: readonly string[]): AssetRecord[] {
  return [...records].sort(
    (a, b) =>
      groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) ||
      a.sub.localeCompare(b.sub, "en") ||
      a.detail.localeCompare(b.detail, "en") ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.path.localeCompare(b.path, "en"),
  );
}

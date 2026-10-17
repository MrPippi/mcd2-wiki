/** Marker kinds in display order; plain TS so the browser bundle never pulls in zod. */
export const MARKER_KINDS = ["minecart", "rift", "portal", "merchant", "quest", "quest-area", "area"] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];
/** Kinds the reader can show or hide; area names are always on, as quiet text under the pins. */
export const FILTER_KINDS = ["minecart", "rift", "portal", "merchant", "quest", "quest-area"] as const;
export type FilterKind = (typeof FILTER_KINDS)[number];

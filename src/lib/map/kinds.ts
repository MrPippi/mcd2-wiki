/** Marker kinds in display order; plain TS so the browser bundle never pulls in zod. */
export const MARKER_KINDS = ["minecart", "rift", "portal", "merchant", "area"] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

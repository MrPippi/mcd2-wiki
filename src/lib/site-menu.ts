// The header's hamburger menu: pages that sit outside the category navigation.
// Type-only import of the UI keys, so the header script never pulls in the dictionaries.
import type { UiKey } from "./ui-strings";

export interface MenuItem {
  readonly key: UiKey;
  /** Path segment after the language: /<lang>/<segment>/. */
  readonly segment: string;
}

export const SITE_MENU: readonly MenuItem[] = [
  { key: "map", segment: "map" },
  { key: "achievements", segment: "achievements" },
  { key: "mobs", segment: "mobs" },
  { key: "soulStorm", segment: "soul-storm" },
  { key: "build", segment: "build" },
  { key: "weaponCompare", segment: "compare" },
  { key: "guides", segment: "guides" },
];

/** Whether `pathname` is the menu page `segment` in some language (/<base>/<lang>/<segment>/). */
export function isMenuPage(pathname: string, base: string, segment: string): boolean {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, "");
  const parts = rest.split("/").filter(Boolean);
  return parts.length === 2 && parts[1] === segment;
}

/** The language switch link with the current page's query and anchor carried over. */
export function withCurrentLocation(href: string, search: string, hash: string): string {
  return `${href.replace(/[?#].*$/, "")}${search}${hash}`;
}

/** Folder, beside the card-size portraits, that holds the mob page renders. */
export const LARGE_PORTRAIT_DIR = "large";

/** "mobs/zombie.webp" -> "mobs/large/zombie.webp". */
export function largePortraitPath(published: string): string {
  const slash = published.lastIndexOf("/");
  return `${published.slice(0, slash + 1)}${LARGE_PORTRAIT_DIR}/${published.slice(slash + 1)}`;
}

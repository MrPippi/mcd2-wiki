const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Game descriptions are whitelisted HTML; meta tags need their plain text. */
export const plainText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();

/** A search-snippet-sized description: trimmed to `max` characters, or `fallback` when empty. */
export function metaDescription(text: string, max = 160, fallback = ""): string {
  const clean = text.trim();
  if (clean === "") return fallback;
  const chars = [...clean];
  return chars.length <= max ? clean : `${chars.slice(0, max - 1).join("")}…`;
}

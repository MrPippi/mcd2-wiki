// Shared by the client-bundle tests: which specifiers a module loads at run time.
const IMPORT = /^\s*(import|export)\s+([^'";]*?)\s*from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;

const isTypeOnly = (keyword: string, clause: string): boolean => {
  if (/^type\b/.test(clause)) return true;
  const braces = /^\{([^}]*)\}$/.exec(clause.trim());
  if (!braces) return false;
  const names = braces[1].split(",").map((part) => part.trim()).filter(Boolean);
  return keyword === "import" ? names.length > 0 && names.every((name) => name.startsWith("type ")) : names.every((name) => name.startsWith("type "));
};

/** Specifiers a module loads at run time (type-only imports and re-exports are erased). */
export const runtimeImports = (source: string): string[] =>
  [...source.matchAll(IMPORT)].flatMap((match) => {
    if (match[4]) return [match[4]];
    return isTypeOnly(match[1], match[2]) ? [] : [match[3]];
  });

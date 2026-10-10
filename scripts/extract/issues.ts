export type IssueType =
  | "missing-namespace"
  | "skipped-key"
  | "ignored-field"
  | "missing-text"
  | "placeholder-only"
  | "missing-name"
  | "weapon-unmatched"
  | "missing-datatables"
  | "untranslated"
  | "markup-warning"
  | "missing-icon-root"
  | "missing-icon"
  | "ambiguous-icon"
  | "override-missing-file"
  | "missing-frame"
  | "missing-ui-icon"
  | "missing-brand"
  | "duplicate-entry"
  | "unlinked-enchantment"
  | "armor-set-name-fallback"
  | "missing-map-tables"
  | "map-marker-outside"
  | "map-missing-name"
  | "map-unmatched-tag"
  | "missing-ui-game-string";

export interface Issue {
  readonly type: IssueType;
  readonly detail: string;
}

export const issue = (type: IssueType, detail: string): Issue => ({ type, detail });

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}

export function formatZodIssue(zodIssue: { path: readonly PropertyKey[]; message: string }): string {
  const location = zodIssue.path.map(String).join(" › ") || "(root)";
  return `${location}：${zodIssue.message}`;
}

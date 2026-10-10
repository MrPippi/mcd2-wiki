/**
 * Evaluates an Unreal FGameplayTagQuery as exported in DataTables: a tag dictionary plus a token stream
 * [version, hasRootExpression, expression...]. Each expression is a type, a count, then that many tag indices
 * (types 1–3) or sub-expressions (types 4–6).
 */
export interface TagQuery {
  readonly TagDictionary: readonly { readonly TagName: string }[];
  readonly QueryTokenStream: readonly number[];
}

const ANY_TAGS = 1;
const ALL_TAGS = 2;
const NO_TAGS = 3;
const ANY_EXPR = 4;
const ALL_EXPR = 5;

/** An item tag satisfies a query tag when it is that tag or one of its children (A.B satisfies A). */
const hasTag = (tags: ReadonlySet<string>, wanted: string): boolean =>
  tags.has(wanted) || [...tags].some((tag) => tag.startsWith(`${wanted}.`));

export function matchesTagQuery(query: TagQuery, tags: ReadonlySet<string>): boolean {
  const dictionary = query.TagDictionary.map((entry) => entry.TagName);
  const stream = query.QueryTokenStream;
  if (stream[1] !== 1) return false;
  let position = 2;
  const next = (): number => stream[position++];
  const expression = (): boolean => {
    const type = next();
    const count = next();
    if (type <= NO_TAGS) {
      const listed = Array.from({ length: count }, () => dictionary[next()]);
      if (type === ANY_TAGS) return listed.some((tag) => hasTag(tags, tag));
      if (type === ALL_TAGS) return listed.every((tag) => hasTag(tags, tag));
      return !listed.some((tag) => hasTag(tags, tag));
    }
    const results = Array.from({ length: count }, expression);
    if (type === ANY_EXPR) return results.some(Boolean);
    if (type === ALL_EXPR) return results.every(Boolean);
    return !results.some(Boolean);
  };
  return expression();
}

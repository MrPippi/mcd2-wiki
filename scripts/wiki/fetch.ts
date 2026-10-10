import { z } from "zod";
import type { WikiPage } from "./assemble";

const API = "https://minecraft.wiki/api.php";
// The wiki asks API clients to identify themselves and how to reach the operator.
const USER_AGENT = "mcd2-wiki-fan-site/0.1 (https://github.com/MrPippi/mcd2-wiki)";
/** MediaWiki's per-request title limit for anonymous clients. */
const TITLES_PER_REQUEST = 50;

export class WikiFetchError extends Error {}

const TitleMapSchema = z.array(z.object({ from: z.string(), to: z.string() }));
const ResponseSchema = z.union([
  z.object({ error: z.object({ code: z.string(), info: z.string() }) }),
  z.object({
    query: z.object({
      normalized: TitleMapSchema.optional(),
      redirects: TitleMapSchema.optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          revisions: z.array(z.object({ revid: z.number().int(), slots: z.object({ main: z.object({ content: z.string() }) }) })).optional(),
        }),
      ),
    }),
  }),
]);

/** Pages from one API response, keyed by every title that leads to them (as asked, normalised, or redirected). */
export function pagesFromResponse(json: unknown): Map<string, WikiPage> {
  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) throw new WikiFetchError(`無法解讀 Wiki API 回應：${parsed.error.message}`);
  if ("error" in parsed.data) throw new WikiFetchError(`Wiki API 錯誤 ${parsed.data.error.code}：${parsed.data.error.info}`);
  const { pages, normalized = [], redirects = [] } = parsed.data.query;
  const byTitle = new Map(
    pages.flatMap((page) => {
      const revision = page.revisions?.[0];
      return page.missing || !revision ? [] : [[page.title, { title: page.title, revision: revision.revid, text: revision.slots.main.content }] as const];
    }),
  );
  const resolve = (title: string): string => {
    const afterNormalise = normalized.find((step) => step.from === title)?.to ?? title;
    return redirects.find((step) => step.from === afterNormalise)?.to ?? afterNormalise;
  };
  const aliases = [...normalized, ...redirects].flatMap(({ from }) => {
    const page = byTitle.get(resolve(from));
    return page ? [[from, page] as const] : [];
  });
  return new Map([...byTitle, ...aliases]);
}

async function fetchBatch(titles: readonly string[]): Promise<Map<string, WikiPage>> {
  const url = new URL(API);
  const params = {
    action: "query",
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
    redirects: "1",
    format: "json",
    formatversion: "2",
    titles: titles.join("|"),
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new WikiFetchError(`Wiki API 回應 HTTP ${response.status}`);
  return pagesFromResponse(await response.json());
}

/** Fetches the current wikitext of each title, in batches, one request at a time. */
export async function fetchWikiPages(titles: readonly string[]): Promise<Map<string, WikiPage>> {
  const batches = Array.from({ length: Math.ceil(titles.length / TITLES_PER_REQUEST) }, (_, i) =>
    titles.slice(i * TITLES_PER_REQUEST, (i + 1) * TITLES_PER_REQUEST),
  );
  const results: Map<string, WikiPage>[] = [];
  for (const batch of batches) results.push(await fetchBatch(batch));
  return new Map(results.flatMap((result) => [...result]));
}

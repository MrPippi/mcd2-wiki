import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/seo";
import { withBase } from "../lib/url";

// Crawlers only read robots.txt at the host root, so this file takes effect once the site has its own domain;
// until then the sitemap is submitted in Search Console.
export const GET: APIRoute = ({ site }) => {
  const sitemap = absoluteUrl(withBase(import.meta.env.BASE_URL, "sitemap-index.xml"), site);
  const lines = ["User-agent: *", "Allow: /", ...(site ? [`Sitemap: ${sitemap}`] : []), ""];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};

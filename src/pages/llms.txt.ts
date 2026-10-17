import type { APIRoute } from "astro";
import { llmsTxt } from "../lib/llms";

export const GET: APIRoute = ({ site }) =>
  new Response(llmsTxt(site, import.meta.env.BASE_URL), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });

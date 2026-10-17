import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

const site = process.env.SITE_URL || undefined;
const base = process.env.BASE_PATH ?? "/";
/** Pages kept out of the sitemap: the root that only picks a language, search results and the 404 page. */
const UNLISTED = /\/(search|404)\/$/;

export default defineConfig({
  // Deployed origin, used for absolute link-preview URLs and the sitemap; set by the deploy workflow.
  site,
  base,
  trailingSlash: "always",
  build: { format: "directory" },
  // Without a site address the integration skips the sitemap (local builds).
  integrations: [sitemap({ filter: (page) => !UNLISTED.test(page) && new URL(page).pathname !== base.replace(/\/?$/, "/") })],
});

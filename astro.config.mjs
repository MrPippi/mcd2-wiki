import { defineConfig } from "astro/config";

export default defineConfig({
  // Deployed origin, used for absolute link-preview URLs; set by the deploy workflow.
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "always",
  build: { format: "directory" },
});

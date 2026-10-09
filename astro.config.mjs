import { defineConfig } from "astro/config";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "always",
  build: { format: "directory" },
});

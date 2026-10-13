/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Wrapped in Astro's Vite config so component tests can render .astro files with the container API.
// BASE_PATH in the environment feeds astro.config.mjs `base`, but it does not reach these tests: here
// import.meta.env.BASE_URL stays "/" (checked with BASE_PATH=/mcd2-wiki/), so unit and component tests always see
// root-relative hrefs. Sub-path links are only exercised by a `BASE_PATH=... npm run build`, not by vitest.
export default getViteConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["scripts/extract/**/*.ts", "scripts/assets/**/*.ts", "scripts/map-tiles/**/*.ts", "src/lib/soul-storm-schedule.ts", "src/lib/quest-view.ts", "src/lib/build/{code,slots,payload,parse,card,gear}.ts", "src/lib/compare/{code,rows,payload,parse}.ts"],
      exclude: ["scripts/extract/index.ts", "scripts/assets/index.ts", "scripts/map-tiles/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

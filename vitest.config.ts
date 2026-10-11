/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Wrapped in Astro's Vite config so component tests can render .astro files with the container API.
export default getViteConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["scripts/extract/**/*.ts", "scripts/assets/**/*.ts", "scripts/map-tiles/**/*.ts"],
      exclude: ["scripts/extract/index.ts", "scripts/assets/index.ts", "scripts/map-tiles/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

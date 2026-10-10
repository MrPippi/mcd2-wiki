import { defineConfig } from "vitest/config";

export default defineConfig({
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

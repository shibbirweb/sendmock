import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      setupFiles: ["./src/test/setup-tests.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/components/ui/**",
          "src/routeTree.gen.ts",
          "src/**/*.test.{ts,tsx}",
          "src/test/**",
        ],
        // AGENTS.md coverage gate. Logic in src/lib must stay at 80% lines;
        // screens are covered by Playwright until component tests land in U1.
        thresholds: {
          "src/lib/**": { lines: 80 },
        },
      },
    },
  }),
);

import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const websitePort = 5192;

export default defineConfig({
  testDir: "./tests",
  // The versioned site has its own config (playwright.versioned.config.ts).
  testIgnore: "versioned-site/**",
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // The playground sweep is heavy; more workers starve the landing animations.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${websitePort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The static export with the demo at /demo/, as GitHub Pages serves it;
    // the API playground needs the demo's bridge page.
    command: `bun ../scripts/build-pages-site.ts && bunx --bun serve out -l ${websitePort} --no-clipboard`,
    url: `http://127.0.0.1:${websitePort}`,
    // The footer's build-time download numbers come from a fixture, not the registries.
    env: {
      DOWNLOAD_ACTIVITY_SOURCES_FILE: fileURLToPath(
        new URL(
          "./tests/fixtures/download-activity-sources.json",
          import.meta.url,
        ),
      ),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});

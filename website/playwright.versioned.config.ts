import { defineConfig, devices } from "@playwright/test";

const versionedSitePort = 5193;
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");

// Tests the site `bun scripts/build-docs-versions.ts` wrote to out/, every docs version built
// from the git tags, served under the Pages base path as GitHub Pages serves it.
export default defineConfig({
  testDir: "./tests/versioned-site",
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${versionedSitePort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: [
      "rm -rf .versioned-site",
      `mkdir -p .versioned-site${pagesBasePath}`,
      `cp -R out/. .versioned-site${pagesBasePath}/`,
      `bun scripts/serve-static-site.ts .versioned-site ${versionedSitePort} ${pagesBasePath.replace(/^\//, "")}/404.html`,
    ].join(" && "),
    url: `http://127.0.0.1:${versionedSitePort}${pagesBasePath}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

const websitePort = 5192;

export default defineConfig({
  testDir: "./tests",
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${websitePort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The static export, as GitHub Pages serves it.
    command: `bun run build && bunx --bun serve out -l ${websitePort} --no-clipboard`,
    url: `http://127.0.0.1:${websitePort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

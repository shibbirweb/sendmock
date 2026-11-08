import { defineConfig, devices } from "@playwright/test";

const e2ePort = 5180;
const timingSpecs = /performance\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: timingSpecs,
    },
    {
      // Timing budgets run on their own with one worker (CI runs them after the shard), so
      // another test's work on the same runner cannot push them over.
      name: "timing",
      use: { ...devices["Desktop Chrome"] },
      testMatch: timingSpecs,
    },
  ],
  webServer: {
    // The production build, like the /demo/ site, so tests see what ships.
    command: `bun --bun vite build && bun --bun vite preview --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: `http://127.0.0.1:${e2ePort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

const livePort = 5181;
/** The binary to test; CI passes the one it built, locally a debug build works. */
const sendmockBinary =
  process.env.SENDMOCK_BINARY ?? "../target/debug/sendmock";

/**
 * The live UI against a real `sendmock` binary (UI-12.2): the binary serves the live
 * build from web/dist, so run `VITE_API_MODE=live bun run build` first.
 */
export default defineConfig({
  testDir: "./tests/live",
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${livePort}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `${sendmockBinary} --http-addr 127.0.0.1:${livePort} --smtp-addr 127.0.0.1:0 --db memory`,
    url: `http://127.0.0.1:${livePort}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

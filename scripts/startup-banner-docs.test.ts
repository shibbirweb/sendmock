import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const configurationPage = readFileSync("docs/wiki/configuration.md", "utf8");
const configurationFlagsPage = readFileSync("docs/wiki/reference/configuration-flags.md", "utf8");
const changelog = readFileSync("CHANGELOG.md", "utf8");

describe("Startup banner docs", () => {
  test("PL-23.7 the configuration page shows the banner and every way to turn it off", () => {
    for (const expectedText of [
      "## The startup banner",
      "```text\n⢀",
      "sendmock serve --no-banner",
      "SENDMOCK_NO_BANNER=1 sendmock serve",
      "banner = false",
      "`NO_COLOR`",
      "`--ready-json`",
    ]) {
      expect(configurationPage).toContain(expectedText);
    }
  });

  test("PL-23.7 the CLI reference lists --no-banner and the changelog says where to see the banner", () => {
    expect(configurationFlagsPage).toContain("| `--no-banner` | `SENDMOCK_NO_BANNER` |");
    expect(changelog).toContain("**Startup banner:**");
    expect(changelog).toContain("see the Configuration guide, The startup banner");
  });
});

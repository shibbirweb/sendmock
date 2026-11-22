import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const configurationPage = readFileSync("docs/wiki/configuration.md", "utf8");

describe("Launcher docs", () => {
  test("PL-22.7 the configuration page describes the launcher, --last and --no-input", () => {
    for (const expectedText of [
      "## Choose what starts: the launcher",
      "1. Tick the services with Space and press Enter.",
      "sendmock --last",
      "sendmock mcp --embedded --last",
      "sendmock --services smtp,catcher,pop3",
      "`--no-input` (`SENDMOCK_NO_INPUT=1`",
      "sendmock last-run clear",
    ]) {
      expect(configurationPage).toContain(expectedText);
    }
  });
});

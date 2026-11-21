import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const ciPage = readFileSync("docs/wiki/advanced/ci-pipelines.md", "utf8");
const skill = readFileSync("skill/sendmock/SKILL.md", "utf8");

describe("Webhook tests in CI docs", () => {
  test("WH-15.8 the page gives a copy-paste job for each CI system as numbered steps", () => {
    for (const ciSystem of [
      "### GitHub Actions",
      "### GitLab CI",
      "### CircleCI",
      "### Bitbucket Pipelines",
      "### Azure Pipelines",
      "### Jenkins",
      "### Buildkite",
    ]) {
      const section = ciPage.split(ciSystem)[1]?.split("\n### ")[0] ?? "";
      expect(section).toContain("1. ");
      expect(section).toContain("sendmock ci run sendmock.ci.yml --junit");
    }
    expect(ciPage).toContain("SENDMOCK_SETUP: https://");
  });

  test("WH-15.7 the skill has the ci-setup steps with the CI tools", () => {
    expect(skill).toContain("### ci-setup");
    for (const toolName of [
      "sendmock_ci_init",
      "sendmock_ci_validate",
      "sendmock_ci_run",
    ]) {
      expect(skill).toContain(toolName);
    }
  });
});

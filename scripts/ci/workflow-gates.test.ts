import { describe, expect, test } from "bun:test";

import {
  findGateProblems,
  listRequiredChecks,
  readPullRequestWorkflows,
} from "./workflow-gates";

describe("workflow gates", () => {
  test("every workflow a pull request starts ends with a gate that waits for all of its jobs", () => {
    const problems = readPullRequestWorkflows().flatMap((workflow) =>
      findGateProblems(workflow).map((problem) => `${workflow.fileName} ${problem}`),
    );

    expect(problems).toEqual([]);
  });

  test("the required checks are one gate per workflow, each name once", () => {
    const requiredChecks = listRequiredChecks();

    expect(requiredChecks).toContain("CI passed");
    expect(requiredChecks).toContain("Release build passed");
    expect(new Set(requiredChecks).size).toBe(requiredChecks.length);
  });

  test("a workflow without a gate or filtered by path is reported", () => {
    const problems = findGateProblems({
      fileName: "example.yml",
      name: "Example",
      pullRequestPaths: ["crates/**"],
      jobs: { build: {} },
    });

    expect(problems).toEqual([
      "filters pull requests by path, so its gate would not report on every one",
      'has no "passed" job',
    ]);
  });
});

describe("required rules", () => {
  test("the ruleset keeps its other rules and requires every gate and CodeQL", async () => {
    const { buildRequiredRules } = await import("./sync-required-checks");

    const rules = buildRequiredRules(
      [
        { type: "deletion" },
        { type: "required_status_checks", parameters: { required_status_checks: [] } },
      ],
      ["CI passed", "Website passed"],
    );

    expect(rules.map((rule) => rule.type)).toEqual([
      "deletion",
      "required_status_checks",
      "code_scanning",
    ]);
    expect(rules[1]?.parameters?.required_status_checks).toEqual([
      { context: "CI passed", integration_id: 15368 },
      { context: "Website passed", integration_id: 15368 },
    ]);
  });
});

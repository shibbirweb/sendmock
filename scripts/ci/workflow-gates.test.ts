import { describe, expect, test } from "bun:test";

import {
  findGateProblems,
  listGateChecks,
  readPullRequestWorkflows,
} from "./workflow-gates";

describe("workflow gates", () => {
  test("every workflow a pull request starts reports every job and ends with a gate that waits for all of them", () => {
    const problems = readPullRequestWorkflows().flatMap((workflow) =>
      findGateProblems(workflow).map((problem) => `${workflow.fileName} ${problem}`),
    );

    expect(problems).toEqual([]);
  });

  test("there is one gate per workflow, each name once", () => {
    const requiredChecks = listGateChecks();

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
  test("every passed check is required once, and skipped or unexpanded ones are not", async () => {
    const { selectRequiredChecks } = await import("./sync-required-checks");

    const requiredChecks = selectRequiredChecks([
      { name: "Web UI", conclusion: "success", app: { id: 15368 } },
      { name: "Web UI", conclusion: "success", app: { id: 15368 } },
      { name: "CodeQL", conclusion: "success", app: { id: 57789 } },
      { name: "Publish v1.4.0", conclusion: "skipped", app: { id: 15368 } },
      { name: "Image for ${{ matrix.platform }}", conclusion: "success", app: { id: 15368 } },
    ]);

    expect(requiredChecks).toEqual([
      { context: "CodeQL", integration_id: 57789 },
      { context: "Web UI", integration_id: 15368 },
    ]);
  });

  test("checks of workflows a normal pull request never starts are never required", async () => {
    const { readNeverStartedCheckPatterns, selectRequiredChecks } = await import(
      "./sync-required-checks"
    );

    const requiredChecks = selectRequiredChecks(
      [
        { name: "Web UI", conclusion: "success", app: { id: 15368 } },
        {
          name: "Delete the caches of the closed pull request",
          conclusion: "success",
          app: { id: 15368 },
        },
        { name: "Take the screenshots", conclusion: "success", app: { id: 15368 } },
      ],
      readNeverStartedCheckPatterns(),
    );

    expect(requiredChecks).toEqual([{ context: "Web UI", integration_id: 15368 }]);
  });

  test("the ruleset keeps its other rules and requires the checks and CodeQL", async () => {
    const { buildRequiredRules } = await import("./sync-required-checks");
    const requiredChecks = [{ context: "Web UI", integration_id: 15368 }];

    const rules = buildRequiredRules(
      [
        { type: "deletion" },
        { type: "required_status_checks", parameters: { required_status_checks: [] } },
      ],
      requiredChecks,
    );

    expect(rules.map((rule) => rule.type)).toEqual([
      "deletion",
      "required_status_checks",
      "code_scanning",
    ]);
    expect(rules[1]?.parameters?.required_status_checks).toEqual(requiredChecks);
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type CaseContext,
  findCaseProblems,
  pluginToolPrefix,
} from "./case-problems";
import { checkEndState, matchesFields, readAnswerItems } from "./end-state";
import { type EvalCase, listEvalCases, parseMarkdownFile } from "./eval-case";
import { isCasePassed, renderEvalReport } from "./eval-report";
import { findReadOperation, listReadOperations } from "./openapi-reads";
import {
  buildPluginEvalArguments,
  readPluginEvalResult,
} from "./plugin-eval-run";

const repositoryRoot = join(import.meta.dir, "../..");
const openApiYaml = readFileSync(
  join(repositoryRoot, "docs/api/openapi.yaml"),
  "utf8",
);
const readOperations = listReadOperations(openApiYaml);
const contractToolNames = [
  ...openApiYaml.matchAll(/x-sendmock-mcp: (sendmock_[a-z_]+)/g),
].map((toolMatch) => toolMatch[1] ?? "");
const caseContext: CaseContext = {
  mcpToolNames: contractToolNames,
  readOperations,
};

function buildCase(changes: Partial<EvalCase>): EvalCase {
  return {
    name: "sample",
    directory: "/plugin/evals/sample",
    prompt: parseMarkdownFile(
      "prompt.md",
      "---\nmax_turns: 10\n---\nRead the code.",
    ),
    graders: [
      parseMarkdownFile("code", "---\ntype: regex\npattern: '123456'\n---\n"),
    ],
    seedPath: null,
    setup: { before: [], checks: [] },
    ...changes,
  };
}

describe("skill eval cases", () => {
  const evalCases = listEvalCases(join(repositoryRoot, "plugin/evals"));

  test("AI-05.7 the skill has evals, each a task, graders and an outcome to check", () => {
    expect(evalCases.map((evalCase) => evalCase.name)).toEqual([
      "connect-laravel-mail",
      "inbound-sms-webhook",
      "otp-from-email",
      "otp-from-sms",
    ]);
    for (const evalCase of evalCases) {
      expect({
        name: evalCase.name,
        problems: findCaseProblems(evalCase, caseContext),
      }).toEqual({
        name: evalCase.name,
        problems: [],
      });
    }
  });

  test("AI-05.7 a case that changes configuration starts from a seed and checks the end state through the API", () => {
    const webhookCase = evalCases.find(
      (evalCase) => evalCase.name === "inbound-sms-webhook",
    );

    expect(webhookCase?.seedPath).toEndWith("seed.toml");
    expect(webhookCase?.setup.checks.map((check) => check.path)).toEqual([
      "/api/v1/webhooks/endpoints",
      "/api/v1/webhooks/rules",
    ]);
  });

  test("AI-05.7 names a missing prompt, unknown grader types, tools, reads and fields", () => {
    const brokenCase = buildCase({
      prompt: parseMarkdownFile("prompt.md", "---\nturns: 3\n---\n"),
      graders: [
        parseMarkdownFile("odd", "---\ntype: script\n---\n"),
        parseMarkdownFile(
          "tool",
          `---\ntype: tool_used\ntool: ${pluginToolPrefix}sendmock_teleport\n---\n`,
        ),
      ],
      setup: {
        before: [],
        checks: [
          { path: "/api/v1/nowhere", fields: {} },
          { path: "/api/v1/webhooks/rules", fields: { colour: "blue" } },
        ],
      },
    });

    expect(findCaseProblems(brokenCase, caseContext)).toEqual([
      "prompt.md has no prompt",
      "prompt.md has an unknown field turns",
      "grader odd has an unknown type script",
      "grader tool names sendmock_teleport, which the MCP server does not list",
      "check /api/v1/nowhere is not a GET operation in the API contract",
      "check /api/v1/webhooks/rules names an unknown field colour",
    ]);
  });

  test("AI-05.7 a case nothing checks the outcome of is refused", () => {
    const uncheckedCase = buildCase({
      graders: [
        parseMarkdownFile("skill", "---\ntype: tool_used\ntool: Skill\n---\n"),
      ],
    });

    expect(findCaseProblems(uncheckedCase, caseContext)).toEqual([
      "nothing checks the outcome: add an end-state check or a regex or llm grader",
    ]);
  });
});

describe("end state", () => {
  test("AI-05.7 reads the fields of list items, page items and single answers", () => {
    expect(
      findReadOperation(readOperations, "/api/v1/webhooks/rules")?.itemFields,
    ).toContain("events");
    expect(
      findReadOperation(readOperations, "/api/v1/emails?to=sam@example.test")
        ?.itemFields,
    ).toContain("subject");
    expect(readAnswerItems([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(readAnswerItems({ items: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(readAnswerItems({ id: 3 })).toEqual([{ id: 3 }]);
  });

  test("AI-05.7 an expected list is contained, other values are equal", () => {
    const rule = { events: ["sms.inbound", "sms.sent"], is_enabled: true };

    expect(
      matchesFields(rule, { events: ["sms.inbound"], is_enabled: true }),
    ).toBe(true);
    expect(matchesFields(rule, { events: ["email.received"] })).toBe(false);
    expect(matchesFields(rule, { is_enabled: false })).toBe(false);
  });

  test("AI-05.7 checks each read and says which item was missing", async () => {
    const results = await checkEndState(
      [
        { path: "/api/v1/webhooks/rules", fields: { events: ["sms.inbound"] } },
        {
          path: "/api/v1/webhooks/endpoints",
          fields: { url: "http://127.0.0.1:4000/sms" },
        },
      ],
      async (path) =>
        path.endsWith("rules") ? [{ events: ["sms.inbound"] }] : [],
    );

    expect(results.map((result) => result.isPassed)).toEqual([true, false]);
    expect(results[1]?.detail).toContain("(0 read)");
  });
});

describe("claude plugin eval run", () => {
  const evalCase = buildCase({});

  test("AI-05.7 runs one case once, with the real MCP server and only SendMock's tools granted", () => {
    const pluginEvalArguments = buildPluginEvalArguments(evalCase, {
      outputDirectory: "/results/sample",
      model: "claude-sonnet-5-5",
      judgeModel: null,
    });

    expect(pluginEvalArguments.slice(0, 3)).toEqual([
      "plugin",
      "eval",
      "/plugin/evals/sample/prompt.md",
    ]);
    expect(pluginEvalArguments.join(" ")).toContain(
      "--runs 1 --ablation none --mocks off --trust-plugin",
    );
    expect(pluginEvalArguments.join(" ")).toContain(
      "--model claude-sonnet-5-5",
    );
    expect(pluginEvalArguments.slice(-2)).toEqual([
      "--allow-tools",
      `${pluginToolPrefix}*`,
    ]);
  });

  test("AI-05.7 reads the score, the run's error and the graders from the JSON result", () => {
    const pluginEval = readPluginEvalResult(
      JSON.stringify({
        schemaVersion: 1,
        cases: [
          {
            name: "sample",
            aggregates: { score: 0.5 },
            arms: {
              with: [
                {
                  error: null,
                  graders: [
                    { name: "code", passed: true, explanation: "matched" },
                    { name: "skill", passed: false },
                  ],
                },
              ],
            },
          },
        ],
      }),
    );

    expect(pluginEval).toEqual({
      score: 0.5,
      runError: null,
      graderVerdicts: [
        { name: "code", isPassed: true, explanation: "matched" },
        { name: "skill", isPassed: false, explanation: "" },
      ],
    });
  });

  test("AI-05.7 a case passes only with its score, no errors and every end-state check", () => {
    const passedOutcome = {
      caseName: "sample",
      pluginEval: { score: 1, runError: null, graderVerdicts: [] },
      endState: [],
      setupError: null,
    };
    const failedOutcome = {
      ...passedOutcome,
      endState: [
        {
          check: { path: "/api/v1/webhooks/rules", fields: {} },
          isPassed: false,
          detail: "no item",
        },
      ],
    };

    expect(isCasePassed(passedOutcome, 1)).toBe(true);
    expect(isCasePassed(failedOutcome, 1)).toBe(false);
    expect(
      isCasePassed(
        {
          ...passedOutcome,
          pluginEval: { ...passedOutcome.pluginEval, score: 0.8 },
        },
        0.8,
      ),
    ).toBe(true);
    expect(renderEvalReport([passedOutcome, failedOutcome], 1)).toContain(
      "1 of 2 cases passed",
    );
  });
});

describe("Skill evals workflow", () => {
  type WorkflowJob = {
    needs?: string[] | string;
    uses?: string;
    steps?: { if?: string; run?: string }[];
  };
  function readWorkflowJobs(fileName: string) {
    const workflow = Bun.YAML.parse(
      readFileSync(join(repositoryRoot, ".github/workflows", fileName), "utf8"),
    ) as { on: Record<string, unknown>; jobs: Record<string, WorkflowJob> };
    return workflow;
  }

  test("AI-05.7 runs the cases with Claude Code on demand, only when the API key is set", () => {
    const workflow = readWorkflowJobs("skill-evals.yml");
    const evalSteps = workflow.jobs.evals?.steps ?? [];
    const runStep = evalSteps.find((step) =>
      step.run?.includes("scripts/skill-evals.ts run"),
    );

    expect(Object.keys(workflow.on)).toEqual([
      "workflow_dispatch",
      "workflow_call",
    ]);
    expect(runStep?.if).toBe("env.HAS_ANTHROPIC_API_KEY == 'true'");
    expect(runStep?.run).toContain("target/release/sendmock");
  });

  test("AI-05.7 a stable is released only after the evals and CI checks every case is well formed", () => {
    const stableJobs = readWorkflowJobs("stable-publish.yml").jobs;
    const ciSteps =
      readWorkflowJobs("ci.yml").jobs["claude-plugin"]?.steps ?? [];

    expect(stableJobs["skill-evals"]?.uses).toBe(
      "./.github/workflows/skill-evals.yml",
    );
    expect(stableJobs.release?.needs).toContain("skill-evals");
    expect(ciSteps.map((step) => step.run ?? "")).toContain(
      "bun scripts/skill-evals.ts check sendmock-binary/sendmock",
    );
  });
});

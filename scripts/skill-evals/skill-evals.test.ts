import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type CaseContext,
  findCaseProblems,
  pluginToolPrefix,
} from "./case-problems";
import { checkEndState, matchesFields, readAnswerItems } from "./end-state";
import { type EvalCase, listEvalCases, parseMarkdownFile } from "./eval-case";
import { isCasePassed, renderEvalReport } from "./eval-report";
import { gradeTranscript } from "./grade-transcript";
import { findReadOperation, listReadOperations } from "./openapi-reads";
import {
  resolveCallInput,
  runScriptedAgent,
  type Transcript,
} from "./scripted-agent";

const repositoryRoot = join(import.meta.dir, "../..");
const openApiYaml = readFileSync(
  join(repositoryRoot, "docs/api/openapi.yaml"),
  "utf8",
);
const readOperations = listReadOperations(openApiYaml);
const contractToolNames = [
  ...openApiYaml.matchAll(/x-sendmock-mcp: (sendmock_[a-z_]+)/g),
].map((toolMatch) => toolMatch[1] ?? "");
const skillText = readFileSync(
  join(repositoryRoot, "plugin/skills/sendmock/SKILL.md"),
  "utf8",
);
const caseContext: CaseContext = {
  mcpToolNames: contractToolNames,
  readOperations,
  skillText,
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
    scriptedCalls: [{ tool: "Skill", input: { skill: "sendmock" } }],
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
      scriptedCalls: [
        { tool: "Read", input: {} },
        { tool: `${pluginToolPrefix}sendmock_teleport`, input: {} },
      ],
    });

    expect(findCaseProblems(brokenCase, caseContext)).toEqual([
      "prompt.md has no prompt",
      "prompt.md has an unknown field turns",
      "grader odd has the type script; the scripted run grades only regex, tool_used and tool_order",
      "grader tool names sendmock_teleport, which the MCP server does not list",
      "check /api/v1/nowhere is not a GET operation in the API contract",
      "check /api/v1/webhooks/rules names an unknown field colour",
      "scripted call 1 calls Read; a scripted run calls only Skill and SendMock's MCP tools",
      "scripted call 2 calls sendmock_teleport, which the MCP server does not list",
    ]);
  });

  test("AI-05.7 a case needs a scripted run whose tools the skill names, and no model-judged graders", () => {
    const unscriptedCase = buildCase({ scriptedCalls: null });
    const unnamedToolCase = buildCase({
      scriptedCalls: [
        { tool: `${pluginToolPrefix}sendmock_otp_get`, input: {} },
      ],
    });
    const judgedCase = buildCase({
      graders: [
        parseMarkdownFile("judge", "---\ntype: llm\n---\nThe reply is polite."),
      ],
    });

    expect(findCaseProblems(unscriptedCase, caseContext)).toEqual([
      "the case has no scripted-run.json",
    ]);
    expect(
      findCaseProblems(unnamedToolCase, { ...caseContext, skillText: "" }),
    ).toEqual([
      "scripted call 1 calls sendmock_otp_get, which the skill does not name",
    ]);
    expect(findCaseProblems(judgedCase, caseContext)).toContain(
      "grader judge has the type llm; the scripted run grades only regex, tool_used and tool_order",
    );
  });

  test("AI-05.7 a case nothing checks the outcome of is refused", () => {
    const uncheckedCase = buildCase({
      graders: [
        parseMarkdownFile("skill", "---\ntype: tool_used\ntool: Skill\n---\n"),
      ],
    });

    expect(findCaseProblems(uncheckedCase, caseContext)).toEqual([
      "nothing checks the outcome: add an end-state check or a regex grader",
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

describe("scripted agent", () => {
  const otpTool = `${pluginToolPrefix}sendmock_otp_get`;
  const endpointTool = `${pluginToolPrefix}sendmock_webhook_endpoint_create`;
  const ruleTool = `${pluginToolPrefix}sendmock_webhook_rule_create`;

  test("AI-05.7 fills an earlier answer into a later call's input", () => {
    expect(
      resolveCallInput(
        { endpoint_id: "{{results.2.id}}", events: ["sms.inbound"] },
        ["skill text", { id: "ep_1" }],
      ),
    ).toEqual({ endpoint_id: "ep_1", events: ["sms.inbound"] });
  });

  test("AI-05.7 replays the calls in order through the MCP server and replies with its answers", async () => {
    const mcpCalls: { toolName: string; toolInput: unknown }[] = [];
    const transcript = await runScriptedAgent(
      [
        { tool: "Skill", input: { skill: "sendmock" } },
        { tool: endpointTool, input: { url: "http://127.0.0.1:4000" } },
        { tool: ruleTool, input: { endpoint_id: "{{results.2.id}}" } },
      ],
      {
        readSkill: () => "the skill",
        callMcpTool: async (toolName, toolInput) => {
          mcpCalls.push({ toolName, toolInput });
          return { text: JSON.stringify({ id: `id_${mcpCalls.length}` }), isError: false };
        },
      },
    );

    expect(mcpCalls).toEqual([
      {
        toolName: "sendmock_webhook_endpoint_create",
        toolInput: { url: "http://127.0.0.1:4000" },
      },
      {
        toolName: "sendmock_webhook_rule_create",
        toolInput: { endpoint_id: "id_1" },
      },
    ]);
    expect(transcript.runError).toBeNull();
    expect(transcript.toolCalls.map((toolCall) => toolCall.tool)).toEqual([
      "Skill",
      endpointTool,
      ruleTool,
    ]);
    expect(transcript.lastMessage).toBe('{"id":"id_1"}\n{"id":"id_2"}');
  });

  test("AI-05.7 stops at an unknown skill or a tool that answers an error", async () => {
    const answerError = {
      readSkill: () => "the skill",
      callMcpTool: async () => ({ text: "no email to sam", isError: true }),
    };

    const unknownSkill = await runScriptedAgent(
      [{ tool: "Skill", input: { skill: "pdf" } }],
      answerError,
    );
    const failedTool = await runScriptedAgent(
      [
        { tool: otpTool, input: { to: "sam@example.test" } },
        { tool: otpTool, input: { to: "sam@example.test" } },
      ],
      answerError,
    );

    expect(unknownSkill.runError).toBe("call 1 (Skill) loads an unknown skill pdf");
    expect(failedTool.runError).toBe(
      `call 1 (${otpTool}) answered an error: no email to sam`,
    );
    expect(failedTool.toolCalls).toHaveLength(1);
  });

  test("AI-05.7 grades tool_used, regex and tool_order with their weights", () => {
    const transcript: Transcript = {
      toolCalls: [
        { tool: "Skill", input: { skill: "sendmock" } },
        { tool: otpTool, input: { to: "sam@example.test" } },
      ],
      lastMessage: '{"code":"482913"}',
      runError: null,
    };
    const graders = [
      parseMarkdownFile(
        "skill-fired",
        "---\ntype: tool_used\ntool: Skill\ninput_match: '\"skill\"\\s*:\\s*\"sendmock\"'\n---\n",
      ),
      parseMarkdownFile("answers-the-code", "---\ntype: regex\ntarget: last_message\npattern: '482913'\nweight: 2\n---\n"),
      parseMarkdownFile(
        "otp-before-skill",
        `---\ntype: tool_order\nbefore: ${otpTool}\nafter: Skill\n---\n`,
      ),
    ];

    const result = gradeTranscript(graders, transcript);

    expect(result.graderVerdicts.map((verdict) => verdict.isPassed)).toEqual([
      true,
      true,
      false,
    ]);
    expect(result.score).toBe(0.75);
    expect(
      gradeTranscript(graders, { ...transcript, runError: "call 2 failed" }).score,
    ).toBe(0);
  });

  test("AI-05.7 a case passes only with its score, no errors and every end-state check", () => {
    const passedOutcome = {
      caseName: "sample",
      scriptedRun: { score: 1, runError: null, graderVerdicts: [] },
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
          scriptedRun: { ...passedOutcome.scriptedRun, score: 0.8 },
        },
        0.8,
      ),
    ).toBe(true);
    expect(renderEvalReport([passedOutcome, failedOutcome], 1)).toContain(
      "1 of 2 cases passed",
    );
  });
});

describe("Skill evals in CI", () => {
  const workflowsDirectory = join(repositoryRoot, ".github/workflows");

  test("AI-05.7 CI checks and runs every case with the scripted agent against the binary it built", () => {
    const ciWorkflow = Bun.YAML.parse(
      readFileSync(join(workflowsDirectory, "ci.yml"), "utf8"),
    ) as { jobs: Record<string, { steps?: { run?: string }[] }> };
    const ciCommands = (ciWorkflow.jobs["claude-plugin"]?.steps ?? []).map(
      (step) => step.run ?? "",
    );

    expect(ciCommands).toContain(
      "bun scripts/skill-evals.ts check sendmock-binary/sendmock",
    );
    expect(ciCommands).toContain(
      "bun scripts/skill-evals.ts run sendmock-binary/sendmock",
    );
  });

  test("AI-05.7 no workflow runs a model: no Skill evals workflow and no Anthropic API key", () => {
    const workflowTexts = readdirSync(workflowsDirectory).map((fileName) =>
      readFileSync(join(workflowsDirectory, fileName), "utf8"),
    );

    expect(existsSync(join(workflowsDirectory, "skill-evals.yml"))).toBe(false);
    expect(
      workflowTexts.some((workflowText) =>
        workflowText.includes("ANTHROPIC_API_KEY"),
      ),
    ).toBe(false);
  });
});

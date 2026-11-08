import type { EvalCase, MarkdownFile } from "./eval-case";
import { deterministicGraderTypes } from "./grade-transcript";
import { findReadOperation, type ReadOperation } from "./openapi-reads";

/** How Claude Code names the tools of the plugin's `sendmock` MCP server. */
export const pluginToolPrefix = "mcp__plugin_sendmock_sendmock__";

const promptFields = new Set([
  "description",
  "tags",
  "plugins",
  "runs",
  "expected_outcome",
  "model",
  "max_turns",
  "timeout_seconds",
  "allowed_tools",
  "append_system_prompt",
  "env",
]);
const builtInTools = new Set(["Skill", "Read", "Glob", "Grep", "TodoWrite"]);

export type CaseContext = {
  mcpToolNames: string[];
  readOperations: ReadOperation[];
  /** The plugin's SKILL.md: a scripted call must use a tool the skill tells the agent about. */
  skillText: string;
};

function findToolProblem(
  toolName: unknown,
  context: CaseContext,
): string | null {
  if (typeof toolName !== "string") {
    return `names no tool (${JSON.stringify(toolName)})`;
  }
  if (toolName.startsWith(pluginToolPrefix)) {
    const mcpToolName = toolName.slice(pluginToolPrefix.length);
    return context.mcpToolNames.includes(mcpToolName)
      ? null
      : `names ${mcpToolName}, which the MCP server does not list`;
  }
  return builtInTools.has(toolName)
    ? null
    : `names an unknown tool ${toolName}`;
}

function listGraderTools(grader: MarkdownFile): unknown[] {
  const { type, tool, before, after } = grader.frontmatter;
  if (type === "tool_used") {
    return [tool];
  }
  if (type === "tool_order") {
    return [before, after].map((step) =>
      typeof step === "object" && step !== null
        ? (step as { tool?: unknown }).tool
        : step,
    );
  }
  return [];
}

function findGraderProblems(
  grader: MarkdownFile,
  context: CaseContext,
): string[] {
  const graderType = grader.frontmatter.type;
  if (typeof graderType !== "string" || !deterministicGraderTypes.has(graderType)) {
    return [
      `grader ${grader.name} has the type ${String(graderType)}; the scripted run grades only regex, tool_used and tool_order`,
    ];
  }
  return listGraderTools(grader).flatMap((toolName) => {
    const toolProblem = findToolProblem(toolName, context);
    return toolProblem === null ? [] : [`grader ${grader.name} ${toolProblem}`];
  });
}

function findScriptedCallProblem(
  toolName: string,
  context: CaseContext,
): string | null {
  if (toolName === "Skill") {
    return null;
  }
  if (!toolName.startsWith(pluginToolPrefix)) {
    return `calls ${toolName}; a scripted run calls only Skill and SendMock's MCP tools`;
  }
  const mcpToolName = toolName.slice(pluginToolPrefix.length);
  if (!context.mcpToolNames.includes(mcpToolName)) {
    return `calls ${mcpToolName}, which the MCP server does not list`;
  }
  return context.skillText.includes(mcpToolName)
    ? null
    : `calls ${mcpToolName}, which the skill does not name`;
}

function findScriptedRunProblems(
  evalCase: EvalCase,
  context: CaseContext,
): string[] {
  if (evalCase.scriptedCalls === null) {
    return ["the case has no scripted-run.json"];
  }
  if (evalCase.scriptedCalls.length === 0) {
    return ["the scripted run makes no calls"];
  }
  return evalCase.scriptedCalls.flatMap((scriptedCall, callIndex) => {
    const callProblem = findScriptedCallProblem(String(scriptedCall.tool), context);
    return callProblem === null
      ? []
      : [`scripted call ${callIndex + 1} ${callProblem}`];
  });
}

function findCheckProblems(evalCase: EvalCase, context: CaseContext): string[] {
  return evalCase.setup.checks.flatMap((check) => {
    const readOperation = findReadOperation(context.readOperations, check.path);
    if (readOperation === undefined) {
      return [`check ${check.path} is not a GET operation in the API contract`];
    }
    return Object.keys(check.fields)
      .filter((fieldName) => !readOperation.itemFields.has(fieldName))
      .map(
        (fieldName) =>
          `check ${check.path} names an unknown field ${fieldName}`,
      );
  });
}

/** What makes a case unable to run or unable to fail, before it is run (AI-05.7). */
export function findCaseProblems(
  evalCase: EvalCase,
  context: CaseContext,
): string[] {
  const unknownFields = Object.keys(evalCase.prompt.frontmatter).filter(
    (fieldName) => !promptFields.has(fieldName),
  );
  const checksTheOutcome =
    evalCase.setup.checks.length > 0 ||
    evalCase.graders.some((grader) => grader.frontmatter.type === "regex");
  return [
    ...(evalCase.prompt.body === "" ? ["prompt.md has no prompt"] : []),
    ...unknownFields.map(
      (fieldName) => `prompt.md has an unknown field ${fieldName}`,
    ),
    ...(evalCase.graders.length === 0 ? ["the case has no graders"] : []),
    ...(checksTheOutcome
      ? []
      : [
          "nothing checks the outcome: add an end-state check or a regex grader",
        ]),
    ...evalCase.graders.flatMap((grader) =>
      findGraderProblems(grader, context),
    ),
    ...findCheckProblems(evalCase, context),
    ...findScriptedRunProblems(evalCase, context),
  ];
}

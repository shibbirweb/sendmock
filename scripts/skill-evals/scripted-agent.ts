import { pluginToolPrefix } from "./case-problems";
import type { McpToolAnswer } from "./mcp-session";

/** One tool call of a case's `scripted-run.json`, named as Claude Code names it. */
export type ScriptedToolCall = { tool: string; input: unknown };

/** What a run did, in the shape the graders read: the calls in order and the final reply. */
export type Transcript = {
  toolCalls: ScriptedToolCall[];
  lastMessage: string;
  runError: string | null;
};

export type ScriptedAgentTools = {
  readSkill: (skillName: string) => string | null;
  callMcpTool: (toolName: string, toolInput: unknown) => Promise<McpToolAnswer>;
};

/** `sendmock` or a plugin-qualified `sendmock:sendmock`, as the skill-fired graders accept. */
const skillNamePattern = /^(?:[\w-]+:)?sendmock$/;
/** `{{results.2.id}}`: the `id` field of the second call's answer. */
const resultReferencePattern = /^\{\{results\.(\d+)\.([\w.]+)\}\}$/;

function readField(answer: unknown, fieldPath: string): unknown {
  return fieldPath
    .split(".")
    .reduce<unknown>(
      (value, fieldName) =>
        (value as Record<string, unknown> | null)?.[fieldName] ?? null,
      answer,
    );
}

/** The input with each `{{results.<call number>.<field>}}` replaced by that earlier answer's value. */
export function resolveCallInput(
  callInput: unknown,
  earlierAnswers: unknown[],
): unknown {
  if (typeof callInput === "string") {
    const referenceMatch = resultReferencePattern.exec(callInput);
    if (referenceMatch === null) {
      return callInput;
    }
    const answer = earlierAnswers[Number(referenceMatch[1]) - 1];
    return readField(answer, referenceMatch[2] ?? "");
  }
  if (Array.isArray(callInput)) {
    return callInput.map((entry) => resolveCallInput(entry, earlierAnswers));
  }
  if (typeof callInput === "object" && callInput !== null) {
    return Object.fromEntries(
      Object.entries(callInput).map(([fieldName, value]) => [
        fieldName,
        resolveCallInput(value, earlierAnswers),
      ]),
    );
  }
  return callInput;
}

function parseAnswer(answerText: string): unknown {
  try {
    return JSON.parse(answerText);
  } catch {
    return answerText;
  }
}

/**
 * Replays a case's tool calls in place of a model (owner decision: no model calls in tests).
 * The reply is only what the MCP tools answered, so a grader looking for a code still needs
 * SendMock to have answered it.
 */
export async function runScriptedAgent(
  scriptedCalls: ScriptedToolCall[],
  tools: ScriptedAgentTools,
): Promise<Transcript> {
  const transcript: Transcript = { toolCalls: [], lastMessage: "", runError: null };
  const answers: unknown[] = [];
  const replyParts: string[] = [];
  for (const [callIndex, scriptedCall] of scriptedCalls.entries()) {
    const callInput = resolveCallInput(scriptedCall.input, answers);
    transcript.toolCalls.push({ tool: scriptedCall.tool, input: callInput });
    const callProblem = await runOneCall(scriptedCall.tool, callInput, tools, answers, replyParts);
    if (callProblem !== null) {
      transcript.runError = `call ${callIndex + 1} (${scriptedCall.tool}) ${callProblem}`;
      break;
    }
  }
  transcript.lastMessage = replyParts.join("\n");
  return transcript;
}

/** Runs one call, keeping its answer; answers what went wrong, or null. */
async function runOneCall(
  toolName: string,
  callInput: unknown,
  tools: ScriptedAgentTools,
  answers: unknown[],
  replyParts: string[],
): Promise<string | null> {
  if (toolName === "Skill") {
    const skillName = String((callInput as { skill?: unknown } | null)?.skill ?? "");
    const skillText = skillNamePattern.test(skillName) ? tools.readSkill("sendmock") : null;
    answers.push(skillText);
    return skillText === null ? `loads an unknown skill ${skillName}` : null;
  }
  if (!toolName.startsWith(pluginToolPrefix)) {
    answers.push(null);
    return "is not the Skill tool or one of SendMock's MCP tools";
  }
  const toolAnswer = await tools.callMcpTool(toolName.slice(pluginToolPrefix.length), callInput);
  answers.push(parseAnswer(toolAnswer.text));
  replyParts.push(toolAnswer.text);
  return toolAnswer.isError ? `answered an error: ${toolAnswer.text}` : null;
}

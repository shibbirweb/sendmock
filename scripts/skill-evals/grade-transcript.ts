import type { MarkdownFile } from "./eval-case";
import type { Transcript } from "./scripted-agent";

export type GraderVerdict = {
  name: string;
  isPassed: boolean;
  explanation: string;
};

/** A scripted run, graded: the weighted share of graders passed, and why any failed. */
export type ScriptedRunResult = {
  score: number | null;
  runError: string | null;
  graderVerdicts: GraderVerdict[];
};

/** The grader types the script grades; the others need a model to judge. */
export const deterministicGraderTypes = new Set([
  "regex",
  "tool_used",
  "tool_order",
]);

function readToolName(orderStep: unknown): string {
  if (typeof orderStep === "object" && orderStep !== null) {
    return String((orderStep as { tool?: unknown }).tool ?? "");
  }
  return String(orderStep ?? "");
}

function findFirstCallIndex(transcript: Transcript, toolName: string): number {
  return transcript.toolCalls.findIndex(
    (toolCall) => toolCall.tool === toolName,
  );
}

function gradeToolUsed(grader: MarkdownFile, transcript: Transcript): boolean {
  const { tool, input_match: inputMatch } = grader.frontmatter;
  const inputPattern =
    typeof inputMatch === "string" ? new RegExp(inputMatch) : null;
  return transcript.toolCalls.some(
    (toolCall) =>
      toolCall.tool === tool &&
      (inputPattern === null ||
        inputPattern.test(JSON.stringify(toolCall.input))),
  );
}

function gradeToolOrder(grader: MarkdownFile, transcript: Transcript): boolean {
  const beforeIndex = findFirstCallIndex(
    transcript,
    readToolName(grader.frontmatter.before),
  );
  const afterIndex = findFirstCallIndex(
    transcript,
    readToolName(grader.frontmatter.after),
  );
  return beforeIndex >= 0 && afterIndex > beforeIndex;
}

function gradeRegex(grader: MarkdownFile, transcript: Transcript): boolean {
  return new RegExp(String(grader.frontmatter.pattern ?? "")).test(
    transcript.lastMessage,
  );
}

export function gradeOne(
  grader: MarkdownFile,
  transcript: Transcript,
): GraderVerdict {
  const graderType = String(grader.frontmatter.type);
  const graders: Record<string, (grader: MarkdownFile, transcript: Transcript) => boolean> = {
    regex: gradeRegex,
    tool_used: gradeToolUsed,
    tool_order: gradeToolOrder,
  };
  const gradeByType = graders[graderType];
  if (gradeByType === undefined) {
    return {
      name: grader.name,
      isPassed: false,
      explanation: `a ${graderType} grader needs a model, which the scripted run does not use`,
    };
  }
  const isPassed = gradeByType(grader, transcript);
  return {
    name: grader.name,
    isPassed,
    explanation: isPassed ? "" : `the run does not satisfy this ${graderType} grader`,
  };
}

function readWeight(grader: MarkdownFile): number {
  const weight = Number(grader.frontmatter.weight ?? 1);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

/** Each grader's verdict and the weighted score; a run that stopped on an error scores 0. */
export function gradeTranscript(
  graders: MarkdownFile[],
  transcript: Transcript,
): ScriptedRunResult {
  const graderVerdicts = graders.map((grader) => gradeOne(grader, transcript));
  const totalWeight = graders.reduce(
    (weightSum, grader) => weightSum + readWeight(grader),
    0,
  );
  const passedWeight = graders.reduce(
    (weightSum, grader, graderIndex) =>
      weightSum +
      (graderVerdicts[graderIndex]?.isPassed === true ? readWeight(grader) : 0),
    0,
  );
  const score =
    transcript.runError !== null || totalWeight === 0
      ? 0
      : passedWeight / totalWeight;
  return { score, runError: transcript.runError, graderVerdicts };
}

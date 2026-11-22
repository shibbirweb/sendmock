import { stringify as stringifyToml } from "smol-toml";

import type { CiReport, CiValidation } from "@/lib/api/types";
import { runScenario } from "@/mocks/automation/run-scenario";
import {
  buildJunitReport,
  buildSummaryMarkdown,
} from "@/mocks/automation/ci-reports";

type InlineScenario = { name: string; steps: Record<string, unknown>[] };

/** The CI file's inline scenarios, or its problems; the demo reads JSON only. */
function readCiFile(
  ciText: string,
):
  | { scenarios: InlineScenario[]; appUrl: string | null }
  | { problems: string[] } {
  let ciDocument: Record<string, unknown>;
  try {
    ciDocument = JSON.parse(ciText) as Record<string, unknown>;
  } catch {
    return {
      problems: [
        "The demo reads JSON CI files; YAML works with a running SendMock.",
      ],
    };
  }
  const header = ciDocument.sendmock as Record<string, unknown> | undefined;
  if (header?.format !== "sendmock.ci") {
    return {
      problems: [
        "Start the file with sendmock: { format: sendmock.ci, format_version: 1 }",
      ],
    };
  }
  const scenarios =
    (ciDocument.scenarios as Record<string, unknown>[] | undefined) ?? [];
  if (scenarios.length === 0) {
    return { problems: ["Add at least one scenario."] };
  }
  const notInline = scenarios.find(
    (scenario) => !Array.isArray(scenario.steps),
  );
  if (notInline !== undefined) {
    return {
      problems: [
        "The demo runs scenarios written inline; files and URLs work with a running SendMock.",
      ],
    };
  }

  return {
    scenarios: scenarios as InlineScenario[],
    appUrl: typeof ciDocument.app_url === "string" ? ciDocument.app_url : null,
  };
}

export function validateCiFile(ciText: string): CiValidation {
  const ciFile = readCiFile(ciText);
  return "problems" in ciFile
    ? { is_valid: false, scenario_count: 0, problems: ciFile.problems }
    : { is_valid: true, scenario_count: ciFile.scenarios.length, problems: [] };
}

/** Runs each inline scenario through the mock's scenario runner, with `app_url` set. */
export async function runCiFile(
  ciText: string,
): Promise<CiReport | { problems: string[] }> {
  const ciFile = readCiFile(ciText);
  if ("problems" in ciFile) {
    return ciFile;
  }
  const startedAtMs = Date.now();
  const scenarioReports = [];
  for (const scenario of ciFile.scenarios) {
    const scenarioOutcome = await runScenario(
      stringifyToml({ name: scenario.name, steps: scenario.steps }),
      ciFile.appUrl === null ? {} : { app_url: ciFile.appUrl },
    );
    if ("problems" in scenarioOutcome) {
      return {
        problems: scenarioOutcome.problems.map(
          (problem) => `${scenario.name}: ${problem}`,
        ),
      };
    }
    scenarioReports.push(scenarioOutcome);
  }
  const durationMs = Date.now() - startedAtMs;
  const passedCount = scenarioReports.filter(
    (report) => report.is_passed,
  ).length;

  return {
    is_passed: passedCount === scenarioReports.length,
    started_at: new Date(startedAtMs).toISOString(),
    duration_ms: durationMs,
    passed_count: passedCount,
    failed_count: scenarioReports.length - passedCount,
    scenarios: scenarioReports,
    junit_xml: buildJunitReport(scenarioReports, durationMs),
    summary_markdown: buildSummaryMarkdown(scenarioReports),
  };
}

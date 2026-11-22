import type { ScenarioReport } from "@/lib/api/types";

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toSeconds(durationMs: number): string {
  return (durationMs / 1000).toFixed(3);
}

/** A test suite per scenario and a test case per step, as the server writes it (WH-15.3). */
export function buildJunitReport(
  scenarioReports: ScenarioReport[],
  durationMs: number,
): string {
  const allSteps = scenarioReports.flatMap((report) => report.steps);
  const failureCount = allSteps.filter(
    (step) => step.status === "failed",
  ).length;
  const suites = scenarioReports.map((report) => {
    const name = escapeXml(report.name);
    const cases = report.steps.map((step) => {
      const caseStart = `    <testcase classname="${name}" name="${escapeXml(`${step.step}. ${step.run}`)}" time="${toSeconds(step.duration_ms)}"`;
      const reason = escapeXml(step.error ?? "");
      if (step.status === "failed") {
        return `${caseStart}>\n      <failure message="${reason}">${reason}</failure>\n    </testcase>`;
      }
      if (step.status === "skipped") {
        return `${caseStart}>\n      <skipped message="${reason}"/>\n    </testcase>`;
      }
      return `${caseStart}/>`;
    });
    const failed = report.steps.filter(
      (step) => step.status === "failed",
    ).length;
    const skipped = report.steps.filter(
      (step) => step.status === "skipped",
    ).length;
    return [
      `  <testsuite name="${name}" tests="${report.steps.length}" failures="${failed}" skipped="${skipped}" time="${toSeconds(report.duration_ms)}" timestamp="${escapeXml(report.started_at)}">`,
      ...cases,
      "  </testsuite>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="sendmock" tests="${allSteps.length}" failures="${failureCount}" time="${toSeconds(durationMs)}">`,
    ...suites,
    "</testsuites>",
    "",
  ].join("\n");
}

/** The heading with the count, then each scenario's steps as a table. */
export function buildSummaryMarkdown(
  scenarioReports: ScenarioReport[],
): string {
  const passedCount = scenarioReports.filter(
    (report) => report.is_passed,
  ).length;
  const sections = scenarioReports.map((report) => {
    const rows = report.steps.map(
      (step) =>
        `| ${step.step} | \`${step.run}\` | ${step.status} | ${(step.error ?? "").replaceAll("|", "\\|")} |`,
    );
    return [
      `\n### ${report.name} (${report.is_passed ? "passed" : "failed"})\n`,
      "| Step | Operation | Outcome | Reason |",
      "| --- | --- | --- | --- |",
      ...rows,
    ].join("\n");
  });

  return `## SendMock: ${passedCount} of ${scenarioReports.length} scenarios passed\n${sections.join("\n")}\n`;
}

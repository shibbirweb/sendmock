/**
 * Fails when any REST operation lacks a CLI command, an MCP tool (outside the
 * recorded exemption) or a UI place, and prints a per-area table; in GitHub
 * Actions the table also goes to the job summary (UI-11.7).
 *
 *     bun run parity
 */
import { appendFileSync } from "node:fs";

import { apiEndpoints } from "../../src/lib/api/endpoint-registry";
import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import {
  buildSurfaceParityReport,
  formatSurfaceParityReport,
} from "./surface-parity-report";

const report = buildSurfaceParityReport(apiEndpoints, surfaceCatalogue);
const reportMarkdown = formatSurfaceParityReport(report);
console.log(reportMarkdown);

const jobSummaryPath = process.env.GITHUB_STEP_SUMMARY;
if (jobSummaryPath !== undefined && jobSummaryPath !== "") {
  appendFileSync(jobSummaryPath, reportMarkdown);
}
if (report.gaps.length > 0) {
  process.exit(1);
}

import type { ApiEndpoint } from "../../src/lib/api/endpoint-registry";
import type { SurfaceCatalogue } from "../../src/lib/api/surface-catalogue";

export type ParityGap = {
  operationKey: string;
  problem: string;
};

export type AreaParity = {
  area: string;
  operationCount: number;
  cliCount: number;
  mcpCount: number;
  mcpExemptCount: number;
  uiCount: number;
};

export type SurfaceParityReport = {
  areas: AreaParity[];
  gaps: ParityGap[];
};

const cliPattern = /^sendmock [a-z]/;
const mcpPattern = /^(sendmock_[a-z_]+|sendmock:\/\/\S+)$/;

/**
 * Checks every REST operation has a CLI command, an MCP tool or resource (or a
 * recorded exemption) and a UI place, and every catalogue entry an operation
 * (docs/plan/20-surface-parity.md, UI-11.7).
 */
export function buildSurfaceParityReport(
  apiEndpoints: ApiEndpoint[],
  surfaceCatalogue: SurfaceCatalogue,
): SurfaceParityReport {
  const gaps: ParityGap[] = [];
  const areasByTag = new Map<string, AreaParity>();
  const operationKeys = new Set<string>();

  for (const apiEndpoint of apiEndpoints) {
    const operationKey = `${apiEndpoint.method} ${apiEndpoint.path}`;
    operationKeys.add(operationKey);
    const areaParity = areasByTag.get(apiEndpoint.tag) ?? {
      area: apiEndpoint.tag,
      operationCount: 0,
      cliCount: 0,
      mcpCount: 0,
      mcpExemptCount: 0,
      uiCount: 0,
    };
    areasByTag.set(apiEndpoint.tag, areaParity);
    areaParity.operationCount += 1;

    const operationSurfaces = surfaceCatalogue[operationKey];
    if (operationSurfaces === undefined) {
      gaps.push({
        operationKey,
        problem: "no CLI command, MCP tool or UI place",
      });
      continue;
    }
    if (cliPattern.test(operationSurfaces.cli)) {
      areaParity.cliCount += 1;
    } else {
      gaps.push({ operationKey, problem: "no CLI command" });
    }
    if (operationSurfaces.mcp === null) {
      if (operationSurfaces.mcpExemptReason?.trim()) {
        areaParity.mcpExemptCount += 1;
      } else {
        gaps.push({
          operationKey,
          problem: "no MCP tool and no exemption reason",
        });
      }
    } else if (mcpPattern.test(operationSurfaces.mcp)) {
      areaParity.mcpCount += 1;
    } else {
      gaps.push({
        operationKey,
        problem: `MCP name "${operationSurfaces.mcp}" is not a tool or resource`,
      });
    }
    if (operationSurfaces.ui.trim() === "") {
      gaps.push({ operationKey, problem: "no UI place" });
    } else {
      areaParity.uiCount += 1;
    }
  }

  for (const catalogueKey of Object.keys(surfaceCatalogue)) {
    if (!operationKeys.has(catalogueKey)) {
      gaps.push({
        operationKey: catalogueKey,
        problem: "in the catalogue but not a REST operation",
      });
    }
  }

  return { areas: [...areasByTag.values()], gaps };
}

/** The report as Markdown, for the console and the GitHub job summary. */
export function formatSurfaceParityReport(report: SurfaceParityReport): string {
  const totals = report.areas.reduce(
    (sum, areaParity) => ({
      operationCount: sum.operationCount + areaParity.operationCount,
      cliCount: sum.cliCount + areaParity.cliCount,
      mcpCount: sum.mcpCount + areaParity.mcpCount + areaParity.mcpExemptCount,
      uiCount: sum.uiCount + areaParity.uiCount,
    }),
    { operationCount: 0, cliCount: 0, mcpCount: 0, uiCount: 0 },
  );
  const lines = [
    "## Surface parity",
    "",
    report.gaps.length === 0
      ? `Every one of the ${totals.operationCount} operations has REST, CLI, MCP and UI.`
      : `${report.gaps.length} gap(s) found.`,
    "",
    "| Area | REST | CLI | MCP | UI |",
    "| --- | --- | --- | --- | --- |",
    ...report.areas.map(
      (areaParity) =>
        `| ${areaParity.area} | ${areaParity.operationCount} | ${areaParity.cliCount} | ${areaParity.mcpCount}${areaParity.mcpExemptCount > 0 ? ` + ${areaParity.mcpExemptCount} exempt` : ""} | ${areaParity.uiCount} |`,
    ),
    `| **All** | **${totals.operationCount}** | **${totals.cliCount}** | **${totals.mcpCount}** | **${totals.uiCount}** |`,
  ];
  if (report.gaps.length > 0) {
    lines.push(
      "",
      "### Gaps",
      "",
      ...report.gaps.map((gap) => `- \`${gap.operationKey}\`: ${gap.problem}`),
    );
  }

  return `${lines.join("\n")}\n`;
}

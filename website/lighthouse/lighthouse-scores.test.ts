import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads the reports `lhci autorun` writes (see lighthouserc.json); CI runs
 * this right after it. Locally, run Lighthouse CI first.
 */
const manifestPath = fileURLToPath(
  new URL("../.lighthouseci/manifest.json", import.meta.url),
);

type LighthouseRun = { summary: Record<string, number> };

function medianScore(scores: number[]): number {
  const sortedScores = [...scores].sort(
    (firstScore, secondScore) => firstScore - secondScore,
  );
  return sortedScores[Math.floor(sortedScores.length / 2)] ?? 0;
}

describe("Lighthouse", () => {
  test("WS-02.3 the landing page scores at least 90 in every category (median of the runs)", () => {
    expect(
      existsSync(manifestPath),
      "run `bunx --bun @lhci/cli@0.15.1 autorun` first",
    ).toBe(true);
    const lighthouseRuns = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as LighthouseRun[];
    expect(lighthouseRuns.length).toBeGreaterThanOrEqual(3);

    for (const categoryName of [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ]) {
      const categoryMedian = medianScore(
        lighthouseRuns.map(
          (lighthouseRun) => lighthouseRun.summary[categoryName] ?? 0,
        ),
      );
      expect(categoryMedian, categoryName).toBeGreaterThanOrEqual(0.9);
    }
  });
});

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

type LighthouseRun = { url: string; summary: Record<string, number> };

function medianScore(scores: number[]): number {
  const sortedScores = [...scores].sort(
    (firstScore, secondScore) => firstScore - secondScore,
  );
  return sortedScores[Math.floor(sortedScores.length / 2)] ?? 0;
}

function readLighthouseRuns(): LighthouseRun[] {
  expect(
    existsSync(manifestPath),
    "run `bunx --bun @lhci/cli@0.15.1 autorun` first",
  ).toBe(true);
  return JSON.parse(readFileSync(manifestPath, "utf8")) as LighthouseRun[];
}

function isLandingPageUrl(pageUrl: string): boolean {
  return new URL(pageUrl).pathname === "/";
}

describe("Lighthouse", () => {
  test("WS-02.3 the landing page scores at least 90 in every category (median of the runs)", () => {
    const landingRuns = readLighthouseRuns().filter((lighthouseRun) =>
      isLandingPageUrl(lighthouseRun.url),
    );
    expect(landingRuns.length).toBeGreaterThanOrEqual(3);

    for (const categoryName of [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ]) {
      const categoryMedian = medianScore(
        landingRuns.map(
          (lighthouseRun) => lighthouseRun.summary[categoryName] ?? 0,
        ),
      );
      expect(categoryMedian, categoryName).toBeGreaterThanOrEqual(0.9);
    }
  });

  test("WS-13.8 the landing, docs, API, CLI and changelog pages score 100 for SEO", () => {
    const lighthouseRuns = readLighthouseRuns();
    const pathnames = [
      ...new Set(
        lighthouseRuns.map(
          (lighthouseRun) => new URL(lighthouseRun.url).pathname,
        ),
      ),
    ];
    expect(pathnames.sort()).toEqual([
      "/",
      "/api/",
      "/changelog/",
      "/cli/",
      "/docs/",
      "/docs/install/",
    ]);

    for (const pathname of pathnames) {
      const seoMedian = medianScore(
        lighthouseRuns
          .filter(
            (lighthouseRun) => new URL(lighthouseRun.url).pathname === pathname,
          )
          .map((lighthouseRun) => lighthouseRun.summary.seo ?? 0),
      );
      expect(seoMedian, pathname).toBe(1);
    }
  });
});

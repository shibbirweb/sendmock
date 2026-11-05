import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type MatrixEntry = { language: string; folder: string; run: string };
type ExampleAppsWorkflow = {
  jobs: {
    binary: { steps: { run?: string }[] };
    app: { strategy: { matrix: { include: MatrixEntry[] } } };
  };
};

const exampleAppsWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/example-apps.yml", "utf8"),
) as ExampleAppsWorkflow;

describe("Example apps workflow", () => {
  test("an app in each of the eight languages runs against a release binary", () => {
    const matrixEntries = exampleAppsWorkflow.jobs.app.strategy.matrix.include;

    expect(
      exampleAppsWorkflow.jobs.binary.steps.some((step) =>
        step.run?.includes("cargo build --release"),
      ),
    ).toBe(true);
    expect(matrixEntries.map((matrixEntry) => matrixEntry.language)).toEqual([
      "PHP",
      "Node",
      "Python",
      "Go",
      "Java",
      "Rust",
      "Ruby",
      ".NET",
    ]);
    for (const matrixEntry of matrixEntries) {
      expect(existsSync(`examples/apps/${matrixEntry.folder}`)).toBe(true);
    }
  });

  test("Release build runs the example apps before it publishes", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(releaseWorkflow).toContain("uses: ./.github/workflows/example-apps.yml");
  });
});

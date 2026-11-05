import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type MatrixEntry = { language: string; folder: string; run: string };
type WorkflowStep = { "working-directory"?: string; run?: string };
type ExampleAppsWorkflow = {
  jobs: {
    binary: { steps: WorkflowStep[] };
    app: { strategy: { matrix: { include: MatrixEntry[] } } };
    presets: { needs: string; steps: WorkflowStep[] };
    recipes: {
      needs: string;
      strategy: { matrix: { include: { language: string; folder: string }[] } };
      steps: WorkflowStep[];
    };
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

  test("HC-03.1 the presets' official libraries run against the release binary", () => {
    const presetsStep = exampleAppsWorkflow.jobs.presets.steps.find(
      (step) => step["working-directory"] === "examples/http-presets/node",
    );

    expect(exampleAppsWorkflow.jobs.presets.needs).toBe("binary");
    expect(presetsStep?.run).toContain("node done-when.js");
    expect(existsSync("examples/http-presets/node/done-when.js")).toBe(true);
  });

  test("WS-08.5 the recipe examples run from the guide pages against the release binary", () => {
    const recipesJob = exampleAppsWorkflow.jobs.recipes;
    const startStep = recipesJob.steps.find((step) =>
      (step.run ?? "").includes("stand-in-app.mjs"),
    );

    expect(recipesJob.needs).toBe("binary");
    expect(startStep?.run).toContain(
      "--seed examples/recipes/sendmock.seed.toml",
    );
    for (const { folder } of recipesJob.strategy.matrix.include) {
      expect(existsSync(`examples/recipes/${folder}/package.json`)).toBe(true);
    }
    expect(
      recipesJob.steps.some((step) =>
        (step.run ?? "").includes("run-recipes.mjs"),
      ),
    ).toBe(true);
  });

  test("Release build runs the example apps before it publishes", () => {
    const releaseWorkflow = readFileSync(
      ".github/workflows/release.yml",
      "utf8",
    );

    expect(releaseWorkflow).toContain(
      "uses: ./.github/workflows/example-apps.yml",
    );
  });
});

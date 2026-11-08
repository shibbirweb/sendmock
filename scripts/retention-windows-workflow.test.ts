import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type SamplingWorkflow = {
  on: { pull_request?: { paths?: string[] } };
  jobs: {
    sample?: {
      "runs-on"?: string;
      strategy?: { matrix?: { sample_group?: number[] } };
      env?: { RUNS_PER_JOB?: number };
      steps?: { run?: string }[];
    };
  };
};

const samplingWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/retention-windows.yml", "utf8"),
) as SamplingWorkflow;

describe("Retention on Windows workflow (issue 171)", () => {
  test("PL-08.2 samples the skipped retention load test 30 times on Windows runners", () => {
    const sampleJob = samplingWorkflow.jobs.sample;
    const stepCommands = (sampleJob?.steps ?? []).map((step) => step.run ?? "").join("\n");
    const sampleGroupCount = sampleJob?.strategy?.matrix?.sample_group?.length ?? 0;

    expect(sampleJob?.["runs-on"]).toBe("windows-latest");
    expect(sampleGroupCount * (sampleJob?.env?.RUNS_PER_JOB ?? 0)).toBe(30);
    expect(stepCommands).toContain("--test retention_under_load --locked --run-ignored ignored-only");
  });

  test("PL-08.2 runs when the database, retention or the test change", () => {
    expect(samplingWorkflow.on.pull_request?.paths).toEqual([
      "crates/sendmock-store/src/database/**",
      "crates/sendmock-store/src/retention/**",
      "crates/sendmock/tests/retention_under_load.rs",
      ".github/workflows/retention-windows.yml",
    ]);
  });
});

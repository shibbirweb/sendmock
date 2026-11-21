import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type WorkflowStep = {
  name?: string;
  run?: string;
  env?: Record<string, string>;
};
type ContinuousIntegrationWorkflow = {
  jobs: Record<string, { needs?: string | string[]; steps?: WorkflowStep[] }>;
};

const continuousIntegrationWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/ci.yml", "utf8"),
) as ContinuousIntegrationWorkflow;

describe("Setup compatibility job", () => {
  test("PL-18.9 CI exports a setup with the latest stable release and imports it with this build", () => {
    const compatibilityJob =
      continuousIntegrationWorkflow.jobs["setup-compatibility"];
    const steps = compatibilityJob?.steps ?? [];
    const installStep = steps.find((step) =>
      step.run?.includes("scripts/install/install.sh"),
    );
    const checkStep = steps.find((step) =>
      step.run?.includes("scripts/setup-compatibility-test.ts"),
    );

    expect(compatibilityJob?.needs).toBe("binary-smoke");
    expect(installStep?.run).not.toContain("--channel");
    expect(installStep?.env?.SENDMOCK_INSTALL_DIR).toContain(
      "previous-release",
    );
    expect(checkStep?.run).toContain("previous-release/sendmock");
    expect(checkStep?.run).toContain("sendmock-binary/sendmock");
    expect(continuousIntegrationWorkflow.jobs["rust-result"]?.needs).toContain(
      "setup-compatibility",
    );
  });

  test("PL-18.9 the previous release's seed uses only sections every release reads", () => {
    const previousReleaseSetup = readFileSync(
      "scripts/setup-compatibility/previous-release-setup.toml",
      "utf8",
    );
    const sectionHeaders = [
      ...previousReleaseSetup.matchAll(/^\[\[?([a-z_.]+)\]\]?$/gm),
    ].map((sectionMatch) => sectionMatch[1]);

    expect(sectionHeaders).not.toContain("sendmock");
    expect(sectionHeaders).not.toContain("http.bins");
    expect(sectionHeaders).not.toContain("scenarios");
    expect(sectionHeaders).toContain("numbers");
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type WorkflowStep = { name?: string; uses?: string; run?: string; with?: Record<string, string> };
type WorkflowTriggers = Record<string, { inputs?: Record<string, { default?: string }> } | null>;
type ScreenshotsWorkflow = {
  on?: WorkflowTriggers;
  true?: WorkflowTriggers;
  permissions: Record<string, string>;
  jobs: {
    screenshots: {
      container: { image: string };
      env: Record<string, string>;
      steps: WorkflowStep[];
    };
  };
};

const workflow = Bun.YAML.parse(
  readFileSync(".github/workflows/screenshots.yml", "utf8"),
) as ScreenshotsWorkflow;
// A YAML 1.1 reader takes the key `on` for the boolean true.
const triggers = workflow.on ?? workflow.true ?? {};
const job = workflow.jobs.screenshots;
const steps = job.steps;
const imageFolders = ["website/public/screenshots", "docs/wiki/images", "docs/wiki/deeper/images"];

function findStepIndex(isWanted: (step: WorkflowStep) => boolean): number {
  return steps.findIndex(isWanted);
}

describe("Screenshots workflow", () => {
  test("WS-10.5 starts only by hand, for every scene or the named ones", () => {
    expect(Object.keys(triggers)).toEqual(["workflow_dispatch"]);
    expect(triggers.workflow_dispatch?.inputs?.scenes?.default).toBe("");
    expect(job.env.SCENES).toBe("${{ inputs.scenes }}");
  });

  test("WS-10.5 checks the scene names before any of them reach a command", () => {
    const checkIndex = findStepIndex((step) => step.run?.includes('=~ ^[a-z0-9\\ -]*$') ?? false);
    const captureIndex = findStepIndex((step) => step.run?.includes("bun run screenshots") ?? false);

    expect(checkIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(captureIndex);
    expect(steps.some((step) => step.run?.includes("inputs.scenes") ?? false)).toBe(false);
  });

  test("WS-10.5 photographs the mock-mode build in Playwright's image", () => {
    const captureStep = steps.find((step) => step.run?.includes("bun run screenshots"));
    const captureScript = captureStep?.run ?? "";

    expect(job.container.image).toMatch(/^mcr\.microsoft\.com\/playwright:v[\d.]+-noble$/);
    expect(captureScript).not.toContain("VITE_API_MODE");
    expect(captureScript.indexOf("vite preview")).toBeGreaterThan(-1);
    expect(captureScript.indexOf("vite preview")).toBeLessThan(
      captureScript.indexOf("bun run screenshots"),
    );
    expect(captureScript).toContain('read -r -a scene_names <<< "$SCENES"');
    expect(captureScript).toContain('bun run screenshots "$APP_URL" "${scene_names[@]}"');
  });

  test("WS-10.5 hands back the three image folders as one artifact and commits nothing", () => {
    const uploadStep = steps.find((step) => step.uses?.startsWith("actions/upload-artifact"));
    const uploadedPaths = (uploadStep?.with?.path ?? "").trim().split("\n");
    const scripts = steps.map((step) => step.run ?? "").join("\n");

    expect(uploadStep?.with?.name).toBe("screenshots");
    expect(uploadedPaths).toEqual(imageFolders);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(scripts).not.toMatch(/git (commit|push)/);
  });
});

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";

type WorkflowStep = {
  name?: string;
  "working-directory"?: string;
  run?: string;
};
type LibraryEntry = { library: string; folder: string; run: string };
type WebhookHandlerWorkflow = {
  jobs: {
    binary: { steps: WorkflowStep[] };
    express: { needs: string; steps: WorkflowStep[] };
    libraries: {
      needs: string;
      strategy: { matrix: { include: LibraryEntry[] } };
    };
  };
};

const webhookHandlerWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/webhook-handler.yml", "utf8"),
) as WebhookHandlerWorkflow;

describe("Webhook handler workflow", () => {
  test("the Phase 3 done-when check runs the Express example against a release binary", () => {
    const binarySteps = webhookHandlerWorkflow.jobs.binary.steps;
    const steps = webhookHandlerWorkflow.jobs.express.steps;
    const checkStep = steps.find(
      (step) =>
        step["working-directory"] === "examples/webhooks/express-handler",
    );

    expect(
      binarySteps.some((step) => step.run?.includes("cargo build --release")),
    ).toBe(true);
    expect(webhookHandlerWorkflow.jobs.express.needs).toBe("binary");
    expect(checkStep?.run).toContain("node done-when.js");
    expect(existsSync("examples/webhooks/express-handler/done-when.js")).toBe(
      true,
    );
  });

  test("WH-04.1 the official Standard Webhooks libraries for Node, Python, PHP and Go each verify a delivery", () => {
    const libraryEntries =
      webhookHandlerWorkflow.jobs.libraries.strategy.matrix.include;
    const libraryImports: Record<string, string> = {
      "node-standard-webhooks": 'from "standardwebhooks"',
      "python-standard-webhooks":
        "from standardwebhooks.webhooks import Webhook",
      "php-standard-webhooks": "use StandardWebhooks\\Webhook;",
      "go-standard-webhooks":
        "github.com/standard-webhooks/standard-webhooks/libraries/go",
    };

    expect(webhookHandlerWorkflow.jobs.libraries.needs).toBe("binary");
    expect(libraryEntries.map((libraryEntry) => libraryEntry.folder)).toEqual(
      Object.keys(libraryImports),
    );
    for (const libraryEntry of libraryEntries) {
      const exampleFolder = `examples/webhooks/${libraryEntry.folder}`;
      const exampleSources = readdirSync(exampleFolder)
        .filter((fileName) => /\.(js|py|php|go)$/.test(fileName))
        .map((fileName) => readFileSync(`${exampleFolder}/${fileName}`, "utf8"))
        .join("\n");
      expect(exampleSources).toContain(
        libraryImports[libraryEntry.folder] ?? "",
      );
      expect(exampleSources).toContain("tampered");
    }
  });

  test("Release build runs the webhook handler check before it publishes", () => {
    const releaseWorkflow = readFileSync(
      ".github/workflows/release.yml",
      "utf8",
    );

    expect(releaseWorkflow).toContain(
      "uses: ./.github/workflows/webhook-handler.yml",
    );
  });
});

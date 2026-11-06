import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

type ClientEntry = { client: string; folder: string; run: string };

const smsClientsWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/sms-clients.yml", "utf8"),
) as { jobs: { client: { strategy: { matrix: { include: ClientEntry[] } } } } };
const clientEntries = smsClientsWorkflow.jobs.client.strategy.matrix.include;
const exampleSourceExtensions = [
  ".js",
  ".py",
  ".php",
  ".go",
  ".java",
  ".cs",
  ".rb",
];

/** Every source file of an example folder, joined, so a check does not depend on its layout. */
function readExampleSources(exampleFolder: string): string {
  return readdirSync(exampleFolder, { recursive: true, encoding: "utf8" })
    .filter((relativePath) =>
      exampleSourceExtensions.some((extension) =>
        relativePath.endsWith(extension),
      ),
    )
    .map((relativePath) =>
      readFileSync(`${exampleFolder}/${relativePath}`, "utf8"),
    )
    .join("\n");
}

describe("SMS clients workflow", () => {
  test("SM-02.4 VF-03.4 the official Twilio SDKs send and run a Verify login, each from its example folder", () => {
    expect(clientEntries.map((clientEntry) => clientEntry.client)).toEqual([
      "Twilio Node SDK",
      "Twilio Python SDK",
      "Twilio PHP SDK",
      "Twilio Go SDK",
      "Twilio Java SDK",
      "Twilio C# SDK",
      "Twilio Ruby SDK",
    ]);
    for (const clientEntry of clientEntries) {
      const exampleSources = readExampleSources(
        `examples/sms/${clientEntry.folder}`,
      );
      const comparableSources = exampleSources
        .toLowerCase()
        .replaceAll("_", "");
      expect(comparableSources).toContain("statuscallback");
      expect(comparableSources).toContain("verificationcheck");
    }
  });

  test("Release build runs the SMS clients before it publishes", () => {
    const releaseWorkflow = readFileSync(
      ".github/workflows/release.yml",
      "utf8",
    );

    expect(releaseWorkflow).toContain(
      "uses: ./.github/workflows/sms-clients.yml",
    );
    expect(releaseWorkflow).toMatch(
      /needs: \[plan, checksums, smtp-clients, sms-clients[^\]]*\]/,
    );
  });
});

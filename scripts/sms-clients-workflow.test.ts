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
    const twilioEntries = clientEntries.filter((clientEntry) =>
      clientEntry.client.startsWith("Twilio "),
    );
    expect(twilioEntries.map((clientEntry) => clientEntry.client)).toEqual([
      "Twilio Node SDK",
      "Twilio Python SDK",
      "Twilio PHP SDK",
      "Twilio Go SDK",
      "Twilio Java SDK",
      "Twilio C# SDK",
      "Twilio Ruby SDK",
    ]);
    for (const clientEntry of twilioEntries) {
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

  test("SM-17.1 SM-17.2 every other provider's official SDK sends from its folder and SendMock stores the SMS", () => {
    const providerPackages: Record<string, string> = {
      "Infobip Node SDK": "@infobip-api/sdk",
      "Telnyx Node SDK": "telnyx",
    };
    const otherEntries = clientEntries.filter(
      (clientEntry) => !clientEntry.client.startsWith("Twilio "),
    );

    expect(otherEntries.map((clientEntry) => clientEntry.client)).toEqual(
      Object.keys(providerPackages),
    );
    for (const clientEntry of otherEntries) {
      const exampleFolder = `examples/sms/${clientEntry.folder}`;
      const exampleSources = readExampleSources(exampleFolder);
      const packageJson = readFileSync(`${exampleFolder}/package.json`, "utf8");
      const providerPackage = providerPackages[clientEntry.client] ?? "";
      expect(packageJson).toContain(`"${providerPackage}"`);
      expect(exampleSources).toContain(`from "${providerPackage}"`);
      expect(exampleSources).toContain("/api/v1/sms");
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

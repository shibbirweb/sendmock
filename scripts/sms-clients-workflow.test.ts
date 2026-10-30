import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type ClientEntry = { client: string; folder: string; run: string };

const smsClientsWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/sms-clients.yml", "utf8"),
) as { jobs: { client: { strategy: { matrix: { include: ClientEntry[] } } } } };
const clientEntries = smsClientsWorkflow.jobs.client.strategy.matrix.include;

describe("SMS clients workflow", () => {
  test("VF-03.4 the official Twilio SDKs run a Verify login, each from its example folder", () => {
    expect(clientEntries.map((clientEntry) => clientEntry.client)).toEqual([
      "Twilio Node SDK",
      "Twilio Python SDK",
    ]);
    for (const clientEntry of clientEntries) {
      expect(existsSync(`examples/sms/${clientEntry.folder}`)).toBe(true);
      expect(
        readFileSync(
          `examples/sms/${clientEntry.folder}/${clientEntry.run.split(" ").at(-1)}`,
          "utf8",
        ),
      ).toContain("verification");
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
    expect(releaseWorkflow).toContain(
      "needs: [plan, checksums, smtp-clients, sms-clients]",
    );
  });
});

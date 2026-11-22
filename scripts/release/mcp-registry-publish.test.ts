import { describe, expect, test } from "bun:test";

import {
  buildVersionUrl,
  publishWithRetries,
  waitForNpmVersion,
} from "./mcp-registry-publish";

const noWait = async () => {};

function answerInTurn(statuses: number[]) {
  const requestedUrls: string[] = [];
  const fetchVersion = async (versionUrl: string) => {
    requestedUrls.push(versionUrl);
    return new Response(null, { status: statuses.shift() ?? 200 });
  };
  return { fetchVersion, requestedUrls };
}

describe("waiting for npm before the MCP registry", () => {
  test("asks npm for the exact version of sendmock", () => {
    expect(buildVersionUrl("sendmock", "1.4.1")).toBe(
      "https://registry.npmjs.org/sendmock/1.4.1",
    );
  });

  test("keeps asking while npm answers 404, then goes on once it serves the version", async () => {
    const { fetchVersion, requestedUrls } = answerInTurn([404, 404, 200]);

    await waitForNpmVersion("1.4.1", fetchVersion, noWait);

    expect(requestedUrls).toHaveLength(3);
  });

  test("gives up with the reason once the wait limit passes", async () => {
    const { fetchVersion } = answerInTurn([404, 404, 404, 404]);

    await expect(waitForNpmVersion("1.4.1", fetchVersion, noWait, 60_000)).rejects.toThrow(
      "npm still does not serve sendmock@1.4.1",
    );
  });

  test("stops at once when npm fails another way", async () => {
    const { fetchVersion } = answerInTurn([503]);

    await expect(waitForNpmVersion("1.4.1", fetchVersion, noWait)).rejects.toThrow(
      "npm answered 503",
    );
  });
});

describe("publishing to the MCP registry", () => {
  test("tries again while the registry says npm does not have the version yet", async () => {
    const answers = [
      { exitCode: 1, output: "version '1.4.1' was not found (status: 404)" },
      { exitCode: 0, output: "Published" },
    ];
    let attemptCount = 0;

    await publishWithRetries(() => {
      attemptCount += 1;
      return answers.shift() ?? { exitCode: 0, output: "" };
    }, noWait);

    expect(attemptCount).toBe(2);
  });

  test("fails at once on any other error", async () => {
    let attemptCount = 0;

    await expect(
      publishWithRetries(() => {
        attemptCount += 1;
        return { exitCode: 1, output: "invalid server.json" };
      }, noWait),
    ).rejects.toThrow("invalid server.json");
    expect(attemptCount).toBe(1);
  });
});

import { describe, expect, test } from "bun:test";

import {
  type CratesPublisher,
  isCrateVersionPublished,
  orderByDependencies,
  publishWorkspaceCrates,
  readRateLimitDelayMs,
  readWorkspaceCrates,
  type WorkspaceCrate,
} from "./crates-publish";

const rateLimitOutput =
  "error: failed to publish to registry at https://crates.io\n\nCaused by:\n  the remote server responded with an error (status 429 Too Many Requests): You have published too many new crates in a short period of time. Please try again after Sat, 14 Nov 2026 16:10:00 GMT or email help@crates.io to have your limit increased.";
const beforeRetryMs = Date.parse("Sat, 14 Nov 2026 16:00:00 GMT");

function buildCrate(
  crateName: string,
  workspaceDependencyNames: string[] = [],
): WorkspaceCrate {
  return { name: crateName, version: "1.0.0", workspaceDependencyNames };
}

function buildFakePublisher(
  publishedNames: string[],
  publishOutputs: Record<
    string,
    { exitCode: number; outputText: string }[]
  > = {},
) {
  const publishAttempts: string[] = [];
  const sleptDelaysMs: number[] = [];
  const publisher: CratesPublisher = {
    isVersionPublished: async (crateName) => publishedNames.includes(crateName),
    runCargoPublish: (crateName) => {
      publishAttempts.push(crateName);
      return (
        publishOutputs[crateName]?.shift() ?? { exitCode: 0, outputText: "" }
      );
    },
    sleep: async (delayMs) => {
      sleptDelaysMs.push(delayMs);
    },
    nowMs: () => beforeRetryMs,
  };

  return { publisher, publishAttempts, sleptDelaysMs };
}

describe("publishing the workspace crates", () => {
  test("DS-03.8 orders each crate after the workspace crates it needs, ignoring dev dependencies", () => {
    const workspaceCrates = readWorkspaceCrates({
      packages: [
        {
          name: "sendmock",
          version: "1.0.0",
          publish: null,
          dependencies: [
            { name: "sendmock-ops", kind: null, path: "/crates/sendmock-ops" },
            { name: "serde", kind: null },
          ],
        },
        {
          name: "sendmock-ops",
          version: "1.0.0",
          publish: null,
          dependencies: [
            {
              name: "sendmock-core",
              kind: null,
              path: "/crates/sendmock-core",
            },
            { name: "sendmock", kind: "dev", path: "/crates/sendmock" },
          ],
        },
        {
          name: "sendmock-core",
          version: "1.0.0",
          publish: null,
          dependencies: [],
        },
        {
          name: "sendmock-fixtures",
          version: "1.0.0",
          publish: [],
          dependencies: [],
        },
      ],
    });

    expect(
      orderByDependencies(workspaceCrates).map(
        (workspaceCrate) => workspaceCrate.name,
      ),
    ).toEqual(["sendmock-core", "sendmock-ops", "sendmock"]);
  });

  test("DS-03.8 skips a crate crates.io already has, so a re-run finishes a partial publish", async () => {
    const { publisher, publishAttempts } = buildFakePublisher([
      "sendmock-core",
    ]);

    const exitCode = await publishWorkspaceCrates(
      [buildCrate("sendmock", ["sendmock-core"]), buildCrate("sendmock-core")],
      publisher,
    );

    expect(exitCode).toBe(0);
    expect(publishAttempts).toEqual(["sendmock"]);
  });

  test("DS-03.8 waits out crates.io's rate limit until the time it names, then publishes again", async () => {
    const { publisher, publishAttempts, sleptDelaysMs } = buildFakePublisher(
      [],
      {
        "sendmock-core": [{ exitCode: 101, outputText: rateLimitOutput }],
      },
    );

    const exitCode = await publishWorkspaceCrates(
      [buildCrate("sendmock-core")],
      publisher,
    );

    expect(exitCode).toBe(0);
    expect(publishAttempts).toEqual(["sendmock-core", "sendmock-core"]);
    expect(sleptDelaysMs).toEqual([10 * 60 * 1000 + 5_000]);
  });

  test("DS-03.8 stops at the first crate that fails for another reason", async () => {
    const { publisher, publishAttempts, sleptDelaysMs } = buildFakePublisher(
      [],
      {
        "sendmock-core": [
          {
            exitCode: 101,
            outputText: "error: failed to verify package tarball",
          },
        ],
      },
    );

    const exitCode = await publishWorkspaceCrates(
      [buildCrate("sendmock-core"), buildCrate("sendmock", ["sendmock-core"])],
      publisher,
    );

    expect(exitCode).toBe(101);
    expect(publishAttempts).toEqual(["sendmock-core"]);
    expect(sleptDelaysMs).toEqual([]);
  });

  test("DS-03.8 a rate limit without a retry time waits ten minutes", () => {
    expect(
      readRateLimitDelayMs(
        "the remote server responded with an error (status 429 Too Many Requests)",
        0,
      ),
    ).toBe(10 * 60 * 1000);
    expect(
      readRateLimitDelayMs(
        "error: crate sendmock-core@1.0.0 already exists",
        0,
      ),
    ).toBeNull();
  });

  test("DS-03.8 an answer other than 200 or 404 from crates.io fails instead of skipping", async () => {
    const answerWith = (status: number) => async () =>
      new Response(null, { status });

    expect(
      await isCrateVersionPublished("sendmock", "1.0.0", answerWith(200)),
    ).toBe(true);
    expect(
      await isCrateVersionPublished("sendmock", "1.0.0", answerWith(404)),
    ).toBe(false);
    await expect(
      isCrateVersionPublished("sendmock", "1.0.0", answerWith(503)),
    ).rejects.toThrow("crates.io answered 503 for sendmock 1.0.0");
  });

  test("DS-03.8 a dependency cycle fails before anything is published", () => {
    expect(() =>
      orderByDependencies([
        buildCrate("sendmock-a", ["sendmock-b"]),
        buildCrate("sendmock-b", ["sendmock-a"]),
      ]),
    ).toThrow("cycle");
  });
});

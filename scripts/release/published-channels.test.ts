import { describe, expect, test } from "bun:test";

import {
  buildDebianVersion,
  listPublishedChannelChecks,
  waitForPublishedChannels,
} from "./published-channels";

const skipSleep = async () => {};

function answerWith(responsesByUrl: Record<string, () => Response>) {
  return async (url: string) => (responsesByUrl[url] ?? (() => new Response("", { status: 404 })))();
}

describe("published channels", () => {
  test("a beta's Debian version sorts before its stable", () => {
    expect(buildDebianVersion("1.4.1-beta.1")).toBe("1.4.1~beta.1");
    expect(buildDebianVersion("1.4.1")).toBe("1.4.1");
  });

  test("a beta waits for npm and the beta repository, never crates.io", () => {
    const checks = listPublishedChannelChecks("1.5.0-beta.1", "beta", true);

    expect(checks.map((check) => check.url)).toEqual([
      "https://registry.npmjs.org/sendmock/1.5.0-beta.1",
      "https://shibbir.me/sendmock/packages/apt/dists/beta/main/binary-amd64/Packages",
    ]);
  });

  test("a stable also waits for crates.io, with a User-Agent, when crates are published", () => {
    const checks = listPublishedChannelChecks("1.5.0", "stable", true);
    const cratesCheck = checks.find((check) => check.url.startsWith("https://crates.io/"));

    expect(cratesCheck?.url).toBe("https://crates.io/api/v1/crates/sendmock/1.5.0");
    expect(cratesCheck?.requestInit?.headers).toEqual({ "User-Agent": "sendmock-release-workflow" });
    expect(listPublishedChannelChecks("1.5.0", "stable", false)).toHaveLength(2);
  });

  test("returns nothing missing once every registry serves the release", async () => {
    const checks = listPublishedChannelChecks("1.5.0-beta.1", "beta", false);
    let repositoryAnswerCount = 0;
    const fetchUrl = answerWith({
      "https://registry.npmjs.org/sendmock/1.5.0-beta.1": () => new Response("{}"),
      "https://shibbir.me/sendmock/packages/apt/dists/beta/main/binary-amd64/Packages": () => {
        repositoryAnswerCount += 1;
        const servedVersion = repositoryAnswerCount < 3 ? "1.4.1~beta.1" : "1.5.0~beta.1";
        return new Response(`Package: sendmock\nVersion: ${servedVersion}\n`);
      },
    });

    const missingLabels = await waitForPublishedChannels(checks, fetchUrl, skipSleep);

    expect(missingLabels).toEqual([]);
    expect(repositoryAnswerCount).toBe(3);
  });

  test("names what is still missing after the limit, counting a failed request as not served", async () => {
    const checks = listPublishedChannelChecks("1.5.0", "stable", true);
    const fetchUrl = async (url: string) => {
      if (url.startsWith("https://crates.io/")) {
        throw new Error("connection reset");
      }
      if (url.includes("binary-amd64")) {
        return new Response("Version: 1.5.0\n");
      }
      return new Response("{}");
    };

    const missingLabels = await waitForPublishedChannels(checks, fetchUrl, skipSleep, 60_000);

    expect(missingLabels).toEqual(["crates.io sendmock 1.5.0"]);
  });
});

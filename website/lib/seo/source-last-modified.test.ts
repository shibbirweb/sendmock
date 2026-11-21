import { describe, expect, test } from "bun:test";

import { type GitRunner, findLastCommitDate } from "./source-last-modified";

describe("findLastCommitDate", () => {
  test("WS-13.9 asks git for the last commit that changed the files and returns its date", () => {
    const gitCalls: { gitArguments: string[]; repositoryRoot: string }[] = [];
    const gitRunner: GitRunner = (gitArguments, repositoryRoot) => {
      gitCalls.push({ gitArguments, repositoryRoot });
      return "2026-11-16T21:04:05+06:00\n";
    };

    expect(
      findLastCommitDate(["docs/wiki/install.md"], "/repository", gitRunner),
    ).toBe("2026-11-16T21:04:05+06:00");
    expect(gitCalls).toEqual([
      {
        gitArguments: [
          "log",
          "-1",
          "--format=%cI",
          "--",
          "docs/wiki/install.md",
        ],
        repositoryRoot: "/repository",
      },
    ]);
  });

  test("WS-13.9 gives no date when git has no history for the files", () => {
    expect(findLastCommitDate(["new-page.md"], "/repository", () => "")).toBe(
      undefined,
    );
  });

  test("WS-13.9 gives no date when git cannot run", () => {
    const failingGitRunner: GitRunner = () => {
      throw new Error("fatal: not a git repository");
    };

    expect(
      findLastCommitDate(["CHANGELOG.md"], "/repository", failingGitRunner),
    ).toBe(undefined);
  });
});

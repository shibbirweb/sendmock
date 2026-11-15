import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findSectionStartTag,
  parseMergeCommits,
  readReleaseTags,
} from "./release-history";
import {
  formatVersion,
  parseVersion,
  type SemanticVersion,
} from "./semantic-version";

function versions(...versionTexts: string[]): SemanticVersion[] {
  return versionTexts.flatMap((versionText) => {
    const version = parseVersion(versionText);
    return version ? [version] : [];
  });
}

describe("findSectionStartTag (DS-05.4)", () => {
  const tags = versions("0.3.1", "0.4.0-beta.1", "0.4.0-beta.2");

  test("DS-05.4 a stable section collects its betas, starting at the last stable", () => {
    const startTag = findSectionStartTag(
      versions("0.4.0")[0] as SemanticVersion,
      tags,
    );

    expect(startTag && formatVersion(startTag)).toBe("0.3.1");
  });

  test("a beta section starts at the last tag of any kind", () => {
    const startTag = findSectionStartTag(
      versions("0.4.0-beta.3")[0] as SemanticVersion,
      tags,
    );

    expect(startTag && formatVersion(startTag)).toBe("0.4.0-beta.2");
  });

  test("the first release starts at the beginning", () => {
    expect(
      findSectionStartTag(versions("0.1.0-beta.1")[0] as SemanticVersion, []),
    ).toBeNull();
  });
});

describe("parseMergeCommits", () => {
  test("reads the pull request number from the subject and the title from the body", () => {
    const gitLogOutput = [
      "Merge pull request #47 from shibbirweb/docs/phase-0-plan\u001fdocs:[P0] plan Phase 0\n\u001e",
      "Merge branch 'develop'\u001f\u001e",
    ].join("\n");

    expect(parseMergeCommits(gitLogOutput)).toEqual([
      { number: 47, title: "docs:[P0] plan Phase 0" },
    ]);
  });
});

function runGitIn(repositoryRoot: string, gitArguments: string[]) {
  const gitResult = Bun.spawnSync(["git", ...gitArguments], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Release test",
      GIT_AUTHOR_EMAIL: "release-test@example.test",
      GIT_COMMITTER_NAME: "Release test",
      GIT_COMMITTER_EMAIL: "release-test@example.test",
    },
  });
  if (gitResult.exitCode !== 0) {
    throw new Error(`git ${gitArguments.join(" ")}: ${gitResult.stderr.toString()}`);
  }
}

/** A repository shaped like ours after a stable: `v1.0.0` on main's merge commit, develop ahead. */
function buildRepositoryAfterAStable(): string {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "release-tags-"));
  runGitIn(repositoryRoot, ["init", "--quiet", "--initial-branch=develop"]);
  runGitIn(repositoryRoot, ["commit", "--quiet", "--allow-empty", "-m", "start"]);
  runGitIn(repositoryRoot, ["branch", "main"]);
  runGitIn(repositoryRoot, ["commit", "--quiet", "--allow-empty", "-m", "release 1.0.0-beta.1"]);
  runGitIn(repositoryRoot, ["tag", "v1.0.0-beta.1"]);
  runGitIn(repositoryRoot, ["commit", "--quiet", "--allow-empty", "-m", "release 1.0.0"]);
  runGitIn(repositoryRoot, ["switch", "--quiet", "main"]);
  runGitIn(repositoryRoot, ["merge", "--quiet", "--no-ff", "-m", "promote 1.0.0", "develop"]);
  runGitIn(repositoryRoot, ["tag", "v1.0.0"]);
  runGitIn(repositoryRoot, ["switch", "--quiet", "develop"]);
  runGitIn(repositoryRoot, ["commit", "--quiet", "--allow-empty", "-m", "a fix after 1.0.0"]);
  return repositoryRoot;
}

describe("readReleaseTags", () => {
  test("DS-05.1 develop sees the stable tag on main's merge commit, which it never contains", () => {
    const repositoryRoot = buildRepositoryAfterAStable();
    try {
      const tags = readReleaseTags(repositoryRoot).map((tag) => formatVersion(tag));

      expect(tags).toEqual(["1.0.0-beta.1", "1.0.0"]);
    } finally {
      rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });
});

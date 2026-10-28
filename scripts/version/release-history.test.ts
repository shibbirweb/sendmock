import { describe, expect, test } from "bun:test";

import { findSectionStartTag, parseMergeCommits } from "./release-history";
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

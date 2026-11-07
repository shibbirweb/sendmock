import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Plan phases and stages are words of the project plan, not of the product; a user reading
// the docs cannot know what "Phase 4" means, and such lines go stale when the phase ends.
const planWordPattern =
  /\b(?:Phase \d+P?|Phase U\d|Stage [AB])\b|backend phase/;

const wikiPages = execSync(
  "git ls-files 'docs/wiki/*.md' 'docs/wiki/**/*.md'",
  {
    encoding: "utf8",
  },
)
  .split("\n")
  .filter((pagePath) => pagePath !== "");

describe("docs wording", () => {
  test("no docs page names a plan phase or stage", () => {
    const pagesWithPlanWords = wikiPages.flatMap((pagePath) =>
      readFileSync(pagePath, "utf8")
        .split("\n")
        .map((line, lineIndex) => ({ line, lineNumber: lineIndex + 1 }))
        .filter(({ line }) => planWordPattern.test(line))
        .map(({ lineNumber }) => `${pagePath}:${lineNumber}`),
    );

    expect(wikiPages.length).toBeGreaterThan(80);
    expect(pagesWithPlanWords).toEqual([]);
  });

  test("every docs page's front matter is valid YAML with a title and a description", () => {
    const invalidPages = wikiPages.filter((pagePath) => {
      const frontMatter = readFileSync(pagePath, "utf8").match(
        /^---\n([\s\S]*?)\n---/,
      )?.[1];
      if (frontMatter === undefined) {
        return false;
      }
      try {
        const parsedFrontMatter = Bun.YAML.parse(frontMatter) as Record<
          string,
          unknown
        >;
        return (
          typeof parsedFrontMatter.title !== "string" ||
          typeof parsedFrontMatter.description !== "string"
        );
      } catch {
        return true;
      }
    });

    expect(invalidPages).toEqual([]);
  });
});

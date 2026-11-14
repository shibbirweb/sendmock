import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findExampleProblems } from "./example-checks";
import { loadExampleContract } from "./example-contract";
import { exampleRenderers } from "./page-sections";
import {
  codeExamples,
  renderGuideExamples,
  wikiDirectory,
} from "./render-guide-examples";
import { testHelpers } from "./test-helpers";

/** The guide page of every sidebar menu (WS-06.1 lists the same menus). */
const menuPages = [
  "overview.md",
  "mail/index.md",
  "sms/index.md",
  "http/index.md",
  "webhooks/index.md",
  "payments/index.md",
  "numbers.md",
  "scenarios.md",
  "logs.md",
  "settings.md",
];

const tabNames = exampleRenderers.map(
  (exampleRenderer) => exampleRenderer.tabName,
);

function readGuidePage(page: string): string {
  return readFileSync(join(wikiDirectory, page), "utf8");
}

/** The tab titles of the code blocks in a section of a page. */
function readSectionTabs(pageText: string, heading: string): string[] {
  const sectionStart = pageText.indexOf(`\n## ${heading}\n`);
  if (sectionStart === -1) {
    return [];
  }
  const sectionEnd = pageText.indexOf(
    "\n## ",
    sectionStart + heading.length + 5,
  );
  const sectionText = pageText.slice(
    sectionStart,
    sectionEnd === -1 ? undefined : sectionEnd,
  );

  return [...sectionText.matchAll(/^```\w+ tab="([^"]+)"/gm)].map(
    (tabMatch) => tabMatch[1] ?? "",
  );
}

describe("code examples in the guide", () => {
  test("WS-08.1 every recipe has an In your code section with a tab per language", () => {
    const recipePages = readdirSync(join(wikiDirectory, "recipes"))
      .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
      .map((fileName) => `recipes/${fileName}`);

    expect(recipePages.length).toBeGreaterThanOrEqual(13);
    expect(tabNames).toEqual([
      "CLI",
      "PHP",
      "JavaScript",
      "Python",
      "Go",
      "Java",
      "Rust",
      "Ruby",
      "C#",
    ]);
    for (const recipePage of recipePages) {
      expect(
        readSectionTabs(readGuidePage(recipePage), "In your code"),
        recipePage,
      ).toEqual(tabNames);
    }
  });

  test("WS-08.1 the Connect pages show the call helper the examples use", () => {
    for (const testHelper of testHelpers) {
      const pageText = readGuidePage(testHelper.page);
      expect(pageText, testHelper.page).toContain("\n## Test helper\n");
      expect(pageText, testHelper.page).toContain(
        `title="${testHelper.fileName}"`,
      );
    }
  });

  test("WS-08.2 every menu page has a From your code section with a tab per language", () => {
    for (const menuPage of menuPages) {
      expect(
        readSectionTabs(readGuidePage(menuPage), "From your code"),
        menuPage,
      ).toEqual(tabNames);
    }
  });

  test("WS-08.3 every example uses real operations, inputs, answer fields and CLI commands", () => {
    const exampleContract = loadExampleContract();
    const problems = codeExamples.flatMap((codeExample) =>
      findExampleProblems(codeExample, exampleContract),
    );

    expect(codeExamples.length).toBe(23);
    expect(problems).toEqual([]);
  });

  test("WS-08.3 a wrong path, input or field is reported", () => {
    const exampleContract = loadExampleContract();
    const problems = findExampleProblems(
      {
        page: "check.md",
        heading: "In your code",
        intro: "",
        testName: "is wrong",
        steps: [
          {
            kind: "api",
            method: "GET",
            path: "/api/v1/otp",
            query: { recipient: "a" },
            answerName: "otp",
          },
          { kind: "api", method: "GET", path: "/api/v1/nope" },
          { kind: "expect", answerName: "otp", fieldPath: "pin", value: "1" },
        ],
      },
      exampleContract,
    );

    expect(problems).toEqual([
      "check.md: GET /api/v1/otp: recipient is not a query parameter",
      "check.md: GET /api/v1/otp: the query needs to",
      "check.md: GET /api/v1/nope is not in the spec",
      "check.md: otp.pin is not in the answer",
    ]);
  });

  test("WS-08.3 the guide pages hold the examples as rendered from the contract", () => {
    const stalePages = [...renderGuideExamples()]
      .filter(([page, freshText]) => readGuidePage(page) !== freshText)
      .map(([page]) => page);

    expect(stalePages).toEqual([]);
  });
});

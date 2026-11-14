import { describe, expect, test } from "bun:test";

import { auditProductName, findNameProblems } from "./product-name-audit";

describe("product name audit", () => {
  test("every tracked file uses the product name SendMock and no old or placeholder name", () => {
    expect(auditProductName()).toEqual([]);
  });

  test("a rejected name, an owner placeholder and a wrong casing in prose are reported", () => {
    const pageText = [
      "Install MailSMS from ghcr.io/<owner>/sendmock.",
      "Sendmock catches mail.",
    ].join("\n");

    expect(
      findNameProblems("docs/wiki/example.md", pageText).map(
        (nameProblem) => `${nameProblem.lineNumber} ${nameProblem.found}`,
      ),
    ).toEqual(["1 MailSMS", "1 <owner>", "2 Sendmock"]);
  });

  test("code keeps its language's casing, in code files and in Markdown code", () => {
    const pageText = [
      "```js",
      'const SENDMOCK = "http://127.0.0.1:8025/api/v1";',
      "```",
      "The `X-Sendmock-File-Url` header names the file.",
    ].join("\n");

    expect(findNameProblems("docs/wiki/example.md", pageText)).toEqual([]);
    expect(
      findNameProblems("src/constants.ts", 'export const SENDMOCK = "";'),
    ).toEqual([]);
  });
});

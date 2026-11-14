import { describe, expect, test } from "bun:test";

import { toNamePattern } from "./control-name-pattern";

describe("Deeper screenshot markers (WS-10.2)", () => {
  test("WS-10.2 a crawl name with numbers matches the live name with any numbers", () => {
    expect(toNamePattern("Copy # # # #").test("Copy 4242 4242 4242 4242")).toBe(
      true,
    );
  });

  test("WS-10.2 a clock time and a month in a crawl name match any time and month", () => {
    const namePattern = toNamePattern(
      "./sendmock.seed.toml applied Month #, #, #:#",
    );

    expect(
      namePattern.test("./sendmock.seed.toml applied Nov 7, 2026, 12:43 PM"),
    ).toBe(true);
  });

  test("WS-10.2 an ellipsis matches any text and the rest of the name stays exact", () => {
    const namePattern = toNamePattern("Copy the … base URL");

    expect(namePattern.test("Copy the SendGrid base URL")).toBe(true);
    expect(namePattern.test("Copy the SendGrid base URL now")).toBe(false);
  });

  test("WS-10.2 regular expression characters in a name are matched as they are", () => {
    expect(toNamePattern("Rule (#) [x]").test("Rule (3) [x]")).toBe(true);
    expect(toNamePattern("a.b").test("axb")).toBe(false);
  });
});

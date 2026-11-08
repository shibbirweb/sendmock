import { describe, expect, test } from "bun:test";

import { splitInlineMarkdown } from "./inline-markdown";

describe("splitInlineMarkdown", () => {
  test("DS-05.4 reads bold labels, inline code and links in a changelog line", () => {
    expect(
      splitInlineMarkdown(
        "**Email:** run `sendmock --demo` and see [the docs](https://example.test/docs) or https://example.test/.",
      ),
    ).toEqual([
      { kind: "bold", text: "Email:" },
      { kind: "text", text: " run " },
      { kind: "code", text: "sendmock --demo" },
      { kind: "text", text: " and see " },
      {
        kind: "link",
        text: "the docs",
        url: "https://example.test/docs",
      },
      { kind: "text", text: " or " },
      {
        kind: "link",
        text: "https://example.test/",
        url: "https://example.test/",
      },
      { kind: "text", text: "." },
    ]);
  });

  test("DS-05.4 a line without Markdown is one plain part", () => {
    expect(splitInlineMarkdown("Keep the toast position.")).toEqual([
      { kind: "text", text: "Keep the toast position." },
    ]);
  });
});

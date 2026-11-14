import { describe, expect, test } from "vitest";

import { diffLines } from "@/lib/text/diff-lines";

describe("diffLines", () => {
  test("WH-09.5 marks added, removed and unchanged lines", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc\nd")).toEqual([
      { change: "same", lineText: "a" },
      { change: "removed", lineText: "b" },
      { change: "added", lineText: "B" },
      { change: "same", lineText: "c" },
      { change: "added", lineText: "d" },
    ]);
  });

  test("identical text has no changes", () => {
    expect(
      diffLines("x\ny", "x\ny").every((diffLine) => diffLine.change === "same"),
    ).toBe(true);
  });

  test("handles empty sides", () => {
    expect(diffLines("", "new")).toEqual([
      { change: "removed", lineText: "" },
      { change: "added", lineText: "new" },
    ]);
  });
});

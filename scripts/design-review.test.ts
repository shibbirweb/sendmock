import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** The rows of the design review table in plan 18, each cell trimmed. */
function readReviewRows(planText: string): string[][] {
  const lines = planText.split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("| Screen | Path |"));
  const rows: string[][] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) {
      break;
    }
    rows.push(
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

describe("the design review table", () => {
  const planText = readFileSync("docs/plan/18-phase-u3.md", "utf8");
  const reviewRows = readReviewRows(planText);

  test("UI-07.3 every screen in the design review is signed off by the owner", () => {
    expect(reviewRows.length).toBeGreaterThan(20);
    for (const reviewRow of reviewRows) {
      const screenName = reviewRow[0] ?? "";
      expect(reviewRow.at(-1) ?? "", screenName).toMatch(/^Owner, \d{4}-\d{2}-\d{2}$/);
    }
  });

  test("UI-07.3 no review cell still waits for the owner", () => {
    expect(planText).not.toContain("For the owner's review");
  });
});

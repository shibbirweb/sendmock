import { describe, expect, test } from "bun:test";

import {
  collectCriterionReferences,
  countTickedCriteria,
  formatStatusLine,
  parseAcceptanceFile,
  parseFeatureStatuses,
  readStatusLine,
} from "./acceptance";

describe("parseAcceptanceFile", () => {
  test("reads features and their criteria", () => {
    const features = parseAcceptanceFile(
      [
        "## EM-01 SMTP receive",
        "",
        "Phase 1.",
        "",
        "- [ ] EM-01.1 A message is stored.",
        "- [x] EM-01.2 Catch-all. (#12)",
        "",
        "## EM-02 SMTP TLS and AUTH",
        "- [ ] EM-02.1 STARTTLS works.",
      ].join("\n"),
    );

    expect(features).toEqual([
      {
        featureId: "EM-01",
        featureName: "SMTP receive",
        status: "Not started",
        criterionIds: ["EM-01.1", "EM-01.2"],
      },
      {
        featureId: "EM-02",
        featureName: "SMTP TLS and AUTH",
        status: "Not started",
        criterionIds: ["EM-02.1"],
      },
    ]);
  });
});

describe("parseFeatureStatuses", () => {
  test("reads the status column of the README table", () => {
    const featureStatuses = parseFeatureStatuses(
      "| [UI-01](06-ui.md#ui-01-app-shell) | App shell | Phase U0 | 4 | Accepted |",
    );

    expect(featureStatuses.get("UI-01")).toBe("Accepted");
  });
});

describe("collectCriterionReferences", () => {
  test("finds IDs in Rust comments and test titles", () => {
    const references = collectCriterionReferences([
      { filePath: "a.rs", fileContent: "// AC: EM-01.3\n#[test]" },
      { filePath: "b.test.ts", fileContent: 'test("EM-01.3 rejects big mail")' },
    ]);

    expect([...(references.get("EM-01.3") ?? [])]).toEqual(["a.rs", "b.test.ts"]);
  });
});

describe("the README's status line", () => {
  test("counts only ticked criteria", () => {
    expect(
      countTickedCriteria(
        ["- [x] EM-01.1 Stored. (#1)", "- [ ] EM-01.2 Catch-all.", "- [x] EM-01.3 Big mail."].join(
          "\n",
        ),
      ),
    ).toBe(2);
  });

  test("reads the bold line and formats the one the totals call for", () => {
    const readmeContent = [
      "## Status",
      "",
      "**Accepted: 2 / 3 features, 7 / 9 criteria ticked.** Some note.",
    ].join("\n");

    expect(readStatusLine(readmeContent)).toBe(
      "**Accepted: 2 / 3 features, 7 / 9 criteria ticked.**",
    );
    expect(
      formatStatusLine({
        acceptedFeatureCount: 2,
        featureCount: 3,
        tickedCriterionCount: 7,
        criterionCount: 9,
      }),
    ).toBe("**Accepted: 2 / 3 features, 7 / 9 criteria ticked.**");
    expect(readStatusLine("## Status\n\nNo totals here.")).toBeNull();
  });
});

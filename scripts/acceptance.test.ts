import { describe, expect, test } from "bun:test";

import {
  collectCriterionReferences,
  parseAcceptanceFile,
  parseFeatureStatuses,
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

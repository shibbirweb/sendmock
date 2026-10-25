import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

const githubDirectory = join(import.meta.dir, "../../../.github");
const issueTemplateDirectory = join(githubDirectory, "ISSUE_TEMPLATE");

type IssueFormField = {
  type: string;
  id?: string;
  attributes: { label?: string; value?: string; options?: unknown[] };
};
type IssueForm = {
  name: string;
  description: string;
  labels?: string[];
  body: IssueFormField[];
};

const fieldTypes = new Set([
  "markdown",
  "input",
  "textarea",
  "dropdown",
  "checkboxes",
]);
const issueFormFiles = readdirSync(issueTemplateDirectory).filter(
  (fileName) => fileName.endsWith(".yml") && fileName !== "config.yml",
);

function readIssueForm(fileName: string): IssueForm {
  return parse(
    readFileSync(join(issueTemplateDirectory, fileName), "utf8"),
  ) as IssueForm;
}

/** The labels CONTRIBUTING.md documents, from its Labels table. */
function readDocumentedLabels(): Set<string> {
  const contributingText = readFileSync(
    join(githubDirectory, "CONTRIBUTING.md"),
    "utf8",
  );
  return new Set(
    [...contributingText.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map(
      (labelMatch) => labelMatch[1] ?? "",
    ),
  );
}

describe("GitHub templates", () => {
  test("UI-10.2 has the issue forms, PR template and community files", () => {
    expect(issueFormFiles.sort()).toEqual([
      "bug_report.yml",
      "docs.yml",
      "feature_request.yml",
      "provider_request.yml",
    ]);
    for (const fileName of [
      "ISSUE_TEMPLATE/config.yml",
      "pull_request_template.md",
      "SECURITY.md",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
    ]) {
      expect(existsSync(join(githubDirectory, fileName)), fileName).toBe(true);
    }
  });

  test("UI-10.2 every issue form is a valid GitHub issue form with documented labels", () => {
    const documentedLabels = readDocumentedLabels();
    for (const fileName of issueFormFiles) {
      const issueForm = readIssueForm(fileName);
      expect(issueForm.name, fileName).toBeTruthy();
      expect(issueForm.description, fileName).toBeTruthy();
      expect(issueForm.body.length, fileName).toBeGreaterThan(0);
      for (const label of issueForm.labels ?? []) {
        expect(documentedLabels.has(label), `${fileName}: label ${label}`).toBe(
          true,
        );
      }
      const fieldIds = issueForm.body.flatMap((formField) =>
        formField.id ? [formField.id] : [],
      );
      expect(new Set(fieldIds).size, `${fileName}: unique ids`).toBe(
        fieldIds.length,
      );
      for (const formField of issueForm.body) {
        expect(
          fieldTypes.has(formField.type),
          `${fileName}: ${formField.type}`,
        ).toBe(true);
        if (formField.type === "markdown") {
          expect(formField.attributes.value, fileName).toBeTruthy();
          continue;
        }
        expect(formField.id ?? "", fileName).toMatch(/^[a-z0-9_-]+$/);
        expect(
          formField.attributes.label,
          `${fileName}: ${formField.id}`,
        ).toBeTruthy();
        if (formField.type === "dropdown" || formField.type === "checkboxes") {
          expect(
            formField.attributes.options?.length ?? 0,
            `${fileName}: ${formField.id}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  test("UI-10.2 the bug and feature forms take the fields the app pre-fills", () => {
    for (const fileName of ["bug_report.yml", "feature_request.yml"]) {
      const inputIds = readIssueForm(fileName)
        .body.filter((formField) => formField.type === "input")
        .map((formField) => formField.id);
      expect(inputIds, fileName).toEqual(
        expect.arrayContaining(["version", "channel", "os", "browser"]),
      );
    }
  });

  test("UI-10.2 config.yml turns off blank issues and links questions, docs and security", () => {
    const issueConfig = parse(
      readFileSync(join(issueTemplateDirectory, "config.yml"), "utf8"),
    ) as {
      blank_issues_enabled: boolean;
      contact_links: { url: string }[];
    };

    expect(issueConfig.blank_issues_enabled).toBe(false);
    expect(
      issueConfig.contact_links.map((contactLink) => contactLink.url),
    ).toEqual([
      "https://github.com/shibbirweb/sendmock/discussions",
      "https://shibbirweb.github.io/sendmock/docs/",
      "https://github.com/shibbirweb/sendmock/security/advisories/new",
    ]);
  });

  test("the templates never use the em-dash character", () => {
    const templateFiles = [
      ...readdirSync(issueTemplateDirectory).map((fileName) =>
        join(issueTemplateDirectory, fileName),
      ),
      ...[
        "pull_request_template.md",
        "SECURITY.md",
        "CONTRIBUTING.md",
        "CODE_OF_CONDUCT.md",
      ].map((fileName) => join(githubDirectory, fileName)),
    ];
    for (const templateFile of templateFiles) {
      expect(
        readFileSync(templateFile, "utf8").includes("—"),
        templateFile,
      ).toBe(false);
    }
  });
});

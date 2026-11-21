import type {
  SetupFileFormat,
  SetupImportMode,
  SetupSectionChange,
  SetupValidation,
  SetupValidationError,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { validateSeedToml } from "@/mocks/fixtures/seed-toml";
import {
  buildSetupDocument,
  currentSetupFormatVersion,
  readSetupText,
  type SetupDocument,
} from "@/mocks/setup/mock-setup-document";

/** The fields each section's items are matched by, as the server's sections name them. */
const keyFieldsBySection: Record<string, string[]> = {
  projects: ["key"],
  numbers: ["number"],
  messaging_services: ["sid"],
  "verify.services": ["sid"],
  "webhook.endpoints": ["name"],
  "webhook.rules": ["name"],
  "webhook.templates": ["id"],
  "webhook.variables": ["endpoint", "name"],
  "webhook.saved": ["name"],
  "http.bins": ["name"],
  "email.templates": ["id"],
  "email.tag_rules": ["name"],
  "email.forward_rules": ["name"],
  "email.inbound_routes": ["description"],
  "email.outcome_rules": ["pattern"],
  "sms.outcome_rules": ["match", "pattern"],
  "email.providers": ["key"],
  "sms.providers": ["key"],
  "payments.flows": ["key"],
  "payments.methods": ["key"],
  "payments.gateways": ["key"],
  scenarios: ["name"],
};

type SectionItems = Map<string, Record<string, unknown>>;

/** Each item list in the document by section path, its items by key. */
function listSectionItems(
  setupDocument: SetupDocument,
): Map<string, SectionItems> {
  const sectionItems = new Map<string, SectionItems>();
  for (const [sectionPath, keyFields] of Object.entries(keyFieldsBySection)) {
    const [groupName = "", listName] = sectionPath.split(".");
    const groupValue = setupDocument[groupName];
    const listValue =
      listName === undefined
        ? groupValue
        : (groupValue as Record<string, unknown> | undefined)?.[listName];
    const itemsByKey: SectionItems = new Map();
    for (const itemTable of Array.isArray(listValue) ? listValue : []) {
      const itemKey = keyFields
        .map((keyField) => String(itemTable?.[keyField] ?? "").trim())
        .join(" ")
        .trim();
      itemsByKey.set(itemKey, itemTable as Record<string, unknown>);
    }
    sectionItems.set(sectionPath, itemsByKey);
  }

  return sectionItems;
}

/** References and encrypted secrets hold no value to compare. */
function hideSecrets(itemTable: Record<string, unknown>): string {
  return JSON.stringify(itemTable)
    .replace(/\$\{[^}]*\}/g, "${}")
    .replace(/encrypted:v1:[A-Za-z0-9_:-]+/g, "${}");
}

/** Per section, what importing the document would add, change and remove in the mock. */
export function previewSetupChanges(
  setupDocument: SetupDocument,
  importMode: SetupImportMode,
  mockDatabase: MockDatabase,
): SetupSectionChange[] {
  const storedSections = listSectionItems(buildSetupDocument(mockDatabase));
  const fileSections = listSectionItems(setupDocument);
  const sectionChanges: SetupSectionChange[] = [];
  for (const [sectionPath, fileItems] of fileSections) {
    const storedItems = storedSections.get(sectionPath) ?? new Map();
    const sectionChange: SetupSectionChange = {
      section: sectionPath,
      item_kind: sectionPath,
      added: [...fileItems.keys()].filter(
        (itemKey) => !storedItems.has(itemKey),
      ),
      changed: [...fileItems].flatMap(([itemKey, fileItem]) => {
        const storedItem = storedItems.get(itemKey);

        return storedItem !== undefined &&
          hideSecrets(storedItem) !== hideSecrets(fileItem)
          ? [itemKey]
          : [];
      }),
      removed:
        importMode === "replace"
          ? [...storedItems.keys()].filter((itemKey) => !fileItems.has(itemKey))
          : [],
    };
    const hasChanges =
      sectionChange.added.length +
        sectionChange.changed.length +
        sectionChange.removed.length >
      0;
    if (hasChanges) {
      sectionChanges.push(sectionChange);
    }
  }

  return sectionChanges;
}

function readFormatVersion(setupDocument: SetupDocument): number {
  const setupHeader = setupDocument.sendmock as
    Record<string, unknown> | undefined;

  return typeof setupHeader?.format_version === "number"
    ? setupHeader.format_version
    : 1;
}

/** A TOML file's problems by line, as the seed check words them, or the parser's own message. */
function describeReadProblem(
  setupText: string,
  setupFormat: SetupFileFormat,
  readProblem: { problem: string; line: number | null },
): SetupValidationError[] {
  const seedErrors =
    setupFormat === "toml" ? validateSeedToml(setupText).errors : [];
  if (seedErrors.length > 0) {
    return seedErrors.map((seedError) => ({
      line: seedError.line,
      location: null,
      message: seedError.message,
    }));
  }

  return [
    { line: readProblem.line, location: null, message: readProblem.problem },
  ];
}

/** The mock's answer to validate and import: problems, the format version and the changes. */
export function validateMockSetup(
  setupText: string,
  setupFormat: SetupFileFormat,
  importMode: SetupImportMode,
  mockDatabase: MockDatabase,
): SetupValidation {
  const setupValidation: SetupValidation = {
    is_valid: false,
    format: setupFormat,
    format_version: 0,
    upgraded_from_format_version: null,
    has_encrypted_secrets: setupText.includes("encrypted:v1:"),
    errors: [],
    summary: [],
    changes: [],
    removed_count: 0,
  };
  const readResult = readSetupText(setupText, setupFormat);
  if ("problem" in readResult) {
    setupValidation.errors = describeReadProblem(
      setupText,
      setupFormat,
      readResult,
    );

    return setupValidation;
  }
  const formatVersion = readFormatVersion(readResult.setupDocument);
  setupValidation.format_version = formatVersion;
  if (formatVersion > currentSetupFormatVersion) {
    setupValidation.errors.push({
      line: null,
      location: null,
      message: `This setup was exported in format ${formatVersion}; this SendMock reads up to format ${currentSetupFormatVersion}. Update SendMock to import it.`,
    });

    return setupValidation;
  }
  if (formatVersion < currentSetupFormatVersion) {
    setupValidation.upgraded_from_format_version = formatVersion;
  }
  if (setupFormat === "toml") {
    const seedValidation = validateSeedToml(setupText);
    setupValidation.summary = seedValidation.summary;
  }
  setupValidation.changes = previewSetupChanges(
    readResult.setupDocument,
    importMode,
    mockDatabase,
  );
  setupValidation.removed_count = setupValidation.changes.reduce(
    (removedCount, sectionChange) =>
      removedCount + sectionChange.removed.length,
    0,
  );
  setupValidation.is_valid = true;

  return setupValidation;
}

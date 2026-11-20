import { http, HttpResponse } from "msw";

import type {
  SetupExportRequest,
  SetupFileFormat,
  SetupImportRequest,
  SetupMigrateRequest,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";
import {
  buildSetupDocument,
  currentSetupFormatVersion,
  detectSetupFormat,
  readSetupText,
  type SetupDocument,
  writeSetupText,
} from "@/mocks/setup/mock-setup-document";
import { validateMockSetup } from "@/mocks/setup/mock-setup-validation";

const minimumPassphraseLength = 8;
const contentTypes: Record<SetupFileFormat, string> = {
  toml: "application/toml",
  json: "application/json",
  yaml: "application/yaml",
};

function respondWithSetupFile(
  setupText: string,
  setupFormat: SetupFileFormat,
): Response {
  return new HttpResponse(setupText, {
    headers: {
      "Content-Type": contentTypes[setupFormat],
      "Content-Disposition": `attachment; filename="sendmock.setup.${setupFormat}"`,
    },
  });
}

/** Keeps the sections `only` names (a section or its group) and drops the ones `except` names. */
function filterSections(
  setupDocument: SetupDocument,
  onlyNames: string[],
  exceptNames: string[],
): SetupDocument {
  const isNamed = (sectionName: string, names: string[]) =>
    names.some(
      (name) => name === sectionName || name.startsWith(`${sectionName}.`),
    );

  return Object.fromEntries(
    Object.entries(setupDocument).filter(
      ([sectionName]) =>
        sectionName === "sendmock" ||
        ((onlyNames.length === 0 || isNamed(sectionName, onlyNames)) &&
          !isNamed(sectionName, exceptNames)),
    ),
  );
}

/** The mock does not keep real secrets, so it writes a stand-in that looks like the real thing. */
function encryptReferences(setupText: string): string {
  return setupText.replace(
    /\$\{[A-Z0-9_]+\}/g,
    () =>
      `encrypted:v1:${btoa(crypto.randomUUID()).replace(/[=+/]/g, "")}:${btoa(crypto.randomUUID()).replace(/[=+/]/g, "")}`,
  );
}

function readSourceText(
  importRequest: SetupImportRequest,
): { setupText: string; setupFormat: SetupFileFormat } | Response {
  if ((importRequest.url ?? "") !== "") {
    return createErrorResponse(
      422,
      "setup_download_unavailable",
      "The demo cannot download setups; paste the file instead",
    );
  }
  const setupText = importRequest.setup_text ?? "";
  if (setupText === "") {
    return createErrorResponse(
      400,
      "invalid_input",
      "Give the setup's text in setup_text, or a url to download it from",
    );
  }

  return {
    setupText,
    setupFormat: importRequest.format ?? detectSetupFormat(setupText),
  };
}

/** The versioned setup file (A18): export, validate with a preview, import and migrate. */
export const setupHandlers = [
  http.post("*/api/v1/setup/export", async ({ request }) => {
    await applyMockConditions();
    const exportRequest = (await request.json()) as SetupExportRequest;
    const setupFormat = exportRequest.format ?? "toml";
    const passphrase = exportRequest.passphrase ?? "";
    if (
      exportRequest.include_secrets === true &&
      passphrase.length < minimumPassphraseLength
    ) {
      return createErrorResponse(
        400,
        "invalid_input",
        "The passphrase must be at least 8 characters",
      );
    }
    const setupDocument = filterSections(
      buildSetupDocument(mockDatabase),
      exportRequest.only ?? [],
      exportRequest.except ?? [],
    );
    const setupText = writeSetupText(setupDocument, setupFormat);

    return respondWithSetupFile(
      exportRequest.include_secrets === true
        ? encryptReferences(setupText)
        : setupText,
      setupFormat,
    );
  }),

  http.post("*/api/v1/setup/validate", async ({ request }) => {
    await applyMockConditions();
    const importRequest = (await request.json()) as SetupImportRequest;
    const setupSource = readSourceText(importRequest);
    if (setupSource instanceof Response) {
      return setupSource;
    }

    return HttpResponse.json(
      validateMockSetup(
        setupSource.setupText,
        setupSource.setupFormat,
        importRequest.mode ?? "merge",
        mockDatabase,
      ),
    );
  }),

  http.post("*/api/v1/setup/import", async ({ request }) => {
    await applyMockConditions();
    const importRequest = (await request.json()) as SetupImportRequest;
    const setupSource = readSourceText(importRequest);
    if (setupSource instanceof Response) {
      return setupSource;
    }
    const setupValidation = validateMockSetup(
      setupSource.setupText,
      setupSource.setupFormat,
      importRequest.mode ?? "merge",
      mockDatabase,
    );
    if (!setupValidation.is_valid) {
      return createErrorResponse(
        422,
        "invalid_seed",
        setupValidation.errors
          .map((setupError) => setupError.message)
          .join("; "),
      );
    }
    if (
      setupValidation.has_encrypted_secrets &&
      (importRequest.passphrase ?? "") === ""
    ) {
      return createErrorResponse(
        422,
        "setup_passphrase_required",
        "This setup holds encrypted secrets; give the passphrase it was exported with to import it",
      );
    }
    const removedCount = setupValidation.removed_count;
    const isUnconfirmed =
      importRequest.mode === "replace" &&
      removedCount > 0 &&
      importRequest.confirm_removed_count !== removedCount;
    if (isUnconfirmed) {
      return createErrorResponse(
        422,
        "setup_replace_unconfirmed",
        `This replace removes ${removedCount} items; send confirm_removed_count = ${removedCount} to go ahead`,
      );
    }
    // The demo keeps its configuration; it only records that a setup was applied.
    mockDatabase.seedAppliedAt = new Date().toISOString();

    return HttpResponse.json(setupValidation);
  }),

  http.post("*/api/v1/setup/migrate", async ({ request }) => {
    await applyMockConditions();
    const migrateRequest = (await request.json()) as SetupMigrateRequest;
    const sourceFormat =
      migrateRequest.format ?? detectSetupFormat(migrateRequest.setup_text);
    const readResult = readSetupText(migrateRequest.setup_text, sourceFormat);
    if ("problem" in readResult) {
      return createErrorResponse(422, "invalid_seed", readResult.problem);
    }
    const migratedDocument: SetupDocument = {
      ...readResult.setupDocument,
      sendmock: {
        format: "sendmock.setup",
        format_version: currentSetupFormatVersion,
      },
    };
    const targetFormat = migrateRequest.to_format ?? sourceFormat;

    return respondWithSetupFile(
      writeSetupText(migratedDocument, targetFormat),
      targetFormat,
    );
  }),
];

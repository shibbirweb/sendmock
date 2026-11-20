import * as React from "react";

import {
  useImportSetup,
  useValidateSetup,
} from "@/lib/api/hooks/use-setup-queries";
import type { SetupImportMode, SetupImportRequest } from "@/lib/api/types";

export type SetupSourceKind = "text" | "url";

export type SetupImportFields = {
  sourceKind: SetupSourceKind;
  setupText: string;
  url: string;
  sha256: string;
  headerLines: string;
  importMode: SetupImportMode;
  passphrase: string;
};

const emptyImportFields: SetupImportFields = {
  sourceKind: "text",
  setupText: "",
  url: "",
  sha256: "",
  headerLines: "",
  importMode: "merge",
  passphrase: "",
};

function readOptionalText(fieldText: string): string | null {
  return fieldText.trim() === "" ? null : fieldText.trim();
}

/** The request the fields describe, for both the preview and the import. */
export function buildImportRequest(
  importFields: SetupImportFields,
): SetupImportRequest {
  const isUrl = importFields.sourceKind === "url";

  return {
    setup_text: isUrl ? null : importFields.setupText,
    url: isUrl ? readOptionalText(importFields.url) : null,
    sha256: isUrl ? readOptionalText(importFields.sha256) : null,
    headers: isUrl
      ? importFields.headerLines
          .split("\n")
          .map((headerLine) => headerLine.trim())
          .filter((headerLine) => headerLine !== "")
      : [],
    mode: importFields.importMode,
    // Spaces can be part of a passphrase, so it is sent as typed.
    passphrase: importFields.passphrase === "" ? null : importFields.passphrase,
  };
}

/** The Import card's fields, its preview and the import, which needs a preview of the same request first (PL-18.8). */
export function useSetupImportForm() {
  const [importFields, setImportFields] =
    React.useState<SetupImportFields>(emptyImportFields);
  const validateSetup = useValidateSetup();
  const importSetup = useImportSetup();
  const importRequest = buildImportRequest(importFields);
  const setupPreview = validateSetup.data;
  const isPreviewCurrent =
    setupPreview !== undefined &&
    JSON.stringify(validateSetup.variables) === JSON.stringify(importRequest);
  const hasSource =
    importFields.sourceKind === "url"
      ? importFields.url.trim() !== ""
      : importFields.setupText.trim() !== "";

  const changeFields = (fieldChanges: Partial<SetupImportFields>) => {
    setImportFields((currentFields) => ({ ...currentFields, ...fieldChanges }));
  };

  return {
    importFields,
    changeFields,
    importRequest,
    hasSource,
    setupPreview: isPreviewCurrent ? setupPreview : undefined,
    previewError: validateSetup.error,
    isPreviewing: validateSetup.isPending,
    isImporting: importSetup.isPending,
    canImport: isPreviewCurrent && setupPreview.is_valid,
    startPreview: () => validateSetup.mutate(importRequest),
    startImport: (handlers: {
      onSuccess: () => void;
      onError: (importError: Error) => void;
    }) => {
      importSetup.mutate(
        {
          ...importRequest,
          confirm_removed_count: setupPreview?.removed_count ?? 0,
        },
        {
          onSuccess: () => {
            setImportFields(emptyImportFields);
            validateSetup.reset();
            handlers.onSuccess();
          },
          onError: handlers.onError,
        },
      );
    },
  };
}

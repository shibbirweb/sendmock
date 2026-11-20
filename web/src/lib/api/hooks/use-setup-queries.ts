import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi, requestApiTextWithBody } from "@/lib/api/api-client";
import type {
  SetupExportRequest,
  SetupImportRequest,
  SetupMigrateRequest,
  SetupValidation,
} from "@/lib/api/types";

/** Writes the current configuration as a setup file's text (PL-18.1). */
export function useExportSetup() {
  return useMutation({
    mutationFn: (exportRequest: SetupExportRequest) =>
      requestApiTextWithBody("/setup/export", {
        method: "POST",
        requestBody: exportRequest,
      }),
  });
}

/** Checks a setup and previews what importing it would change (PL-18.8). */
export function useValidateSetup() {
  return useMutation({
    mutationFn: (importRequest: SetupImportRequest) =>
      requestApi<SetupValidation>("/setup/validate", {
        method: "POST",
        requestBody: importRequest,
      }),
  });
}

export function useImportSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importRequest: SetupImportRequest) =>
      requestApi<SetupValidation>("/setup/import", {
        method: "POST",
        requestBody: importRequest,
      }),
    // A setup touches every kind of configuration.
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** Writes the upgraded copy of an older setup file (PL-18.3). */
export function useMigrateSetup() {
  return useMutation({
    mutationFn: (migrateRequest: SetupMigrateRequest) =>
      requestApiTextWithBody("/setup/migrate", {
        method: "POST",
        requestBody: migrateRequest,
      }),
  });
}

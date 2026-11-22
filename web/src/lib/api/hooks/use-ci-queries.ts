import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import type {
  CiInitFiles,
  CiInitRequest,
  CiReport,
  CiValidation,
  SignatureVerification,
  SignatureVerifyRequest,
} from "@/lib/api/types";

/** Checks a CI file without running it (WH-15.7). */
export function useValidateCiFile() {
  return useMutation({
    mutationFn: (ciFile: string) =>
      requestApi<CiValidation>("/ci/validate", {
        method: "POST",
        requestBody: { ci_file: ciFile },
      }),
  });
}

/** Runs a CI file's setup and scenarios on this instance. */
export function useRunCiFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ciFile: string) =>
      requestApi<CiReport>("/ci/run", {
        method: "POST",
        requestBody: { ci_file: ciFile },
      }),
    // The setup and the steps change configuration and traffic alike.
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** The files `sendmock ci init` writes, for one CI system. */
export function useCiInitFiles() {
  return useMutation({
    mutationFn: (initRequest: CiInitRequest) =>
      requestApi<CiInitFiles>("/ci/init", {
        method: "POST",
        requestBody: initRequest,
      }),
  });
}

/** Checks a captured request's webhook signature (WH-15.5). */
export function useVerifyWebhookSignature() {
  return useMutation({
    mutationFn: (verifyRequest: SignatureVerifyRequest) =>
      requestApi<SignatureVerification>("/webhooks/signatures/verify", {
        method: "POST",
        requestBody: verifyRequest,
      }),
  });
}

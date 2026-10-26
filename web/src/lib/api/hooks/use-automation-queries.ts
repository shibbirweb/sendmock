import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AiAgentSetup,
  NativeSendResult,
  OutcomeTestResult,
  ScenarioReport,
  ScenarioValidation,
} from "@/lib/api/types";

export function useValidateScenario() {
  return useMutation({
    mutationFn: (scenarioText: string) =>
      requestApi<ScenarioValidation>("/scenarios/validate", {
        method: "POST",
        requestBody: { scenario: scenarioText },
      }),
  });
}

export function useRunScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scenarioText: string) =>
      requestApi<ScenarioReport>("/scenarios/run", {
        method: "POST",
        requestBody: { scenario: scenarioText },
      }),
    // Steps create emails, SMS and deliveries; every list may have changed.
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

export function useAiAgents() {
  return useQuery({
    queryKey: queryKeys.aiAgents,
    queryFn: ({ signal }) =>
      requestApi<AiAgentSetup[]>("/ai/agents", { abortSignal: signal }),
  });
}

/** What happens to an address or number, as the API decides it (EM-10.6, SM-07.9). */
export function useOutcomeTest({
  ruleKind,
  testedValue,
  matchField = "to",
  settingsKey,
}: {
  ruleKind: "email" | "sms";
  testedValue: string;
  matchField?: "to" | "from";
  /** The settings the answer depends on, so a change asks again. */
  settingsKey: string;
}) {
  return useQuery({
    queryKey: [
      ...queryKeys.outcomeRules.test(ruleKind, testedValue, matchField),
      settingsKey,
    ],
    queryFn: ({ signal }) =>
      requestApi<OutcomeTestResult>(`/outcome-rules/${ruleKind}/test`, {
        method: "POST",
        requestBody:
          ruleKind === "email"
            ? { address: testedValue }
            : { number: testedValue, match_field: matchField },
        abortSignal: signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export type ImportedEmailKind = "sent" | "incoming";

/** Mail > Import .eml: a raw message as sent by the app, or as incoming mail. */
export function useImportEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rawMessage,
      importedKind,
    }: {
      rawMessage: string;
      importedKind: ImportedEmailKind;
    }) =>
      importedKind === "sent"
        ? requestApi<NativeSendResult>("/send/raw", {
            method: "POST",
            rawRequestBody: {
              content: rawMessage,
              contentType: "message/rfc822",
            },
          })
        : requestApi<NativeSendResult>("/emails/inbound", {
            method: "POST",
            requestBody: { raw: rawMessage },
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.emails.all });
    },
  });
}

/** Settings > Connection > Send this request: the edited email or SMS call, for real. */
export function useSendConnectionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      apiPath,
      requestBody,
      requestHeaders,
    }: {
      apiPath: "/send" | "/sms";
      requestBody: unknown;
      requestHeaders: Record<string, string>;
    }) =>
      requestApi<{ id: string }>(apiPath, {
        method: "POST",
        requestBody,
        headers: requestHeaders,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

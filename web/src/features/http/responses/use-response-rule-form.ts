import * as React from "react";

import {
  fromNameValueRows,
  type NameValueRow,
  toNameValueRows,
} from "@/components/common/name-value-rows-editor";
import type {
  HttpMethod,
  HttpMockResponse,
  HttpResponseRule,
} from "@/lib/api/types";
import {
  type ResponseRuleFieldErrors,
  validateResponseRule,
} from "@/lib/http/validate-response-rule";
import {
  type BuilderGroup,
  createNodeIdGenerator,
  toBuilderTree,
  toRuleFilter,
} from "@/lib/webhooks/rule-filter/builder-tree";

/** Status, headers and body as typed; the status stays text until saving. */
export type MockResponseFormValues = {
  statusCode: string;
  headerRows: NameValueRow[];
  body: string;
};

export type ResponseRuleFormValues = MockResponseFormValues & {
  name: string;
  isEnabled: boolean;
  method: HttpMethod | "any";
  pathGlob: string;
  rootGroup: BuilderGroup;
  delayMinMs: string;
  delayMaxMs: string;
  failureRatePercent: string;
  failureStatusCode: string;
};

export function toMockResponseFormValues(
  mockResponse: HttpMockResponse,
): MockResponseFormValues {
  return {
    statusCode: String(mockResponse.status_code),
    headerRows: toNameValueRows(mockResponse.headers),
    body: mockResponse.body,
  };
}

export function toMockResponse(
  formValues: MockResponseFormValues,
): HttpMockResponse {
  return {
    status_code: Number(formValues.statusCode),
    headers: fromNameValueRows(formValues.headerRows),
    body: formValues.body,
  };
}

const newRuleResponse: HttpMockResponse = {
  status_code: 200,
  headers: { "content-type": "application/json" },
  body: '{"ok":true}',
};

function toFormValues(
  editedRule: HttpResponseRule | null,
): ResponseRuleFormValues {
  return {
    ...toMockResponseFormValues(editedRule?.response ?? newRuleResponse),
    name: editedRule?.name ?? "",
    isEnabled: editedRule?.is_enabled ?? true,
    method: editedRule?.method ?? "any",
    pathGlob: editedRule?.path_glob ?? "",
    rootGroup: toBuilderTree(
      editedRule?.filter ?? null,
      createNodeIdGenerator(),
    ),
    delayMinMs: String(editedRule?.delay_min_ms ?? 0),
    delayMaxMs: String(editedRule?.delay_max_ms ?? 0),
    failureRatePercent: String(editedRule?.failure_rate_percent ?? 0),
    failureStatusCode: String(editedRule?.failure_status_code ?? 500),
  };
}

export function toResponseRule(
  formValues: ResponseRuleFormValues,
  ruleId: string,
): HttpResponseRule {
  return {
    id: ruleId,
    name: formValues.name.trim(),
    is_enabled: formValues.isEnabled,
    method: formValues.method === "any" ? null : formValues.method,
    path_glob: formValues.pathGlob.trim(),
    filter: toRuleFilter(formValues.rootGroup),
    response: toMockResponse(formValues),
    delay_min_ms: Number(formValues.delayMinMs),
    delay_max_ms: Number(formValues.delayMaxMs),
    failure_rate_percent: Number(formValues.failureRatePercent),
    failure_status_code: Number(formValues.failureStatusCode),
  };
}

/** State and validation for the rule sheet (HC-02.4). */
export function useResponseRuleForm(editedRule: HttpResponseRule | null) {
  // A new rule has no id yet; the API assigns one when the list is saved.
  const ruleId = editedRule?.id ?? "";
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedRule),
  );
  const [fieldErrors, setFieldErrors] = React.useState<ResponseRuleFieldErrors>(
    {},
  );
  const [hasTriedSaving, setHasTriedSaving] = React.useState(false);

  return {
    ruleId,
    formValues,
    fieldErrors,
    hasTriedSaving,
    updateFormValues: (changedValues: Partial<ResponseRuleFormValues>) => {
      setFormValues((previousValues) => ({
        ...previousValues,
        ...changedValues,
      }));
    },
    /** The rule when it is valid, else null with the errors shown. */
    validateForSave: (): HttpResponseRule | null => {
      const responseRule = toResponseRule(formValues, ruleId);
      const validationErrors = validateResponseRule(responseRule);
      setHasTriedSaving(true);
      setFieldErrors(validationErrors);

      return Object.keys(validationErrors).length === 0 ? responseRule : null;
    },
  };
}

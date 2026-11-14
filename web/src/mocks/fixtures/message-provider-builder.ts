import type {
  MessageProviderDefinition,
  ProviderErrorKind,
  ProviderErrorResponse,
  ProviderMessagePart,
  ProviderResponseTemplate,
  ProviderValidationRule,
} from "@/lib/api/types";

/** A stored provider: the definition without the values worked out when it is read. */
export type MessageProviderRecord = Omit<
  MessageProviderDefinition,
  "is_modified" | "message_count_24h"
>;

type ProviderFixtureInput = Pick<
  MessageProviderRecord,
  | "key"
  | "name"
  | "area"
  | "accent"
  | "host"
  | "operations"
  | "field_mapping"
  | "validation_rules"
  | "success_response"
  | "error_responses"
  | "message_id_template"
  | "callback_template_key"
  | "status_names"
> &
  Partial<
    Pick<
      MessageProviderRecord,
      "credentials" | "outcome_error_codes" | "is_builtin"
    >
  >;

/** A provider with the defaults every built-in shares (docs/plan/22-configurable-providers.md). */
export function buildProviderFixture(
  providerInput: ProviderFixtureInput,
): MessageProviderRecord {
  return {
    is_enabled: true,
    check_credentials: false,
    credentials: [],
    outcome_error_codes: {},
    is_builtin: true,
    is_removed: false,
    ...providerInput,
  };
}

export function respondWithJson(
  status: number,
  body: string,
  headers: ProviderResponseTemplate["headers"] = [],
): ProviderResponseTemplate {
  return {
    status,
    headers: [
      { name: "Content-Type", template: "application/json" },
      ...headers,
    ],
    body,
  };
}

export function answerError(
  kind: ProviderErrorKind,
  status: number,
  body: string,
): ProviderErrorResponse {
  return { kind, ...respondWithJson(status, body) };
}

export function requireParts(
  parts: ProviderMessagePart[],
): ProviderValidationRule[] {
  return parts.map((part) => ({
    part,
    check: "required",
    max_length: null,
    error_kind: "missing_field",
  }));
}

export function checkEmailAddresses(
  parts: ProviderMessagePart[],
): ProviderValidationRule[] {
  return parts.map((part) => ({
    part,
    check: "email_address",
    max_length: null,
    error_kind: "invalid_value",
  }));
}

export function checkPhoneNumbers(
  parts: ProviderMessagePart[],
): ProviderValidationRule[] {
  return parts.map((part) => ({
    part,
    check: "e164_number",
    max_length: null,
    error_kind: "invalid_value",
  }));
}

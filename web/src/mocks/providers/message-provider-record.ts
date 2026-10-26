import type {
  MessageProviderArea,
  MessageProviderDefinition,
  MessageProviderInput,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { buildBuiltinEmailProviders } from "@/mocks/fixtures/email-provider-fixtures";
import {
  buildProviderFixture,
  type MessageProviderRecord,
  respondWithJson,
} from "@/mocks/fixtures/message-provider-builder";
import { buildBuiltinSmsProviders } from "@/mocks/fixtures/sms-provider-fixtures";
import { mergeCredentials } from "@/mocks/payments/payment-gateway-record";
import { maskSecretValue } from "@/mocks/payments/render-gateway-templates";

type ProviderDatabase = Pick<
  MockDatabase,
  "messageProviders" | "emails" | "smsMessages"
>;

const editableFields = [
  "name",
  "accent",
  "is_enabled",
  "host",
  "credentials",
  "check_credentials",
  "operations",
  "field_mapping",
  "validation_rules",
  "success_response",
  "error_responses",
  "message_id_template",
  "callback_template_key",
  "status_names",
  "outcome_error_codes",
] as const;

const dayInMs = 24 * 60 * 60 * 1000;

export function buildBuiltinMessageProviders(): MessageProviderRecord[] {
  return [...buildBuiltinEmailProviders(), ...buildBuiltinSmsProviders()];
}

/** The shipped version of a built-in provider, or undefined for a custom one. */
export function findShippedProvider(
  providerArea: MessageProviderArea,
  providerKey: string,
): MessageProviderRecord | undefined {
  return buildBuiltinMessageProviders().find(
    (shippedProvider) =>
      shippedProvider.area === providerArea &&
      shippedProvider.key === providerKey,
  );
}

export function listAreaProviders(
  mockDatabase: Pick<MockDatabase, "messageProviders">,
  providerArea: MessageProviderArea,
): MessageProviderRecord[] {
  return mockDatabase.messageProviders.filter(
    (providerRecord) => providerRecord.area === providerArea,
  );
}

export function findProviderRecord(
  mockDatabase: Pick<MockDatabase, "messageProviders">,
  providerArea: MessageProviderArea,
  providerKey: string,
): MessageProviderRecord | undefined {
  return listAreaProviders(mockDatabase, providerArea).find(
    (providerRecord) => providerRecord.key === providerKey,
  );
}

function isModified(providerRecord: MessageProviderRecord): boolean {
  const shippedProvider = findShippedProvider(
    providerRecord.area,
    providerRecord.key,
  );
  if (!providerRecord.is_builtin || shippedProvider === undefined) {
    return false;
  }

  return editableFields.some(
    (fieldName) =>
      JSON.stringify(providerRecord[fieldName]) !==
      JSON.stringify(shippedProvider[fieldName]),
  );
}

/** Messages the provider caught in the last 24 hours. */
function countRecentMessages(
  mockDatabase: ProviderDatabase,
  providerRecord: MessageProviderRecord,
  nowMs: number,
): number {
  const isRecent = (timestamp: string) =>
    nowMs - new Date(timestamp).getTime() <= dayInMs;
  if (providerRecord.area === "email") {
    return mockDatabase.emails.filter(
      (email) =>
        email.source === providerRecord.key && isRecent(email.received_at),
    ).length;
  }

  return mockDatabase.smsMessages.filter(
    (smsMessage) =>
      smsMessage.api === providerRecord.key && isRecent(smsMessage.created_at),
  ).length;
}

/** A stored provider with secrets masked, Modified and its recent message count. */
export function presentMessageProvider(
  mockDatabase: ProviderDatabase,
  providerRecord: MessageProviderRecord,
  nowMs: number = Date.now(),
): MessageProviderDefinition {
  return {
    ...structuredClone(providerRecord),
    credentials: providerRecord.credentials.map((credential) =>
      credential.is_secret
        ? { ...credential, value: maskSecretValue(credential.value) }
        : credential,
    ),
    is_modified: isModified(providerRecord),
    message_count_24h: countRecentMessages(mockDatabase, providerRecord, nowMs),
  };
}

/** The input applied to a record; the key, area and built-in state stay. */
export function applyProviderInput(
  providerRecord: MessageProviderRecord,
  providerInput: MessageProviderInput,
): MessageProviderRecord {
  return {
    ...providerRecord,
    ...Object.fromEntries(
      editableFields.map((fieldName) => [fieldName, providerInput[fieldName]]),
    ),
    credentials: mergeCredentials(
      providerRecord.credentials,
      providerInput.credentials,
    ),
  };
}

/** A blank provider: one send request and nothing mapped yet. */
function buildBlankProvider(
  providerArea: MessageProviderArea,
): MessageProviderRecord {
  return buildProviderFixture({
    key: "blank",
    name: "Blank",
    area: providerArea,
    accent: "#64748b",
    host: null,
    is_builtin: false,
    operations: [
      { kind: "send", method: "POST", path: "/send", request_format: "json" },
    ],
    field_mapping: [],
    validation_rules: [],
    success_response: respondWithJson(
      200,
      '{"id": "{{ message.provider_id }}", "status": "queued"}',
    ),
    error_responses: [],
    message_id_template: "{{ uuid() }}",
    callback_template_key: null,
    status_names: {},
  });
}

/** A new custom provider, copied from another of the same area or blank. */
export function buildCustomProvider(
  mockDatabase: Pick<MockDatabase, "messageProviders">,
  providerArea: MessageProviderArea,
  providerKey: string,
  providerName: string,
  startFromKey: string | null,
): MessageProviderRecord {
  const startFrom =
    startFromKey === null
      ? undefined
      : findProviderRecord(mockDatabase, providerArea, startFromKey);
  const copiedProvider = structuredClone(
    startFrom ?? buildBlankProvider(providerArea),
  );

  return {
    ...copiedProvider,
    key: providerKey,
    name: providerName,
    is_builtin: false,
    is_removed: false,
    is_enabled: true,
    // A copy answers the same paths; a different host keeps the two apart.
    host: startFrom === undefined ? null : `${providerKey}.example.test`,
  };
}

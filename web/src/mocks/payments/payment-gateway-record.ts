import type {
  GatewayCredential,
  PaymentGatewayDefinition,
  PaymentGatewayInput,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  buildBuiltinPaymentGateways,
  type PaymentGatewayRecord,
} from "@/mocks/fixtures/payment-gateway-fixtures";
import { paymentEndpointName } from "@/mocks/fixtures/webhook-fixtures";
import { maskSecretValue } from "@/mocks/payments/render-gateway-templates";

type GatewayDatabase = Pick<
  MockDatabase,
  "paymentGateways" | "payments" | "webhookEndpoints"
>;

const editableFields = [
  "name",
  "accent",
  "is_enabled",
  "method_keys",
  "credentials",
  "notification_endpoint_id",
  "redirect_method",
  "redirect_fields",
  "notification_content_type",
  "event_names",
  "notification_body",
  "notification_headers",
] as const;

/** The endpoint built-in gateways notify: "Shop payments", when it exists. */
export function findShopEndpointId(
  mockDatabase: Pick<MockDatabase, "webhookEndpoints">,
): string | null {
  return (
    mockDatabase.webhookEndpoints.find(
      (webhookEndpoint) => webhookEndpoint.name === paymentEndpointName,
    )?.id ?? null
  );
}

/** The shipped version of a built-in gateway, or undefined for a custom one. */
export function findShippedGateway(
  mockDatabase: Pick<MockDatabase, "webhookEndpoints">,
  gatewayKey: string,
): PaymentGatewayRecord | undefined {
  return buildBuiltinPaymentGateways(findShopEndpointId(mockDatabase)).find(
    (shippedGateway) => shippedGateway.key === gatewayKey,
  );
}

export function findGatewayRecord(
  mockDatabase: Pick<MockDatabase, "paymentGateways">,
  gatewayKey: string,
): PaymentGatewayRecord | undefined {
  return mockDatabase.paymentGateways.find(
    (gatewayRecord) => gatewayRecord.key === gatewayKey,
  );
}

/** The gateway's name for a payment's provider key, or the key itself. */
export function readGatewayName(
  mockDatabase: Pick<MockDatabase, "paymentGateways">,
  gatewayKey: string,
): string {
  return findGatewayRecord(mockDatabase, gatewayKey)?.name ?? gatewayKey;
}

function isModified(
  mockDatabase: GatewayDatabase,
  gatewayRecord: PaymentGatewayRecord,
): boolean {
  const shippedGateway = findShippedGateway(mockDatabase, gatewayRecord.key);
  if (!gatewayRecord.is_builtin || shippedGateway === undefined) {
    return false;
  }

  return editableFields.some(
    (fieldName) =>
      JSON.stringify(gatewayRecord[fieldName]) !==
      JSON.stringify(shippedGateway[fieldName]),
  );
}

function maskCredentials(
  credentials: GatewayCredential[],
): GatewayCredential[] {
  return credentials.map((credential) =>
    credential.is_secret
      ? { ...credential, value: maskSecretValue(credential.value) }
      : credential,
  );
}

/** A stored gateway with secrets masked, usage and Modified state (PY-12.2). */
export function presentPaymentGateway(
  mockDatabase: GatewayDatabase,
  gatewayRecord: PaymentGatewayRecord,
): PaymentGatewayDefinition {
  return {
    ...structuredClone(gatewayRecord),
    credentials: maskCredentials(gatewayRecord.credentials),
    is_modified: isModified(mockDatabase, gatewayRecord),
    payment_count: mockDatabase.payments.filter(
      (payment) => payment.provider === gatewayRecord.key,
    ).length,
  };
}

/**
 * Credentials from the input, where a secret sent back masked (or empty)
 * keeps its stored value, so editing other fields never loses a secret.
 */
export function mergeCredentials(
  storedCredentials: GatewayCredential[],
  inputCredentials: GatewayCredential[],
): GatewayCredential[] {
  return inputCredentials.map((inputCredential) => {
    const storedCredential = storedCredentials.find(
      (candidate) => candidate.name === inputCredential.name,
    );
    const isUnchangedSecret =
      inputCredential.is_secret &&
      storedCredential !== undefined &&
      (inputCredential.value === "" ||
        inputCredential.value === maskSecretValue(storedCredential.value));

    return isUnchangedSecret
      ? { ...inputCredential, value: storedCredential.value }
      : inputCredential;
  });
}

/** The input applied to a record; the key and built-in stay as they were. */
export function applyGatewayInput(
  gatewayRecord: PaymentGatewayRecord,
  gatewayInput: PaymentGatewayInput,
): PaymentGatewayRecord {
  return {
    ...gatewayRecord,
    ...Object.fromEntries(
      editableFields.map((fieldName) => [fieldName, gatewayInput[fieldName]]),
    ),
    credentials: mergeCredentials(
      gatewayRecord.credentials,
      gatewayInput.credentials,
    ),
  };
}

/** A new custom gateway, copied from another gateway or blank (PY-12.2). */
export function buildCustomGateway(
  mockDatabase: GatewayDatabase,
  gatewayKey: string,
  gatewayName: string,
  startFromKey: string | null,
): PaymentGatewayRecord {
  const startFrom =
    startFromKey === null
      ? findShippedGateway(mockDatabase, "native")
      : findGatewayRecord(mockDatabase, startFromKey);
  const copiedGateway = structuredClone(
    startFrom ?? buildBuiltinPaymentGateways(null)[0],
  );

  return {
    ...copiedGateway,
    key: gatewayKey,
    name: gatewayName,
    is_builtin: false,
    is_enabled: true,
    method_keys: startFromKey === null ? ["card"] : copiedGateway.method_keys,
    notification_endpoint_id: findShopEndpointId(mockDatabase),
  };
}

import type {
  PaymentMethodDefinition,
  PaymentMethodInput,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  buildBuiltinPaymentMethods,
  type PaymentMethodRecord,
} from "@/mocks/fixtures/payment-method-fixtures";
import { findGatewayRecord } from "@/mocks/payments/payment-gateway-record";

type MethodDatabase = Pick<
  MockDatabase,
  "paymentMethods" | "payments" | "paymentGateways"
>;

const editableFields = [
  "name",
  "accent",
  "is_enabled",
  "test_cards",
  "test_numbers",
  "otp",
  "pin",
  "default_outcome",
  "test_account",
] as const;

/** The shipped version of a built-in method, or undefined for a custom one. */
export function findShippedMethod(
  methodKey: string,
): PaymentMethodRecord | undefined {
  return buildBuiltinPaymentMethods().find(
    (shippedMethod) => shippedMethod.key === methodKey,
  );
}

function isModified(methodRecord: PaymentMethodRecord): boolean {
  const shippedMethod = findShippedMethod(methodRecord.key);
  if (!methodRecord.is_builtin || shippedMethod === undefined) {
    return false;
  }

  return editableFields.some(
    (fieldName) =>
      JSON.stringify(methodRecord[fieldName]) !==
      JSON.stringify(shippedMethod[fieldName]),
  );
}

/** A stored method with its gateways, usage and Modified state (PY-12.1). */
export function presentPaymentMethod(
  mockDatabase: MethodDatabase,
  methodRecord: PaymentMethodRecord,
): PaymentMethodDefinition {
  return {
    ...methodRecord,
    is_modified: isModified(methodRecord),
    gateway_keys: mockDatabase.paymentGateways
      .filter((gatewayRecord) =>
        gatewayRecord.method_keys.includes(methodRecord.key),
      )
      .map((gatewayRecord) => gatewayRecord.key),
    payment_count: mockDatabase.payments.filter(
      (payment) => payment.method_key === methodRecord.key,
    ).length,
  };
}

/** The input applied to a record; key, flow and built-in stay as they were. */
export function applyMethodInput(
  methodRecord: PaymentMethodRecord,
  methodInput: PaymentMethodInput,
): PaymentMethodRecord {
  return {
    ...methodRecord,
    ...Object.fromEntries(
      editableFields.map((fieldName) => [fieldName, methodInput[fieldName]]),
    ),
  };
}

/** The enabled methods a gateway's checkout offers, in order (PY-12.3). */
export function listGatewayMethods(
  mockDatabase: MethodDatabase,
  gatewayKey: string,
): PaymentMethodDefinition[] {
  const methodKeys =
    findGatewayRecord(mockDatabase, gatewayKey)?.method_keys ?? [];

  return methodKeys
    .map((methodKey) =>
      mockDatabase.paymentMethods.find(
        (methodRecord) => methodRecord.key === methodKey,
      ),
    )
    .filter(
      (methodRecord): methodRecord is PaymentMethodRecord =>
        methodRecord !== undefined && methodRecord.is_enabled,
    )
    .map((methodRecord) => presentPaymentMethod(mockDatabase, methodRecord));
}

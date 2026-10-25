import type { PaymentFlowDefinition, PaymentFlowInput } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  buildBuiltinPaymentFlows,
  type PaymentFlowRecord,
} from "@/mocks/fixtures/payment-flow-fixtures";

type FlowDatabase = Pick<MockDatabase, "paymentFlows" | "paymentMethods">;

const editableFields = ["name", "picker_tab", "steps"] as const;

/** The shipped version of a built-in flow, or undefined for a custom one. */
export function findShippedFlow(
  flowKey: string,
): PaymentFlowRecord | undefined {
  return buildBuiltinPaymentFlows().find(
    (shippedFlow) => shippedFlow.key === flowKey,
  );
}

function isModified(flowRecord: PaymentFlowRecord): boolean {
  const shippedFlow = findShippedFlow(flowRecord.key);
  if (!flowRecord.is_builtin || shippedFlow === undefined) {
    return false;
  }

  return editableFields.some(
    (fieldName) =>
      JSON.stringify(flowRecord[fieldName]) !==
      JSON.stringify(shippedFlow[fieldName]),
  );
}

/** A stored flow with its usage and Modified state (PY-12.6). */
export function presentPaymentFlow(
  mockDatabase: FlowDatabase,
  flowRecord: PaymentFlowRecord,
): PaymentFlowDefinition {
  return {
    ...flowRecord,
    is_modified: isModified(flowRecord),
    method_count: mockDatabase.paymentMethods.filter(
      (methodRecord) => methodRecord.flow === flowRecord.key,
    ).length,
  };
}

/** The input applied to a record; the key and built-in stay as they were. */
export function applyFlowInput(
  flowRecord: PaymentFlowRecord,
  flowInput: PaymentFlowInput,
): PaymentFlowRecord {
  return {
    ...flowRecord,
    name: flowInput.name,
    picker_tab: flowInput.picker_tab,
    steps: flowInput.steps,
  };
}

export function findFlowRecord(
  mockDatabase: Pick<MockDatabase, "paymentFlows">,
  flowKey: string,
): PaymentFlowRecord | undefined {
  return mockDatabase.paymentFlows.find(
    (flowRecord) => flowRecord.key === flowKey,
  );
}

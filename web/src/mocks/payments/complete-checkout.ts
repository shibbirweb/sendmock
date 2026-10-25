import type {
  CheckoutAction,
  CheckoutCompleteRequest,
  CheckoutState,
  PaymentDetail,
  PaymentMethodDefinition,
  PaymentStepType,
} from "@/lib/api/types";
import {
  type FlowOutcome,
  runPaymentFlow,
} from "@/lib/payments/run-payment-flow";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { readCheckoutState } from "@/mocks/payments/checkout-session";
import { findFlowRecord } from "@/mocks/payments/payment-flow-record";
import { listGatewayMethods } from "@/mocks/payments/payment-method-record";
import {
  addTimeline,
  finishCheckout,
  firePaymentEvents,
  type PaymentDatabase,
  type SimulationResult,
  simulatePayment,
} from "@/mocks/payments/simulate-payment";

type CheckoutDatabase = PaymentDatabase &
  Pick<
    MockDatabase,
    | "paymentMethods"
    | "paymentFlows"
    | "payments"
    | "paymentGateways"
    | "settings"
  >;

const actionsByState: Partial<Record<CheckoutState, CheckoutAction[]>> = {
  open: ["pay", "decline", "cancel", "delay", "require_three_ds"],
  requires_three_ds: ["three_ds_approve", "three_ds_fail", "cancel"],
};

const refused = (statusCode: 409 | 422, message: string): SimulationResult => ({
  isApplied: false,
  statusCode,
  message,
});

type CheckoutStep = (
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
  checkoutRequest: CheckoutCompleteRequest,
  nowMs: number,
) => SimulationResult;

const showThreeDsStep: CheckoutStep = (
  _mockDatabase,
  paymentDetail,
  _checkoutRequest,
  nowMs,
) => {
  paymentDetail.status = "requires_action";
  addTimeline(
    paymentDetail,
    "three_ds",
    "3-D Secure challenge shown",
    new Date(nowMs).toISOString(),
  );

  return { isApplied: true };
};

const succeed = (
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
  nowMs: number,
) => simulatePayment(mockDatabase, paymentDetail, { action: "succeed" }, nowMs);

type OutcomeStep = (
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
  flowOutcome: FlowOutcome,
  nowMs: number,
) => SimulationResult;

/** What each flow outcome does to the payment (PY-03.1, PY-12.6). */
const outcomeSteps: Record<FlowOutcome["kind"], OutcomeStep> = {
  succeed: (mockDatabase, paymentDetail, _flowOutcome, nowMs) =>
    succeed(mockDatabase, paymentDetail, nowMs),
  succeed_then_dispute: (mockDatabase, paymentDetail, _flowOutcome, nowMs) => {
    succeed(mockDatabase, paymentDetail, nowMs);
    return simulatePayment(
      mockDatabase,
      paymentDetail,
      { action: "dispute" },
      nowMs + 10,
    );
  },
  three_ds: (mockDatabase, paymentDetail, _flowOutcome, nowMs) =>
    showThreeDsStep(mockDatabase, paymentDetail, { action: "pay" }, nowMs),
  decline: (mockDatabase, paymentDetail, flowOutcome, nowMs) =>
    simulatePayment(
      mockDatabase,
      paymentDetail,
      {
        action: "decline",
        decline_reason:
          flowOutcome.kind === "decline" ? flowOutcome.reason : undefined,
      },
      nowMs,
    ),
};

function hasStep(
  mockDatabase: CheckoutDatabase,
  paymentMethod: PaymentMethodDefinition,
  stepTypes: PaymentStepType[],
): boolean {
  return (findFlowRecord(mockDatabase, paymentMethod.flow)?.steps ?? []).some(
    (flowStep) => stepTypes.includes(flowStep.type),
  );
}

/** The method named in the request, else the first one whose flow fits what was sent. */
function findCheckoutMethod(
  mockDatabase: CheckoutDatabase,
  gatewayMethods: PaymentMethodDefinition[],
  checkoutRequest: CheckoutCompleteRequest,
): PaymentMethodDefinition | undefined {
  if (checkoutRequest.method_key !== undefined) {
    return gatewayMethods.find(
      (paymentMethod) => paymentMethod.key === checkoutRequest.method_key,
    );
  }
  const wantedSteps: PaymentStepType[] | undefined =
    checkoutRequest.card !== undefined
      ? ["card_form"]
      : checkoutRequest.entries?.number !== undefined
        ? ["account_number", "voucher_code"]
        : undefined;

  return wantedSteps === undefined
    ? gatewayMethods[0]
    : gatewayMethods.find((paymentMethod) =>
        hasStep(mockDatabase, paymentMethod, wantedSteps),
      );
}

/** Runs the method's flow steps against its test values, then applies the outcome (PY-12.6). */
const payStep: CheckoutStep = (
  mockDatabase,
  paymentDetail,
  checkoutRequest,
  nowMs,
) => {
  const paymentMethod = findCheckoutMethod(
    mockDatabase,
    listGatewayMethods(mockDatabase, paymentDetail.provider),
    checkoutRequest,
  );
  if (paymentMethod === undefined) {
    return refused(422, "This checkout does not offer that payment method");
  }
  const flowRecord = findFlowRecord(mockDatabase, paymentMethod.flow);
  if (flowRecord === undefined) {
    return refused(422, `The ${paymentMethod.name} flow no longer exists`);
  }
  const flowRun = runPaymentFlow(
    flowRecord.steps,
    paymentMethod,
    checkoutRequest,
  );
  if (flowRun.kind === "refused") {
    return refused(422, flowRun.message);
  }
  paymentDetail.method = flowRun.paidWith;
  paymentDetail.method_key = paymentMethod.key;

  return outcomeSteps[flowRun.outcome.kind](
    mockDatabase,
    paymentDetail,
    flowRun.outcome,
    nowMs,
  );
};

const cancelStep: CheckoutStep = (
  mockDatabase,
  paymentDetail,
  _checkoutRequest,
  nowMs,
) => {
  const createdAt = new Date(nowMs).toISOString();
  paymentDetail.status = "canceled";
  addTimeline(paymentDetail, "canceled", "Canceled by the customer", createdAt);
  finishCheckout(mockDatabase, paymentDetail, "cancel", createdAt);
  firePaymentEvents(mockDatabase, paymentDetail, ["payment.canceled"], nowMs);

  return { isApplied: true };
};

/** One step per page action (PY-03.1). */
const checkoutSteps: Record<CheckoutAction, CheckoutStep> = {
  pay: payStep,
  decline: (mockDatabase, paymentDetail, checkoutRequest, nowMs) =>
    simulatePayment(
      mockDatabase,
      paymentDetail,
      {
        action: "decline",
        decline_reason: checkoutRequest.decline_reason ?? "generic_decline",
      },
      nowMs,
    ),
  cancel: cancelStep,
  delay: (_mockDatabase, paymentDetail, _checkoutRequest, nowMs) => {
    paymentDetail.checkout_url = null;
    addTimeline(
      paymentDetail,
      "delayed",
      "The customer finished; the payment settles later",
      new Date(nowMs).toISOString(),
    );
    return { isApplied: true };
  },
  require_three_ds: showThreeDsStep,
  three_ds_approve: (mockDatabase, paymentDetail, _checkoutRequest, nowMs) => {
    addTimeline(
      paymentDetail,
      "three_ds",
      "3-D Secure approved",
      new Date(nowMs).toISOString(),
    );
    return succeed(mockDatabase, paymentDetail, nowMs);
  },
  three_ds_fail: (mockDatabase, paymentDetail, _checkoutRequest, nowMs) => {
    addTimeline(
      paymentDetail,
      "three_ds",
      "3-D Secure failed",
      new Date(nowMs).toISOString(),
    );
    return simulatePayment(
      mockDatabase,
      paymentDetail,
      { action: "decline", decline_reason: "authentication_failed" },
      nowMs,
    );
  },
};

/**
 * The test checkout page's actions (PY-03.1, PY-12.3): pay with one of the
 * gateway's methods using its own test values, decline, cancel, delay and
 * 3-D Secure; a closed session cannot be paid again (PY-03.3).
 */
export function completeCheckout(
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
  checkoutRequest: CheckoutCompleteRequest,
  nowMs: number = Date.now(),
): SimulationResult {
  const checkoutState = readCheckoutState(paymentDetail);
  if (!(actionsByState[checkoutState] ?? []).includes(checkoutRequest.action)) {
    return refused(409, "This checkout is closed and cannot be paid again");
  }

  return checkoutSteps[checkoutRequest.action](
    mockDatabase,
    paymentDetail,
    checkoutRequest,
    nowMs,
  );
}

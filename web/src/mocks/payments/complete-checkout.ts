import type {
  CheckoutAction,
  CheckoutCompleteRequest,
  CheckoutSession,
  CheckoutState,
  PaymentDetail,
  PaymentMethodDefinition,
  PaymentMethodFlow,
} from "@/lib/api/types";
import {
  checkCardNumber,
  checkWallet,
  readCardBrand,
  toCardDigits,
} from "@/lib/payments/test-instruments";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { builtinGatewayAccents } from "@/mocks/fixtures/payment-method-fixtures";
import { listGatewayMethods } from "@/mocks/payments/payment-method-record";
import {
  addTimeline,
  finishCheckout,
  firePaymentEvents,
  type PaymentDatabase,
  type SimulationResult,
  simulatePayment,
} from "@/mocks/payments/simulate-payment";

const merchantName = "Acme Shop";

type CheckoutDatabase = PaymentDatabase &
  Pick<MockDatabase, "paymentMethods" | "payments">;

/** Where the checkout stands for the customer, from the payment (PY-03.3). */
export function readCheckoutState(paymentDetail: PaymentDetail): CheckoutState {
  if (paymentDetail.status === "requires_action") {
    return "requires_three_ds";
  }
  if (paymentDetail.status === "requires_payment") {
    return paymentDetail.checkout_url === null ? "pending" : "open";
  }
  if (paymentDetail.status === "failed") {
    return "failed";
  }
  if (paymentDetail.status === "canceled") {
    return paymentDetail.failure_code === "expired" ? "expired" : "canceled";
  }

  return "completed";
}

export function toCheckoutSession(
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
): CheckoutSession {
  return {
    session_id: paymentDetail.id,
    payment_id: paymentDetail.id,
    provider: paymentDetail.provider,
    merchant_name: merchantName,
    amount_minor: paymentDetail.amount_minor,
    currency: paymentDetail.currency,
    line_items: paymentDetail.line_items,
    customer_email: paymentDetail.customer_email,
    accent: builtinGatewayAccents[paymentDetail.provider],
    methods: listGatewayMethods(mockDatabase, paymentDetail.provider),
    state: readCheckoutState(paymentDetail),
    failure_code: paymentDetail.failure_code,
    redirect: paymentDetail.redirect,
  };
}

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

type FlowPayment = (
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
  paymentMethod: PaymentMethodDefinition,
  checkoutRequest: CheckoutCompleteRequest,
  nowMs: number,
) => SimulationResult;

const succeed = (
  mockDatabase: CheckoutDatabase,
  paymentDetail: PaymentDetail,
  nowMs: number,
) => simulatePayment(mockDatabase, paymentDetail, { action: "succeed" }, nowMs);

const payWithCard: FlowPayment = (
  mockDatabase,
  paymentDetail,
  paymentMethod,
  checkoutRequest,
  nowMs,
) => {
  const checkoutCard = checkoutRequest.card;
  if (checkoutCard === undefined) {
    return refused(422, "Enter a card");
  }
  const cardCheck = checkCardNumber(
    checkoutCard.number,
    paymentMethod.test_cards,
  );
  if (cardCheck.kind === "invalid") {
    return refused(422, "Enter a valid card number");
  }
  if (cardCheck.kind === "not_test_card") {
    // A real card: refused before anything about it is kept (PY-01.1).
    return refused(
      422,
      "Use a test card: real card numbers are never accepted",
    );
  }
  const cardDigits = toCardDigits(checkoutCard.number);
  paymentDetail.method = {
    kind: "card",
    brand: readCardBrand(cardDigits),
    last4: cardDigits.slice(-4),
    exp_month: checkoutCard.exp_month,
    exp_year: checkoutCard.exp_year,
  };
  const { testCard } = cardCheck;
  if (testCard.outcome === "three_ds") {
    return showThreeDsStep(mockDatabase, paymentDetail, checkoutRequest, nowMs);
  }
  if (testCard.outcome === "decline") {
    return simulatePayment(
      mockDatabase,
      paymentDetail,
      {
        action: "decline",
        decline_reason: testCard.decline_reason ?? "generic_decline",
      },
      nowMs,
    );
  }
  const paidResult = succeed(mockDatabase, paymentDetail, nowMs);

  return testCard.outcome === "succeed_then_dispute"
    ? simulatePayment(
        mockDatabase,
        paymentDetail,
        { action: "dispute" },
        nowMs + 10,
      )
    : paidResult;
};

const payWithWallet: FlowPayment = (
  mockDatabase,
  paymentDetail,
  paymentMethod,
  checkoutRequest,
  nowMs,
) => {
  const checkoutWallet = checkoutRequest.wallet;
  if (checkoutWallet === undefined) {
    return refused(422, "Enter a wallet number");
  }
  const walletCheck = checkWallet(
    paymentMethod,
    checkoutWallet.number,
    checkoutWallet.otp,
    checkoutWallet.pin,
  );
  if (walletCheck.kind === "error") {
    return refused(422, walletCheck.message);
  }
  if (walletCheck.kind === "wrong_pin") {
    return refused(422, "Wrong PIN. Try again.");
  }
  const walletDigits = checkoutWallet.number.replace(/\D/g, "");
  paymentDetail.method = {
    kind: "wallet",
    wallet_name: paymentMethod.name,
    masked_number: `${walletDigits.slice(0, 5)}****${walletDigits.slice(-2)}`,
  };

  return walletCheck.kind === "decline"
    ? simulatePayment(
        mockDatabase,
        paymentDetail,
        { action: "decline", decline_reason: walletCheck.reason },
        nowMs,
      )
    : succeed(mockDatabase, paymentDetail, nowMs);
};

/** One way to pay per flow; a new flow adds an entry (PY-12.3). */
const flowPayments: Record<PaymentMethodFlow, FlowPayment> = {
  card: payWithCard,
  wallet: payWithWallet,
  bank: (
    mockDatabase,
    paymentDetail,
    paymentMethod,
    _checkoutRequest,
    nowMs,
  ) => {
    paymentDetail.method = { kind: "bank", bank_name: paymentMethod.name };
    return paymentMethod.bank_outcome === "decline"
      ? simulatePayment(
          mockDatabase,
          paymentDetail,
          { action: "decline", decline_reason: "generic_decline" },
          nowMs,
        )
      : succeed(mockDatabase, paymentDetail, nowMs);
  },
  account: (
    mockDatabase,
    paymentDetail,
    paymentMethod,
    _checkoutRequest,
    nowMs,
  ) => {
    paymentDetail.method = {
      kind: "wallet",
      wallet_name: paymentMethod.name,
      masked_number: paymentMethod.test_account,
    };
    return succeed(mockDatabase, paymentDetail, nowMs);
  },
};

/** The method named in the request, else the first one that fits what was sent. */
function findCheckoutMethod(
  gatewayMethods: PaymentMethodDefinition[],
  checkoutRequest: CheckoutCompleteRequest,
): PaymentMethodDefinition | undefined {
  if (checkoutRequest.method_key !== undefined) {
    return gatewayMethods.find(
      (paymentMethod) => paymentMethod.key === checkoutRequest.method_key,
    );
  }
  const wantedFlow: PaymentMethodFlow | undefined =
    checkoutRequest.card !== undefined
      ? "card"
      : checkoutRequest.wallet !== undefined
        ? "wallet"
        : undefined;

  return wantedFlow === undefined
    ? gatewayMethods[0]
    : gatewayMethods.find((paymentMethod) => paymentMethod.flow === wantedFlow);
}

const payStep: CheckoutStep = (
  mockDatabase,
  paymentDetail,
  checkoutRequest,
  nowMs,
) => {
  const paymentMethod = findCheckoutMethod(
    listGatewayMethods(mockDatabase, paymentDetail.provider),
    checkoutRequest,
  );
  if (paymentMethod === undefined) {
    return refused(422, "This checkout does not offer that payment method");
  }
  const payResult = flowPayments[paymentMethod.flow](
    mockDatabase,
    paymentDetail,
    paymentMethod,
    checkoutRequest,
    nowMs,
  );
  if (payResult.isApplied) {
    paymentDetail.method_key = paymentMethod.key;
  }

  return payResult;
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
  finishCheckout(paymentDetail, "cancel", createdAt);
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

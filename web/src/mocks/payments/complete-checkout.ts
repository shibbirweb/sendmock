import type {
  CheckoutAction,
  CheckoutCompleteRequest,
  CheckoutSession,
  CheckoutState,
  PaymentDetail,
  PaymentMethod,
} from "@/lib/api/types";
import {
  checkCardNumber,
  checkWallet,
  readCardBrand,
  toCardDigits,
} from "@/lib/payments/test-instruments";
import {
  addTimeline,
  finishCheckout,
  firePaymentEvents,
  type PaymentDatabase,
  type SimulationResult,
  simulatePayment,
} from "@/mocks/payments/simulate-payment";

const merchantName = "Acme Shop";

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

/** The method a non-card option pays with: PayPal account, a wallet or a bank. */
function readOptionMethod(
  paymentDetail: PaymentDetail,
  paymentOption: string | undefined,
): PaymentMethod {
  if (paymentDetail.provider === "paypal") {
    return {
      kind: "wallet",
      wallet_name: "PayPal",
      masked_number: "sb-buyer@personal.example.com",
    };
  }
  const walletNames: Record<string, string> = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
  };
  const walletName = walletNames[paymentOption ?? ""];

  return walletName === undefined
    ? { kind: "bank", bank_name: (paymentOption ?? "bank").toUpperCase() }
    : { kind: "wallet", wallet_name: walletName, masked_number: "01770****01" };
}

function payWithCard(
  mockDatabase: PaymentDatabase,
  paymentDetail: PaymentDetail,
  checkoutRequest: CheckoutCompleteRequest,
  nowMs: number,
): SimulationResult {
  const checkoutCard = checkoutRequest.card;
  if (checkoutCard === undefined) {
    return refused(422, "Enter a card");
  }
  const cardCheck = checkCardNumber(checkoutCard.number);
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
  const { outcome } = cardCheck;
  if (outcome.kind === "three_ds") {
    return showThreeDsStep(mockDatabase, paymentDetail, checkoutRequest, nowMs);
  }
  if (outcome.kind === "decline") {
    return simulatePayment(
      mockDatabase,
      paymentDetail,
      { action: "decline", decline_reason: outcome.reason },
      nowMs,
    );
  }
  const paidResult = simulatePayment(
    mockDatabase,
    paymentDetail,
    { action: "succeed" },
    nowMs,
  );

  return outcome.kind === "succeed_then_dispute"
    ? simulatePayment(
        mockDatabase,
        paymentDetail,
        { action: "dispute" },
        nowMs + 10,
      )
    : paidResult;
}

function payWithWallet(
  mockDatabase: PaymentDatabase,
  paymentDetail: PaymentDetail,
  checkoutRequest: CheckoutCompleteRequest,
  nowMs: number,
): SimulationResult {
  const checkoutWallet = checkoutRequest.wallet;
  if (checkoutWallet === undefined) {
    return refused(422, "Enter a wallet number");
  }
  const walletOutcome = checkWallet(
    checkoutWallet.number,
    checkoutWallet.otp,
    checkoutWallet.pin,
  );
  if (walletOutcome.kind === "error") {
    return refused(422, walletOutcome.message);
  }
  if (walletOutcome.kind === "wrong_pin") {
    return refused(422, "Wrong PIN. Try again.");
  }
  const walletDigits = checkoutWallet.number.replace(/\D/g, "");
  paymentDetail.method = {
    kind: "wallet",
    wallet_name: "bKash",
    masked_number: `${walletDigits.slice(0, 5)}****${walletDigits.slice(-2)}`,
  };

  return walletOutcome.kind === "decline"
    ? simulatePayment(
        mockDatabase,
        paymentDetail,
        { action: "decline", decline_reason: walletOutcome.reason },
        nowMs,
      )
    : simulatePayment(
        mockDatabase,
        paymentDetail,
        { action: "succeed" },
        nowMs,
      );
}

type CheckoutStep = (
  mockDatabase: PaymentDatabase,
  paymentDetail: PaymentDetail,
  checkoutRequest: CheckoutCompleteRequest,
  nowMs: number,
) => SimulationResult;

const payStep: CheckoutStep = (
  mockDatabase,
  paymentDetail,
  checkoutRequest,
  nowMs,
) => {
  if (checkoutRequest.card !== undefined) {
    return payWithCard(mockDatabase, paymentDetail, checkoutRequest, nowMs);
  }
  if (checkoutRequest.wallet !== undefined) {
    return payWithWallet(mockDatabase, paymentDetail, checkoutRequest, nowMs);
  }
  paymentDetail.method = readOptionMethod(
    paymentDetail,
    checkoutRequest.payment_option,
  );

  return simulatePayment(
    mockDatabase,
    paymentDetail,
    { action: "succeed" },
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
  finishCheckout(paymentDetail, "cancel", createdAt);
  firePaymentEvents(mockDatabase, paymentDetail, ["payment.canceled"], nowMs);

  return { isApplied: true };
};

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
    return simulatePayment(
      mockDatabase,
      paymentDetail,
      { action: "succeed" },
      nowMs,
    );
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
 * The test checkout page's actions (PY-03.1): pay with a test card or
 * wallet, decline, cancel, delay and 3-D Secure, each with its redirect and
 * notification; a closed session cannot be paid again (PY-03.3).
 */
export function completeCheckout(
  mockDatabase: PaymentDatabase,
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

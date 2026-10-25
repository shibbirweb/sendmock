import type { PaymentDetail, PaymentRedirect } from "@/lib/api/types";

type RedirectOutcome = PaymentRedirect["outcome"];

function readRedirectUrl(
  paymentDetail: PaymentDetail,
  redirectOutcome: RedirectOutcome,
): string | null {
  const redirectUrls: Record<RedirectOutcome, string | null> = {
    success: paymentDetail.success_url,
    fail: paymentDetail.fail_url,
    cancel: paymentDetail.cancel_url,
  };

  return redirectUrls[redirectOutcome];
}

/** The parameters each provider sends back to the app (PY-06.4 shapes). */
function readRedirectFields(
  paymentDetail: PaymentDetail,
  redirectOutcome: RedirectOutcome,
): { method: PaymentRedirect["method"]; fields: Record<string, string> } {
  const reference = paymentDetail.provider_reference;
  if (paymentDetail.provider === "sslcommerz") {
    const statusWords: Record<RedirectOutcome, string> = {
      success: "VALID",
      fail: "FAILED",
      cancel: "CANCELLED",
    };
    return {
      method: "POST",
      fields: {
        tran_id: reference,
        val_id: paymentDetail.provider_ids.val_id ?? "",
        amount: (paymentDetail.amount_minor / 100).toFixed(2),
        currency: paymentDetail.currency,
        status: statusWords[redirectOutcome],
      },
    };
  }
  if (paymentDetail.provider === "stripe") {
    return { method: "GET", fields: { session_id: reference } };
  }
  if (paymentDetail.provider === "paypal") {
    return {
      method: "GET",
      fields:
        redirectOutcome === "success"
          ? { token: reference, PayerID: "TESTPAYER01" }
          : { token: reference },
    };
  }
  if (paymentDetail.provider === "bkash") {
    const statusWords: Record<RedirectOutcome, string> = {
      success: "success",
      fail: "failure",
      cancel: "cancel",
    };
    return {
      method: "GET",
      fields: { paymentID: reference, status: statusWords[redirectOutcome] },
    };
  }

  return {
    method: "GET",
    fields: { payment_id: paymentDetail.id, outcome: redirectOutcome },
  };
}

/** Where the browser goes after checkout, or null when the app set no URL. */
export function buildPaymentRedirect(
  paymentDetail: PaymentDetail,
  redirectOutcome: RedirectOutcome,
  redirectedAt: string,
): PaymentRedirect | null {
  const redirectUrl = readRedirectUrl(paymentDetail, redirectOutcome);
  if (redirectUrl === null) {
    return null;
  }

  return {
    outcome: redirectOutcome,
    url: redirectUrl,
    redirected_at: redirectedAt,
    ...readRedirectFields(paymentDetail, redirectOutcome),
  };
}

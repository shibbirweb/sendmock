import type { PaymentDetail, PaymentRedirect } from "@/lib/api/types";
import type { PaymentGatewayRecord } from "@/mocks/fixtures/payment-gateway-fixtures";
import { renderGatewayRedirect } from "@/mocks/payments/render-gateway-templates";

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

/**
 * Where the browser goes after checkout, with the fields the gateway sends
 * back (PY-06.4 shapes, PY-12.3), or null when the app set no URL.
 */
export function buildPaymentRedirect(
  paymentGateway: PaymentGatewayRecord | undefined,
  paymentDetail: PaymentDetail,
  redirectOutcome: RedirectOutcome,
  redirectedAt: string,
): PaymentRedirect | null {
  const redirectUrl = readRedirectUrl(paymentDetail, redirectOutcome);
  if (redirectUrl === null) {
    return null;
  }
  const renderedRedirect =
    paymentGateway === undefined
      ? { method: "GET" as const, fields: {} }
      : renderGatewayRedirect(paymentGateway, paymentDetail, {
          eventType: "payment.succeeded",
          redirectOutcome,
          eventId: "",
          timestampSeconds: Math.floor(Date.parse(redirectedAt) / 1000),
          shouldMaskSecrets: false,
        });

  return {
    outcome: redirectOutcome,
    url: redirectUrl,
    method: renderedRedirect.method,
    fields: renderedRedirect.fields,
    redirected_at: redirectedAt,
  };
}

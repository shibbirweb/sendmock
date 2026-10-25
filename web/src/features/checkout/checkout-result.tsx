import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CheckoutSession,
  CheckoutState,
  PaymentRedirect,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const resultTexts: Partial<
  Record<
    CheckoutState,
    { title: string; icon: LucideIcon; toneClassName: string }
  >
> = {
  completed: {
    title: "Payment successful",
    icon: CircleCheckIcon,
    toneClassName: "text-success",
  },
  failed: {
    title: "Payment declined",
    icon: CircleXIcon,
    toneClassName: "text-destructive",
  },
  canceled: {
    title: "Payment canceled",
    icon: CircleXIcon,
    toneClassName: "text-muted-foreground",
  },
  expired: {
    title: "This checkout expired",
    icon: ClockIcon,
    toneClassName: "text-muted-foreground",
  },
  pending: {
    title: "Payment pending",
    icon: ClockIcon,
    toneClassName: "text-muted-foreground",
  },
};

function buildReturnUrl(paymentRedirect: PaymentRedirect): string {
  const returnUrl = new URL(paymentRedirect.url);
  for (const [fieldName, fieldValue] of Object.entries(
    paymentRedirect.fields,
  )) {
    returnUrl.searchParams.set(fieldName, fieldValue);
  }

  return returnUrl.toString();
}

/** Back to the merchant the way the provider does it: a link (GET) or a form (POST). */
function ReturnToMerchant({
  paymentRedirect,
  merchantName,
}: {
  paymentRedirect: PaymentRedirect;
  merchantName: string;
}) {
  const buttonLabel = `Return to ${merchantName}`;
  if (paymentRedirect.method === "GET") {
    return (
      <Button asChild>
        <a href={buildReturnUrl(paymentRedirect)}>{buttonLabel}</a>
      </Button>
    );
  }

  return (
    <form method="post" action={paymentRedirect.url}>
      {Object.entries(paymentRedirect.fields).map(([fieldName, fieldValue]) => (
        <input
          key={fieldName}
          type="hidden"
          name={fieldName}
          value={fieldValue}
        />
      ))}
      <Button type="submit">{buttonLabel}</Button>
    </form>
  );
}

/** A finished or closed checkout: the outcome and where the browser goes (PY-03.3). */
export function CheckoutResult({
  checkoutSession,
}: {
  checkoutSession: CheckoutSession;
}) {
  const resultText =
    resultTexts[checkoutSession.state] ?? resultTexts.completed;
  if (resultText === undefined) {
    return null;
  }
  const ResultIcon = resultText.icon;
  const paymentRedirect = checkoutSession.redirect;

  return (
    <section
      aria-label="Checkout result"
      className="grid gap-4 rounded-lg border p-6"
    >
      <div className="flex items-center gap-3">
        <ResultIcon
          aria-hidden="true"
          className={cn("size-7", resultText.toneClassName)}
        />
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold">{resultText.title}</h2>
          <p className="text-sm text-muted-foreground">
            {checkoutSession.state === "pending"
              ? "The payment settles later. Settle it from Payments > Simulate in SendMock."
              : "This checkout is closed and cannot be paid again."}
            {checkoutSession.failure_code !== null &&
              checkoutSession.failure_code !== "expired" &&
              ` Reason: ${checkoutSession.failure_code.replaceAll("_", " ")}.`}
          </p>
        </div>
      </div>
      {paymentRedirect !== null && (
        <div className="grid gap-2">
          <p className="text-sm">
            SendMock sends the browser to the {paymentRedirect.outcome} URL by{" "}
            {paymentRedirect.method}:
          </p>
          <code
            data-testid="redirect-url"
            className="rounded bg-muted px-2 py-1 font-mono text-xs break-all"
          >
            {paymentRedirect.url}
          </code>
          <dl
            aria-label="Fields sent"
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-xs"
          >
            {Object.entries(paymentRedirect.fields).map(
              ([fieldName, fieldValue]) => (
                <div key={fieldName} className="contents">
                  <dt className="text-muted-foreground">{fieldName}</dt>
                  <dd className="break-all">{fieldValue}</dd>
                </div>
              ),
            )}
          </dl>
          <div>
            <ReturnToMerchant
              paymentRedirect={paymentRedirect}
              merchantName={checkoutSession.merchant_name}
            />
          </div>
        </div>
      )}
    </section>
  );
}

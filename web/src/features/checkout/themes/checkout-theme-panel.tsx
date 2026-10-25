import type * as React from "react";

import { BkashWalletSteps } from "@/features/checkout/themes/bkash-wallet-steps";
import { CardPaymentForm } from "@/features/checkout/themes/card-payment-form";
import { PaypalApprovePanel } from "@/features/checkout/themes/paypal-approve-panel";
import { SslcommerzMethodPicker } from "@/features/checkout/themes/sslcommerz-method-picker";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession, PaymentProvider } from "@/lib/api/types";

type ThemeProps = {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
};

/** One theme per emulated provider; a new provider adds an entry (PY-03.2). */
const checkoutThemes: Record<
  PaymentProvider,
  { title: string; render: (themeProps: ThemeProps) => React.ReactNode }
> = {
  stripe: {
    title: "Pay with card",
    render: (themeProps) => <CardPaymentForm {...themeProps} />,
  },
  native: {
    title: "Pay with card",
    render: (themeProps) => <CardPaymentForm {...themeProps} />,
  },
  paypal: {
    title: "PayPal",
    render: (themeProps) => <PaypalApprovePanel {...themeProps} />,
  },
  sslcommerz: {
    title: "Choose a payment method",
    render: (themeProps) => <SslcommerzMethodPicker {...themeProps} />,
  },
  bkash: {
    title: "Pay with bKash",
    render: (themeProps) => (
      <BkashWalletSteps checkoutActions={themeProps.checkoutActions} />
    ),
  },
};

export function CheckoutThemePanel(themeProps: ThemeProps) {
  const checkoutTheme = checkoutThemes[themeProps.checkoutSession.provider];

  return (
    <section
      aria-label="Payment"
      className="grid content-start gap-4 rounded-lg border p-5"
    >
      <h2 className="text-base font-semibold">{checkoutTheme.title}</h2>
      {checkoutTheme.render(themeProps)}
    </section>
  );
}

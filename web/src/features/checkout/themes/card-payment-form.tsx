import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accentButtonClassName } from "@/features/checkout/themes/accent-button-classes";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession } from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";
import { checkCardNumber, testCards } from "@/lib/payments/test-instruments";

/** "12/34" as month and four-digit year, or null. */
function parseExpiry(
  expiryText: string,
): { month: number; year: number } | null {
  const expiryMatch = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiryText.trim());
  const month = Number(expiryMatch?.[1]);
  if (expiryMatch === null || month < 1 || month > 12) {
    return null;
  }

  return { month, year: 2000 + Number(expiryMatch[2]) };
}

/**
 * A card form whose outcome follows the test card table (PY-03.1). A real
 * card number is refused here and never leaves the page (PY-01.1).
 */
export function CardPaymentForm({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  const fieldIdPrefix = React.useId();
  const [cardNumber, setCardNumber] = React.useState("");
  const [expiryText, setExpiryText] = React.useState("");
  const [cvc, setCvc] = React.useState("");
  const [holderName, setHolderName] = React.useState("");

  return (
    <form
      noValidate
      aria-label="Card details"
      className="grid gap-3"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const cardCheck = checkCardNumber(cardNumber);
        const expiry = parseExpiry(expiryText);
        if (cardCheck.kind === "invalid") {
          checkoutActions.showError("Enter a valid card number");
          return;
        }
        if (cardCheck.kind === "not_test_card") {
          checkoutActions.showError(
            "Use a test card: real card numbers are never accepted",
          );
          return;
        }
        if (expiry === null || !/^\d{3,4}$/.test(cvc)) {
          checkoutActions.showError(
            "Enter the expiry as MM/YY and a 3 or 4 digit CVC",
          );
          return;
        }
        checkoutActions.submit({
          action: "pay",
          card: {
            number: cardNumber,
            exp_month: expiry.month,
            exp_year: expiry.year,
            cvc,
            holder_name: holderName,
          },
        });
      }}
    >
      <FormField label="Card number" fieldId={`${fieldIdPrefix}-number`}>
        <Input
          id={`${fieldIdPrefix}-number`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="4242 4242 4242 4242"
          className="font-mono"
          value={cardNumber}
          onChange={(changeEvent) => {
            setCardNumber(changeEvent.target.value);
          }}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Expiry (MM/YY)" fieldId={`${fieldIdPrefix}-expiry`}>
          <Input
            id={`${fieldIdPrefix}-expiry`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="12/34"
            className="font-mono"
            value={expiryText}
            onChange={(changeEvent) => {
              setExpiryText(changeEvent.target.value);
            }}
          />
        </FormField>
        <FormField label="CVC" fieldId={`${fieldIdPrefix}-cvc`}>
          <Input
            id={`${fieldIdPrefix}-cvc`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="123"
            className="font-mono"
            value={cvc}
            onChange={(changeEvent) => {
              setCvc(changeEvent.target.value);
            }}
          />
        </FormField>
      </div>
      <FormField label="Name on card" fieldId={`${fieldIdPrefix}-name`}>
        <Input
          id={`${fieldIdPrefix}-name`}
          autoComplete="off"
          value={holderName}
          onChange={(changeEvent) => {
            setHolderName(changeEvent.target.value);
          }}
        />
      </FormField>
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
      <Button
        type="submit"
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
      >
        Pay{" "}
        {formatMinorAmount(
          checkoutSession.amount_minor,
          checkoutSession.currency,
        )}
      </Button>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Test cards</summary>
        <ul className="mt-2 grid gap-1">
          {testCards.map((testCard) => (
            <li key={testCard.number} className="flex justify-between gap-2">
              <button
                type="button"
                className="font-mono underline-offset-2 hover:underline"
                onClick={() => {
                  setCardNumber(
                    testCard.number.replace(/(\d{4})(?=\d)/g, "$1 "),
                  );
                }}
              >
                {testCard.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
              </button>
              <span>{testCard.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1">Any future expiry and any CVC work.</p>
      </details>
    </form>
  );
}

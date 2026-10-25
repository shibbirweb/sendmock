import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accentButtonClassName } from "@/features/checkout/flows/accent-button-classes";
import type { FlowProps } from "@/features/checkout/flows/flow-props";
import { formatMinorAmount } from "@/lib/payments/format-money";
import {
  checkCardNumber,
  describeTestOutcome,
  formatCardNumber,
} from "@/lib/payments/test-instruments";

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

function CardField({
  label,
  fieldId,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  fieldId: string;
  value: string;
  placeholder?: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <FormField label={label} fieldId={fieldId}>
      <Input
        id={fieldId}
        inputMode={label === "Name on card" ? undefined : "numeric"}
        autoComplete="off"
        placeholder={placeholder}
        className={label === "Name on card" ? undefined : "font-mono"}
        value={value}
        onChange={(changeEvent) => {
          onChange(changeEvent.target.value);
        }}
      />
    </FormField>
  );
}

/**
 * The card flow: the outcome follows the method's own test cards (PY-12.3).
 * A real card number is refused here and never leaves the page (PY-01.1).
 */
export function CardFlow({
  checkoutSession,
  paymentMethod,
  checkoutActions,
}: FlowProps) {
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
        const cardCheck = checkCardNumber(cardNumber, paymentMethod.test_cards);
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
          method_key: paymentMethod.key,
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
      <CardField
        label="Card number"
        fieldId={`${fieldIdPrefix}-number`}
        placeholder="4242 4242 4242 4242"
        value={cardNumber}
        onChange={setCardNumber}
      />
      <div className="grid grid-cols-2 gap-3">
        <CardField
          label="Expiry (MM/YY)"
          fieldId={`${fieldIdPrefix}-expiry`}
          placeholder="12/34"
          value={expiryText}
          onChange={setExpiryText}
        />
        <CardField
          label="CVC"
          fieldId={`${fieldIdPrefix}-cvc`}
          placeholder="123"
          value={cvc}
          onChange={setCvc}
        />
      </div>
      <CardField
        label="Name on card"
        fieldId={`${fieldIdPrefix}-name`}
        value={holderName}
        onChange={setHolderName}
      />
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
          {paymentMethod.test_cards.map((testCard) => (
            <li key={testCard.number} className="flex justify-between gap-2">
              <button
                type="button"
                className="font-mono underline-offset-2 hover:underline"
                onClick={() => {
                  setCardNumber(formatCardNumber(testCard.number));
                }}
              >
                {formatCardNumber(testCard.number)}
              </button>
              <span>{describeTestOutcome(testCard)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1">Any future expiry and any CVC work.</p>
      </details>
    </form>
  );
}

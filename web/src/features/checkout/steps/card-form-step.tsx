import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import type {
  CardDraft,
  CheckoutStepView,
  StepViewProps,
} from "@/features/checkout/steps/step-view-props";
import type { CheckoutCard } from "@/lib/api/types";
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

/** The typed card as the API takes it, or null while expiry or CVC are not valid. */
export function toCheckoutCard(cardDraft: CardDraft): CheckoutCard | null {
  const expiry = parseExpiry(cardDraft.expiry);
  if (expiry === null || !/^\d{3,4}$/.test(cardDraft.cvc)) {
    return null;
  }

  return {
    number: cardDraft.number,
    exp_month: expiry.month,
    exp_year: expiry.year,
    cvc: cardDraft.cvc,
    holder_name: cardDraft.holderName,
  };
}

function CardField({
  label,
  value,
  placeholder,
  isNumeric = true,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  isNumeric?: boolean;
  onChange: (nextValue: string) => void;
}) {
  const fieldId = React.useId();

  return (
    <FormField label={label} fieldId={fieldId}>
      <Input
        id={fieldId}
        inputMode={isNumeric ? "numeric" : undefined}
        autoComplete="off"
        placeholder={placeholder}
        className={isNumeric ? "font-mono" : undefined}
        value={value}
        onChange={(changeEvent) => {
          onChange(changeEvent.target.value);
        }}
      />
    </FormField>
  );
}

function CardFormFields({
  flowStep,
  flowEntries,
  onEntriesChange,
}: StepViewProps) {
  const { cardDraft } = flowEntries;
  const changeCard = (changedFields: Partial<CardDraft>) => {
    onEntriesChange({ cardDraft: { ...cardDraft, ...changedFields } });
  };

  return (
    <div className="grid gap-3">
      <CardField
        label={flowStep.field_label}
        placeholder="4242 4242 4242 4242"
        value={cardDraft.number}
        onChange={(cardNumber) => changeCard({ number: cardNumber })}
      />
      <div className="grid grid-cols-2 gap-3">
        <CardField
          label="Expiry (MM/YY)"
          placeholder="12/34"
          value={cardDraft.expiry}
          onChange={(expiry) => changeCard({ expiry })}
        />
        <CardField
          label="CVC"
          placeholder="123"
          value={cardDraft.cvc}
          onChange={(cvc) => changeCard({ cvc })}
        />
      </div>
      <CardField
        label="Name on card"
        isNumeric={false}
        value={cardDraft.holderName}
        onChange={(holderName) => changeCard({ holderName })}
      />
      {flowStep.hint !== "" && (
        <p className="text-xs text-muted-foreground">{flowStep.hint}</p>
      )}
    </div>
  );
}

function TestCardList({
  paymentMethod,
  flowEntries,
  onEntriesChange,
}: StepViewProps) {
  return (
    <details className="order-last text-xs text-muted-foreground">
      <summary className="cursor-pointer">Test cards</summary>
      <ul className="mt-2 grid gap-1">
        {paymentMethod.test_cards.map((testCard) => (
          <li key={testCard.number} className="flex justify-between gap-2">
            <button
              type="button"
              className="font-mono underline-offset-2 hover:underline"
              onClick={() => {
                onEntriesChange({
                  cardDraft: {
                    ...flowEntries.cardDraft,
                    number: formatCardNumber(testCard.number),
                  },
                });
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
  );
}

/**
 * The card form step: the outcome follows the method's own test cards. A real
 * card number is refused on the page and never sent (PY-01.1).
 */
export const cardFormStepView: CheckoutStepView = {
  render: (stepViewProps) => <CardFormFields {...stepViewProps} />,
  renderAfterAction: (stepViewProps) => <TestCardList {...stepViewProps} />,
  findEntryError: (paymentMethod, flowEntries) => {
    const cardCheck = checkCardNumber(
      flowEntries.cardDraft.number,
      paymentMethod.test_cards,
    );
    if (cardCheck.kind === "invalid") {
      return "Enter a valid card number";
    }
    if (cardCheck.kind === "not_test_card") {
      return "Use a test card: real card numbers are never accepted";
    }

    return toCheckoutCard(flowEntries.cardDraft) === null
      ? "Enter the expiry as MM/YY and a 3 or 4 digit CVC"
      : null;
  },
};

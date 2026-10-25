import * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardPaymentForm } from "@/features/checkout/themes/card-payment-form";
import { accentButtonClassName } from "@/features/checkout/themes/accent-button-classes";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession } from "@/lib/api/types";

const mobileBankingOptions = [
  {
    option: "bkash",
    label: "bKash",
  },
  {
    option: "nagad",
    label: "Nagad",
  },
  {
    option: "rocket",
    label: "Rocket",
  },
];

const netBankingOptions = [
  {
    option: "dbbl",
    label: "DBBL Nexus",
  },
  {
    option: "city",
    label: "City Touch",
  },
  {
    option: "brac",
    label: "BRAC iBanking",
  },
];

function OptionList({
  groupLabel,
  paymentOptions,
  checkoutActions,
}: {
  groupLabel: string;
  paymentOptions: { option: string; label: string }[];
  checkoutActions: CheckoutActions;
}) {
  const [pickedOption, setPickedOption] = React.useState(
    paymentOptions[0]?.option ?? "",
  );

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{groupLabel}</legend>
      <div className="grid grid-cols-3 gap-2">
        {paymentOptions.map((paymentOption) => (
          <label
            key={paymentOption.option}
            className="flex cursor-pointer items-center justify-center rounded-md border p-3 text-sm has-checked:border-checkout-accent has-checked:ring-2 has-checked:ring-checkout-accent/30"
          >
            <input
              type="radio"
              name={groupLabel}
              value={paymentOption.option}
              checked={pickedOption === paymentOption.option}
              className="sr-only"
              onChange={() => {
                setPickedOption(paymentOption.option);
              }}
            />
            {paymentOption.label}
          </label>
        ))}
      </div>
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
      <Button
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
        onClick={() => {
          checkoutActions.submit({
            action: "pay",
            payment_option: pickedOption,
          });
        }}
      >
        Pay with{" "}
        {
          paymentOptions.find(
            (paymentOption) => paymentOption.option === pickedOption,
          )?.label
        }
      </Button>
    </fieldset>
  );
}

/** SSLCommerz's method picker: cards, mobile banking and net banking (PY-03.2). */
export function SslcommerzMethodPicker({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  return (
    <Tabs defaultValue="cards" className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="cards">Cards</TabsTrigger>
        <TabsTrigger value="mobile">Mobile banking</TabsTrigger>
        <TabsTrigger value="net">Net banking</TabsTrigger>
      </TabsList>
      <TabsContent value="cards">
        <CardPaymentForm
          checkoutSession={checkoutSession}
          checkoutActions={checkoutActions}
        />
      </TabsContent>
      <TabsContent value="mobile">
        <OptionList
          groupLabel="Mobile banking"
          paymentOptions={mobileBankingOptions}
          checkoutActions={checkoutActions}
        />
      </TabsContent>
      <TabsContent value="net">
        <OptionList
          groupLabel="Net banking"
          paymentOptions={netBankingOptions}
          checkoutActions={checkoutActions}
        />
      </TabsContent>
    </Tabs>
  );
}

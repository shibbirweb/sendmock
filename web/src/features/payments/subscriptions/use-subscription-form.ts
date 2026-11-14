import * as React from "react";

import type {
  PaymentSubscriptionCreateRequest,
  SubscriptionInterval,
} from "@/lib/api/types";
import { parseMajorAmount } from "@/lib/payments/format-money";

export type SubscriptionFormValues = {
  provider: string;
  customerEmail: string;
  planName: string;
  amountText: string;
  currency: string;
  interval: SubscriptionInterval;
  trialDaysText: string;
  cardNumber: string;
};

export type SubscriptionFormErrors = Partial<
  Record<keyof SubscriptionFormValues, string>
>;

const startingValues: SubscriptionFormValues = {
  provider: "stripe",
  customerEmail: "",
  planName: "Pro",
  amountText: "15.00",
  currency: "USD",
  interval: "month",
  trialDaysText: "0",
  cardNumber: "4242424242424242",
};

/** The request the form describes, or what to fix first. */
export function readSubscriptionRequest(
  formValues: SubscriptionFormValues,
):
  | { createRequest: PaymentSubscriptionCreateRequest }
  | { formErrors: SubscriptionFormErrors } {
  const formErrors: SubscriptionFormErrors = {};
  const amountMinor = parseMajorAmount(
    formValues.amountText,
    formValues.currency,
  );
  const trialDays = Number(formValues.trialDaysText || "0");
  if (!formValues.customerEmail.includes("@")) {
    formErrors.customerEmail = "Enter the customer's email address.";
  }
  if (formValues.planName.trim() === "") {
    formErrors.planName = "Name the plan.";
  }
  if (amountMinor === null || amountMinor <= 0) {
    formErrors.amountText = "Enter an amount above 0.";
  }
  if (!Number.isInteger(trialDays) || trialDays < 0) {
    formErrors.trialDaysText = "Enter a whole number of days.";
  }
  if (Object.keys(formErrors).length > 0 || amountMinor === null) {
    return { formErrors };
  }

  const createRequest: PaymentSubscriptionCreateRequest = {
    provider: formValues.provider,
    customer_email: formValues.customerEmail.trim(),
    plan_name: formValues.planName.trim(),
    amount_minor: amountMinor,
    currency: formValues.currency.trim().toUpperCase(),
    interval: formValues.interval,
    trial_days: trialDays,
    card_number: formValues.cardNumber.replaceAll(" ", ""),
  };

  return { createRequest };
}

export function useSubscriptionForm() {
  const [formValues, setFormValues] =
    React.useState<SubscriptionFormValues>(startingValues);
  const [formErrors, setFormErrors] = React.useState<SubscriptionFormErrors>(
    {},
  );
  const changeValue = <FieldName extends keyof SubscriptionFormValues>(
    fieldName: FieldName,
    fieldValue: SubscriptionFormValues[FieldName],
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: fieldValue,
    }));
  };

  return { formValues, formErrors, setFormErrors, changeValue };
}

import * as React from "react";

import type {
  PaymentCaptureMethod,
  PaymentCreateRequest,
} from "@/lib/api/types";
import { parseMajorAmount } from "@/lib/payments/format-money";

export type NewPaymentFormValues = {
  provider: string;
  customerEmail: string;
  amountText: string;
  currency: string;
  cardNumber: string;
  captureMethod: PaymentCaptureMethod;
};

export type NewPaymentFormErrors = Partial<
  Record<keyof NewPaymentFormValues, string>
>;

const startingValues: NewPaymentFormValues = {
  provider: "stripe",
  customerEmail: "",
  amountText: "19.99",
  currency: "USD",
  cardNumber: "4242424242424242",
  captureMethod: "automatic",
};

/** The request the form describes, or what to fix first. */
export function readNewPaymentRequest(
  formValues: NewPaymentFormValues,
):
  | { createRequest: PaymentCreateRequest }
  | { formErrors: NewPaymentFormErrors } {
  const formErrors: NewPaymentFormErrors = {};
  const currency = formValues.currency.trim().toUpperCase();
  const amountMinor = parseMajorAmount(formValues.amountText, currency);
  const customerEmail = formValues.customerEmail.trim();
  if (!/^[A-Z]{3}$/.test(currency)) {
    formErrors.currency = "Enter a three-letter code, such as USD.";
  }
  if (amountMinor === null || amountMinor <= 0) {
    formErrors.amountText = "Enter an amount above 0.";
  }
  if (customerEmail !== "" && !customerEmail.includes("@")) {
    formErrors.customerEmail = "Enter an email address, or leave it empty.";
  }
  if (formValues.cardNumber.trim() === "") {
    formErrors.cardNumber = "Enter a test card number.";
  }
  if (Object.keys(formErrors).length > 0 || amountMinor === null) {
    return { formErrors };
  }

  const createRequest: PaymentCreateRequest = {
    provider: formValues.provider,
    amount_minor: amountMinor,
    currency,
    card_number: formValues.cardNumber.replaceAll(" ", ""),
    capture_method: formValues.captureMethod,
    ...(customerEmail === "" ? {} : { customer_email: customerEmail }),
  };

  return { createRequest };
}

export function useNewPaymentForm() {
  const [formValues, setFormValues] =
    React.useState<NewPaymentFormValues>(startingValues);
  const [formErrors, setFormErrors] = React.useState<NewPaymentFormErrors>({});
  const changeValue = <FieldName extends keyof NewPaymentFormValues>(
    fieldName: FieldName,
    fieldValue: NewPaymentFormValues[FieldName],
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: fieldValue,
    }));
  };

  return { formValues, formErrors, setFormErrors, changeValue };
}

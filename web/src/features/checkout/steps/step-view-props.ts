import type * as React from "react";

import type {
  CheckoutSession,
  PaymentFlowStep,
  PaymentMethodDefinition,
} from "@/lib/api/types";

/** The card as typed; parsed into a checkout card only when the flow is paid. */
export type CardDraft = {
  number: string;
  expiry: string;
  cvc: string;
  holderName: string;
};

/** Everything typed so far across a flow's steps. */
export type FlowEntries = {
  cardDraft: CardDraft;
  number: string;
  otp: string;
  pin: string;
};

export const emptyFlowEntries: FlowEntries = {
  cardDraft: { number: "", expiry: "", cvc: "", holderName: "" },
  number: "",
  otp: "",
  pin: "",
};

/** What every step view gets: its labels (already filled), the method, and the entries. */
export type StepViewProps = {
  flowStep: PaymentFlowStep;
  checkoutSession: CheckoutSession;
  paymentMethod: PaymentMethodDefinition;
  flowEntries: FlowEntries;
  onEntriesChange: (changedEntries: Partial<FlowEntries>) => void;
  /** Later steps take focus as they appear. */
  isFirstStep: boolean;
};

/** One step type on the checkout page (PY-12.6). */
export type CheckoutStepView = {
  render: (stepViewProps: StepViewProps) => React.ReactNode;
  /** Shown under the step's button, e.g. the test card list. */
  renderAfterAction?: (stepViewProps: StepViewProps) => React.ReactNode;
  /** A problem to show before moving on, checked on the page; null when fine. */
  findEntryError?: (
    paymentMethod: PaymentMethodDefinition,
    flowEntries: FlowEntries,
  ) => string | null;
  /** Shows "Cancel and return to the merchant" beside the button. */
  isCancelable?: boolean;
};

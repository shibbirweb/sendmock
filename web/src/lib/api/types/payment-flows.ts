/** The step types SendMock can show on a checkout page and check (PY-12.6). */
export type PaymentStepType =
  | "card_form"
  | "account_number"
  | "voucher_code"
  | "otp"
  | "pin"
  | "signed_in_account"
  | "qr_code"
  | "reference_code"
  | "confirm";

/** A method value a step reads (17-payments, step catalogue). */
export type PaymentMethodValueKind =
  | "test_cards"
  | "test_numbers"
  | "otp"
  | "pin"
  | "test_account"
  | "default_outcome";

/**
 * One step of a flow with its own labels. `{method}` and `{amount}` in a
 * label are replaced with the method's name and the amount to pay.
 */
export type PaymentFlowStep = {
  /**
   * The step type, e.g. `account_number`, `otp`, `pin` or `card_form`.
   * @example "otp"
   */
  type: PaymentStepType;
  /**
   * Shown above the step; may be empty.
   * @example "Enter the code sent to your phone"
   */
  title: string;
  /**
   * The input's label; empty for steps without a field.
   * @example "Verification code"
   */
  field_label: string;
  /**
   * Small text under the input; `{method}` and `{amount}` are replaced.
   * @example "We sent a 6 digit code to your {method} number."
   */
  hint: string;
  /**
   * The button's text.
   * @example "Verify"
   */
  button_label: string;
};

/** How a customer pays, step by step (PY-12.6). */
export type PaymentFlowDefinition = {
  /**
   * The flow's key; fixed after creation.
   * @example "wallet_otp"
   */
  key: string;
  /**
   * The flow's name.
   * @example "Wallet with OTP"
   */
  name: string;
  /**
   * The checkout picker tab its methods show under, e.g. "Mobile banking".
   * @example "Mobile banking"
   */
  picker_tab: string;
  /**
   * The steps in order.
   */
  steps: PaymentFlowStep[];
  is_builtin: boolean;
  /** A built-in that differs from its shipped default. */
  is_modified: boolean;
  /** Methods using it; a custom flow in use cannot be deleted. */
  method_count: number;
};

/** Body of POST and PATCH /api/v1/payments/flows; the key is fixed after creation. */
export type PaymentFlowInput = Pick<
  PaymentFlowDefinition,
  "key" | "name" | "picker_tab" | "steps"
>;

/** Body of POST /api/v1/payments/flows/{flowKey}/steps: one step, appended unless a position is given. */
export type PaymentFlowStepAddRequest = {
  /**
   * The step to add.
   */
  step: PaymentFlowStep;
  /**
   * Zero-based; the end of the flow when left out.
   * @example 1
   */
  position?: number;
};

/** Body of PATCH /api/v1/payments/flows/{flowKey}/steps/{stepIndex}. */
export type PaymentFlowStepUpdateRequest = Partial<
  Omit<PaymentFlowStep, "type">
> & {
  /**
   * Moves the step to this zero-based position.
   * @example 0
   */
  position?: number;
};

/** GET /api/v1/payments/step-types: one entry of the step catalogue. */
export type PaymentStepTypeInfo = {
  type: PaymentStepType;
  name: string;
  description: string;
  /** Decides the outcome from the method's test values; a flow has at most one. */
  is_deciding: boolean;
  /** Shows an input, so it needs a field label. */
  has_field: boolean;
  method_values: PaymentMethodValueKind[];
  default_labels: Omit<PaymentFlowStep, "type">;
};

/** GET /api/v1/payments/flow-variables: a variable step labels can use (PY-12.7). */
export type PaymentFlowVariable = {
  /** As written in a label, e.g. `{method}`. */
  token: string;
  /** What it becomes on the checkout page. */
  description: string;
  example: string;
};

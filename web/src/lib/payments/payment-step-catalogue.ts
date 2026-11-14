import type {
  PaymentFlowStep,
  PaymentStepType,
  PaymentStepTypeInfo,
} from "@/lib/api/types";

/**
 * Every step a flow can be built from (17-payments, PY-12.6). A new step type
 * adds an entry here, a checkout component and a check in the flow run.
 */
export const paymentStepCatalogue: Record<
  PaymentStepType,
  PaymentStepTypeInfo
> = {
  card_form: {
    type: "card_form",
    name: "Card form",
    description:
      "Number, expiry, CVC and name; a 3-D Secure challenge when the test card asks for one.",
    is_deciding: true,
    has_field: true,
    method_values: ["test_cards"],
    default_labels: {
      title: "",
      field_label: "Card number",
      hint: "",
      button_label: "Pay {amount}",
    },
  },
  account_number: {
    type: "account_number",
    name: "Account number",
    description:
      "A wallet, phone or account number checked against the test numbers.",
    is_deciding: true,
    has_field: true,
    method_values: ["test_numbers"],
    default_labels: {
      title: "",
      field_label: "Your {method} account number",
      hint: "",
      button_label: "Confirm",
    },
  },
  voucher_code: {
    type: "voucher_code",
    name: "Voucher code",
    description: "A voucher or gift card code checked against the test codes.",
    is_deciding: true,
    has_field: true,
    method_values: ["test_numbers"],
    default_labels: {
      title: "",
      field_label: "Voucher code",
      hint: "",
      button_label: "Redeem {amount}",
    },
  },
  otp: {
    type: "otp",
    name: "OTP",
    description: "A verification code; it must match the method's test OTP.",
    is_deciding: false,
    has_field: true,
    method_values: ["otp"],
    default_labels: {
      title: "",
      field_label: "Verification code",
      hint: "",
      button_label: "Confirm",
    },
  },
  pin: {
    type: "pin",
    name: "PIN",
    description:
      "A PIN, asked again when wrong; it must match the method's test PIN.",
    is_deciding: false,
    has_field: true,
    method_values: ["pin"],
    default_labels: {
      title: "",
      field_label: "PIN",
      hint: "",
      button_label: "Confirm and pay",
    },
  },
  signed_in_account: {
    type: "signed_in_account",
    name: "Signed-in account",
    description:
      "The method's test account, signed in, with Approve and Cancel.",
    is_deciding: false,
    has_field: false,
    method_values: ["test_account", "default_outcome"],
    default_labels: {
      title: "",
      field_label: "",
      hint: "Signed in as the test account",
      button_label: "Approve and pay {amount}",
    },
  },
  qr_code: {
    type: "qr_code",
    name: "QR code",
    description: 'A QR code to scan in the app, then "I have paid".',
    is_deciding: false,
    has_field: false,
    method_values: ["default_outcome"],
    default_labels: {
      title: "Scan to pay",
      field_label: "",
      hint: "Open {method} and scan the code.",
      button_label: "I have paid",
    },
  },
  reference_code: {
    type: "reference_code",
    name: "Reference code",
    description:
      'A reference to pay with elsewhere (bank transfer, cash), then "I have paid".',
    is_deciding: false,
    has_field: false,
    method_values: ["default_outcome"],
    default_labels: {
      title: "Pay by transfer",
      field_label: "",
      hint: "Send {amount} with this reference.",
      button_label: "I have paid",
    },
  },
  confirm: {
    type: "confirm",
    name: "Confirm",
    description: "A confirm button.",
    is_deciding: false,
    has_field: false,
    method_values: ["default_outcome"],
    default_labels: {
      title: "",
      field_label: "",
      hint: "You will confirm the payment in {method}.",
      button_label: "Pay with {method}",
    },
  },
};

export const paymentStepTypes = Object.keys(
  paymentStepCatalogue,
) as PaymentStepType[];

/** A step of this type with the catalogue's labels. */
export function buildDefaultStep(stepType: PaymentStepType): PaymentFlowStep {
  return { type: stepType, ...paymentStepCatalogue[stepType].default_labels };
}

/** The deciding step of a flow (card form, account number or voucher code), if any. */
export function findDecidingStep(
  flowSteps: PaymentFlowStep[],
): PaymentFlowStep | undefined {
  return flowSteps.find(
    (flowStep) => paymentStepCatalogue[flowStep.type].is_deciding,
  );
}

/** "Account number, OTP, PIN" for tables. */
export function describeFlowSteps(flowSteps: PaymentFlowStep[]): string {
  return flowSteps
    .map((flowStep) => paymentStepCatalogue[flowStep.type].name)
    .join(", ");
}

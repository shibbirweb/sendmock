import { cardFormStepView } from "@/features/checkout/steps/card-form-step";
import {
  accountNumberStepView,
  otpStepView,
  pinStepView,
  voucherCodeStepView,
} from "@/features/checkout/steps/entry-steps";
import {
  confirmStepView,
  qrCodeStepView,
  referenceCodeStepView,
  signedInAccountStepView,
} from "@/features/checkout/steps/info-steps";
import type { CheckoutStepView } from "@/features/checkout/steps/step-view-props";
import type { PaymentStepType } from "@/lib/api/types";

/** One view per step type; a new step type adds an entry (PY-12.6). */
export const checkoutStepViews: Record<PaymentStepType, CheckoutStepView> = {
  card_form: cardFormStepView,
  account_number: accountNumberStepView,
  voucher_code: voucherCodeStepView,
  otp: otpStepView,
  pin: pinStepView,
  signed_in_account: signedInAccountStepView,
  qr_code: qrCodeStepView,
  reference_code: referenceCodeStepView,
  confirm: confirmStepView,
};

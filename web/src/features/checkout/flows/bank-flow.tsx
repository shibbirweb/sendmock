import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { accentButtonClassName } from "@/features/checkout/flows/accent-button-classes";
import type { FlowProps } from "@/features/checkout/flows/flow-props";

/** The bank flow: confirm with the bank; the outcome is the method's (PY-12.3). */
export function BankFlow({
  paymentMethod,
  checkoutActions,
}: Omit<FlowProps, "checkoutSession">) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        You will confirm the payment in {paymentMethod.name}. In test mode it{" "}
        {paymentMethod.bank_outcome === "decline" ? "is declined" : "succeeds"}.
      </p>
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
      <Button
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
        onClick={() => {
          checkoutActions.submit({
            action: "pay",
            method_key: paymentMethod.key,
          });
        }}
      >
        Pay with {paymentMethod.name}
      </Button>
    </div>
  );
}

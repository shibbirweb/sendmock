import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ExternalLinkIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import { ApiError } from "@/lib/api/api-client";
import { useCreateTestCheckout } from "@/lib/api/hooks/use-payment-gateway-queries";
import { usePaymentMethods } from "@/lib/api/hooks/use-payment-method-queries";
import { moveListItem } from "@/lib/move-list-item";

/** The methods offered in order, and a test checkout of the saved gateway (PY-12.2, PY-12.3). */
export function GatewayCheckoutTab({
  gatewayForm,
}: {
  gatewayForm: PaymentGatewayForm;
}) {
  const navigate = useNavigate();
  const paymentMethods = usePaymentMethods().data ?? [];
  const createTestCheckout = useCreateTestCheckout();
  const { gatewayInput, fieldErrors, updateInput } = gatewayForm;
  const methodKeys = gatewayInput.method_keys;
  const readMethodName = (methodKey: string) =>
    paymentMethods.find((paymentMethod) => paymentMethod.key === methodKey)
      ?.name ?? methodKey;
  const addableMethods = paymentMethods.filter(
    (paymentMethod) => !methodKeys.includes(paymentMethod.key),
  );

  return (
    <div className="grid content-start gap-4">
      <section aria-label="Methods offered" className="grid gap-2">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-medium">Methods offered</h3>
          <p className="text-xs text-muted-foreground">
            One method shows its flow directly; several show a picker, in this
            order.
          </p>
        </div>
        <ol className="grid gap-1.5">
          {methodKeys.map((methodKey, methodIndex) => (
            <li
              key={methodKey}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
            >
              <span>
                {methodIndex + 1}. {readMethodName(methodKey)}
              </span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${readMethodName(methodKey)} up`}
                  disabled={methodIndex === 0}
                  onClick={() =>
                    updateInput({
                      method_keys: moveListItem(
                        methodKeys,
                        methodIndex,
                        methodIndex - 1,
                      ),
                    })
                  }
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${readMethodName(methodKey)} down`}
                  disabled={methodIndex === methodKeys.length - 1}
                  onClick={() =>
                    updateInput({
                      method_keys: moveListItem(
                        methodKeys,
                        methodIndex,
                        methodIndex + 1,
                      ),
                    })
                  }
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${readMethodName(methodKey)}`}
                  onClick={() =>
                    updateInput({
                      method_keys: methodKeys.filter(
                        (otherKey) => otherKey !== methodKey,
                      ),
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              </span>
            </li>
          ))}
        </ol>
        <FormFieldError errorMessage={fieldErrors.method_keys} />
        <Select
          value=""
          onValueChange={(addedKey) =>
            updateInput({ method_keys: [...methodKeys, addedKey] })
          }
          disabled={addableMethods.length === 0}
        >
          <SelectTrigger aria-label="Add a method" className="w-60">
            <SelectValue placeholder="Add a method" />
          </SelectTrigger>
          <SelectContent>
            {addableMethods.map((paymentMethod) => (
              <SelectItem key={paymentMethod.key} value={paymentMethod.key}>
                {paymentMethod.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
      <section
        aria-label="Test checkout"
        className="grid gap-2 rounded-md border p-3"
      >
        <p className="text-sm text-muted-foreground">
          Creates a test payment with this gateway and opens its checkout page.
          {gatewayForm.isDirty && " Save first: it uses the saved gateway."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={gatewayForm.isDirty || createTestCheckout.isPending}
          onClick={() => {
            createTestCheckout.mutate(
              {
                provider: gatewayInput.key,
                amount_minor: 2500,
              },
              {
                onSuccess: (paymentDetail) => {
                  void navigate({
                    to: "/pay/$sessionId",
                    params: { sessionId: paymentDetail.id },
                  });
                },
                onError: (requestError) => {
                  toast.error(
                    requestError instanceof ApiError
                      ? requestError.message
                      : "Could not open a test checkout",
                  );
                },
              },
            );
          }}
        >
          <ExternalLinkIcon />
          Open a test checkout
        </Button>
      </section>
    </div>
  );
}

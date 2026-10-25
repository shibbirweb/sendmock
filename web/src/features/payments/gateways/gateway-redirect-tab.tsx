import { PlusIcon, Trash2Icon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import { TemplateTextField } from "@/features/webhooks/templates/reference/template-text-field";
import type { GatewayRedirectField } from "@/lib/api/types";

/** GET or POST and the fields sent back to the app, each a template (PY-12.2). */
export function GatewayRedirectTab({
  gatewayForm,
}: {
  gatewayForm: PaymentGatewayForm;
}) {
  const { gatewayInput, fieldErrors, updateInput } = gatewayForm;
  const redirectFields = gatewayInput.redirect_fields;
  const templateReference = gatewayForm.previewQuery.data?.reference;
  const changeField = (
    fieldIndex: number,
    changedFields: Partial<GatewayRedirectField>,
  ) => {
    updateInput({
      redirect_fields: redirectFields.map((redirectField, candidateIndex) =>
        candidateIndex === fieldIndex
          ? { ...redirectField, ...changedFields }
          : redirectField,
      ),
    });
  };

  return (
    <div className="grid content-start gap-5">
      <RadioCardGroup<"GET" | "POST">
        legend="Redirect method"
        className="sm:grid-cols-2"
        selectedValue={gatewayInput.redirect_method}
        options={[
          {
            value: "GET",
            label: "GET",
            description: "The fields go in the query string (Stripe, PayPal).",
          },
          {
            value: "POST",
            label: "POST",
            description:
              "The browser posts a form with the fields (SSLCommerz).",
          },
        ]}
        onSelect={(redirectMethod) =>
          updateInput({ redirect_method: redirectMethod })
        }
      />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Fields</legend>
        <p className="text-xs text-muted-foreground">
          Type <code className="font-mono">{"{{"}</code> for suggestions;{" "}
          <code className="font-mono">{"{{ redirect.status }}"}</code> is this
          gateway&apos;s event name for the outcome.
        </p>
        {redirectFields.map((redirectField, fieldIndex) => (
          <div
            key={fieldIndex}
            className="grid grid-cols-[0.8fr_1.6fr_9rem_auto] items-start gap-2"
          >
            <Input
              aria-label={`Redirect field ${fieldIndex + 1} name`}
              className="font-mono text-xs"
              placeholder="status"
              value={redirectField.name}
              onChange={(changeEvent) =>
                changeField(fieldIndex, { name: changeEvent.target.value })
              }
            />
            <TemplateTextField
              ariaLabel={`Redirect field ${fieldIndex + 1} template`}
              className="font-mono text-xs"
              placeholder="{{ payment.reference }}"
              value={redirectField.template}
              templateReference={templateReference}
              onChange={(template) => changeField(fieldIndex, { template })}
            />
            <Select
              value={redirectField.send_on}
              onValueChange={(sendOn) =>
                changeField(fieldIndex, {
                  send_on: sendOn as GatewayRedirectField["send_on"],
                })
              }
            >
              <SelectTrigger
                aria-label={`Redirect field ${fieldIndex + 1} sent`}
                className="h-9 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="success">Only on success</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-0.5"
              aria-label={`Remove redirect field ${fieldIndex + 1}`}
              onClick={() =>
                updateInput({
                  redirect_fields: redirectFields.filter(
                    (_redirectField, candidateIndex) =>
                      candidateIndex !== fieldIndex,
                  ),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <FormFieldError errorMessage={fieldErrors.redirect_fields} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            updateInput({
              redirect_fields: [
                ...redirectFields,
                { name: "", template: "", send_on: "always" },
              ],
            })
          }
        >
          <PlusIcon />
          Add field
        </Button>
      </fieldset>
    </div>
  );
}

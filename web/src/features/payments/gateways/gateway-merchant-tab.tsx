import { EyeIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import { useRevealGatewayCredential } from "@/lib/api/hooks/use-payment-gateway-queries";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { GatewayCredential } from "@/lib/api/types";

const noEndpoint = "none";

/** Merchant credentials (secrets masked, reveal asks first) and the notification endpoint (PY-12.2). */
export function GatewayMerchantTab({
  gatewayForm,
  savedCredentials,
}: {
  gatewayForm: PaymentGatewayForm;
  /** As stored, to know which secrets can be revealed. */
  savedCredentials: GatewayCredential[];
}) {
  const endpointPickerId = React.useId();
  const webhookEndpoints = useWebhookEndpoints().data ?? [];
  const revealCredential = useRevealGatewayCredential();
  const [revealedName, setRevealedName] = React.useState<string | null>(null);
  const { gatewayInput, fieldErrors, updateInput } = gatewayForm;
  const credentials = gatewayInput.credentials;
  const changeCredential = (
    credentialIndex: number,
    changedFields: Partial<GatewayCredential>,
  ) => {
    updateInput({
      credentials: credentials.map((credential, candidateIndex) =>
        candidateIndex === credentialIndex
          ? { ...credential, ...changedFields }
          : credential,
      ),
    });
  };

  return (
    <div className="grid content-start gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">
          Merchant credentials
        </legend>
        <p className="text-xs text-muted-foreground">
          Templates read them as{" "}
          <code className="font-mono">merchant.&lt;name&gt;</code>. Secrets stay
          masked; the preview masks them too.
        </p>
        {credentials.map((credential, credentialIndex) => {
          const isSavedSecret = savedCredentials.some(
            (savedCredential) =>
              savedCredential.is_secret &&
              savedCredential.name === credential.name &&
              savedCredential.value === credential.value,
          );

          return (
            <div
              key={credentialIndex}
              className="grid grid-cols-[1fr_1.4fr_auto_auto_auto] items-center gap-2"
            >
              <Input
                aria-label={`Credential ${credentialIndex + 1} name`}
                className="font-mono text-xs"
                placeholder="store_id"
                value={credential.name}
                onChange={(changeEvent) =>
                  changeCredential(credentialIndex, {
                    name: changeEvent.target.value,
                  })
                }
              />
              <Input
                aria-label={`Credential ${credentialIndex + 1} value`}
                className="font-mono text-xs"
                value={credential.value}
                onChange={(changeEvent) =>
                  changeCredential(credentialIndex, {
                    value: changeEvent.target.value,
                  })
                }
              />
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={credential.is_secret}
                  onCheckedChange={(isChecked) =>
                    changeCredential(credentialIndex, {
                      is_secret: isChecked === true,
                    })
                  }
                />
                Secret
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Reveal ${credential.name}`}
                disabled={!isSavedSecret}
                onClick={() => setRevealedName(credential.name)}
              >
                <EyeIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove credential ${credentialIndex + 1}`}
                onClick={() =>
                  updateInput({
                    credentials: credentials.filter(
                      (_credential, candidateIndex) =>
                        candidateIndex !== credentialIndex,
                    ),
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          );
        })}
        <FormFieldError errorMessage={fieldErrors.credentials} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            updateInput({
              credentials: [
                ...credentials,
                { name: "", value: "", is_secret: false },
              ],
            })
          }
        >
          <PlusIcon />
          Add credential
        </Button>
      </fieldset>
      <FormField
        label="Notification endpoint"
        fieldId={endpointPickerId}
        hint="Its IPN or webhook deliveries go to this webhook endpoint, with retries and replay."
      >
        <Select
          value={gatewayInput.notification_endpoint_id ?? noEndpoint}
          onValueChange={(endpointId) =>
            updateInput({
              notification_endpoint_id:
                endpointId === noEndpoint ? null : endpointId,
            })
          }
        >
          <SelectTrigger id={endpointPickerId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noEndpoint}>
              None: send no notifications
            </SelectItem>
            {webhookEndpoints.map((webhookEndpoint) => (
              <SelectItem key={webhookEndpoint.id} value={webhookEndpoint.id}>
                {webhookEndpoint.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <ConfirmActionDialog
        isOpen={revealedName !== null}
        title={`Reveal ${revealedName ?? ""}?`}
        consequence="The secret is shown in plain text in this field until you close the sheet."
        confirmLabel="Reveal"
        onConfirm={() => {
          const credentialName = revealedName ?? "";
          revealCredential.mutate(
            { gatewayKey: gatewayInput.key, credentialName },
            {
              onSuccess: (revealedCredential) => {
                const credentialIndex = credentials.findIndex(
                  (credential) => credential.name === credentialName,
                );
                changeCredential(credentialIndex, {
                  value: revealedCredential.value,
                });
              },
              onError: () => toast.error("Could not reveal the secret"),
            },
          );
        }}
        onClose={() => setRevealedName(null)}
      />
    </div>
  );
}

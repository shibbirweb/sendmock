import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";

/** Name, fixed key, accent colour and the enabled switch (PY-12.2). */
export function GatewayGeneralTab({
  gatewayForm,
}: {
  gatewayForm: PaymentGatewayForm;
}) {
  const fieldIdPrefix = React.useId();
  const { gatewayInput, fieldErrors, updateInput } = gatewayForm;

  return (
    <div className="grid content-start gap-4">
      <FormField
        label="Name"
        fieldId={`${fieldIdPrefix}-name`}
        errorMessage={fieldErrors.name}
      >
        <Input
          id={`${fieldIdPrefix}-name`}
          value={gatewayInput.name}
          aria-invalid={fieldErrors.name !== undefined}
          onChange={(changeEvent) =>
            updateInput({ name: changeEvent.target.value })
          }
        />
      </FormField>
      <FormField
        label="Key"
        fieldId={`${fieldIdPrefix}-key`}
        hint="The provider value in the API and in /providers/<key>/... paths; fixed once added."
      >
        <Input
          id={`${fieldIdPrefix}-key`}
          className="font-mono text-sm"
          value={gatewayInput.key}
          readOnly
        />
      </FormField>
      <FormField
        label="Accent"
        fieldId={`${fieldIdPrefix}-accent`}
        hint="Used on its checkout pages."
        errorMessage={fieldErrors.accent}
      >
        <div className="flex gap-2">
          <input
            type="color"
            aria-label="Accent colour"
            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent"
            value={gatewayInput.accent}
            onChange={(changeEvent) =>
              updateInput({ accent: changeEvent.target.value })
            }
          />
          <Input
            id={`${fieldIdPrefix}-accent`}
            className="w-32 font-mono text-xs"
            value={gatewayInput.accent}
            onChange={(changeEvent) =>
              updateInput({ accent: changeEvent.target.value })
            }
          />
        </div>
      </FormField>
      <div className="flex items-center gap-2">
        <Switch
          id={`${fieldIdPrefix}-enabled`}
          checked={gatewayInput.is_enabled}
          onCheckedChange={(isEnabled) =>
            updateInput({ is_enabled: isEnabled })
          }
        />
        <Label htmlFor={`${fieldIdPrefix}-enabled`}>Enabled</Label>
      </div>
    </div>
  );
}

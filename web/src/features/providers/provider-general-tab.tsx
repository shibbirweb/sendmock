import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProviderCredentialsEditor } from "@/features/providers/provider-credentials-editor";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";
import type { ProviderCredential } from "@/lib/api/types";

/** Name, fixed key, accent, host, enabled and the credentials (EM-18.2, SM-16.2). */
export function ProviderGeneralTab({
  providerForm,
  savedCredentials,
}: {
  providerForm: MessageProviderForm;
  savedCredentials: ProviderCredential[];
}) {
  const fieldIdPrefix = React.useId();
  const { providerInput, fieldErrors, updateInput } = providerForm;

  return (
    <div className="grid content-start gap-4">
      <FormField
        label="Name"
        fieldId={`${fieldIdPrefix}-name`}
        errorMessage={fieldErrors.name}
      >
        <Input
          id={`${fieldIdPrefix}-name`}
          value={providerInput.name}
          aria-invalid={fieldErrors.name !== undefined}
          onChange={(changeEvent) =>
            updateInput({ name: changeEvent.target.value })
          }
        />
      </FormField>
      <FormField
        label="Key"
        fieldId={`${fieldIdPrefix}-key`}
        hint="Its /providers/<key>/ path and the name stored on messages; fixed once added."
      >
        <Input
          id={`${fieldIdPrefix}-key`}
          className="font-mono text-sm"
          value={providerInput.key}
          readOnly
        />
      </FormField>
      <FormField
        label="Host"
        fieldId={`${fieldIdPrefix}-host`}
        hint="The provider's API host. On the provider port it tells apart providers that share a path."
      >
        <Input
          id={`${fieldIdPrefix}-host`}
          className="font-mono text-sm"
          placeholder="api.example.com"
          value={providerInput.host ?? ""}
          onChange={(changeEvent) =>
            updateInput({ host: changeEvent.target.value.trim() || null })
          }
        />
      </FormField>
      <FormField
        label="Accent"
        fieldId={`${fieldIdPrefix}-accent`}
        hint="The colour of its badge on messages."
        errorMessage={fieldErrors.accent}
      >
        <div className="flex gap-2">
          <input
            type="color"
            aria-label="Accent colour"
            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent"
            value={providerInput.accent}
            onChange={(changeEvent) =>
              updateInput({ accent: changeEvent.target.value })
            }
          />
          <Input
            id={`${fieldIdPrefix}-accent`}
            className="w-32 font-mono text-xs"
            value={providerInput.accent}
            onChange={(changeEvent) =>
              updateInput({ accent: changeEvent.target.value })
            }
          />
        </div>
      </FormField>
      <div className="flex items-center gap-2">
        <Switch
          id={`${fieldIdPrefix}-enabled`}
          checked={providerInput.is_enabled}
          onCheckedChange={(isEnabled) =>
            updateInput({ is_enabled: isEnabled })
          }
        />
        <Label htmlFor={`${fieldIdPrefix}-enabled`}>Enabled</Label>
      </div>
      <ProviderCredentialsEditor
        providerForm={providerForm}
        savedCredentials={savedCredentials}
      />
      <div className="flex items-start gap-2">
        <Switch
          id={`${fieldIdPrefix}-check-credentials`}
          checked={providerInput.check_credentials}
          onCheckedChange={(isChecked) =>
            updateInput({ check_credentials: isChecked })
          }
        />
        <div className="grid gap-0.5">
          <Label htmlFor={`${fieldIdPrefix}-check-credentials`}>
            Check credentials
          </Label>
          <p className="text-xs text-muted-foreground">
            Off: any credentials pass. On: a request without a secret credential
            gets the provider's unauthorized answer.
          </p>
        </div>
      </div>
    </div>
  );
}

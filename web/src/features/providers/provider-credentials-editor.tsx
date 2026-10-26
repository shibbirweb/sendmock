import { EyeIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";
import { useRevealProviderCredential } from "@/lib/api/hooks/use-message-provider-queries";
import type { ProviderCredential } from "@/lib/api/types";

/** Credentials as name / value rows; secrets stay masked, a reveal asks first. */
export function ProviderCredentialsEditor({
  providerForm,
  savedCredentials,
}: {
  providerForm: MessageProviderForm;
  /** As stored, to know which secrets can be revealed. */
  savedCredentials: ProviderCredential[];
}) {
  const revealCredential = useRevealProviderCredential(
    providerForm.providerArea,
  );
  const [revealedName, setRevealedName] = React.useState<string | null>(null);
  const { providerInput, fieldErrors, updateInput } = providerForm;
  const credentials = providerInput.credentials;
  const changeCredential = (
    credentialIndex: number,
    changedFields: Partial<ProviderCredential>,
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
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Credentials</legend>
      <p className="text-xs text-muted-foreground">
        What your app is configured with. Templates read them as{" "}
        <code className="font-mono">credentials.&lt;name&gt;</code>; secrets
        stay masked, in the preview too.
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
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto_auto]"
          >
            <Input
              aria-label={`Credential ${credentialIndex + 1} name`}
              className="font-mono text-xs"
              placeholder="api_key"
              value={credential.name}
              onChange={(changeEvent) =>
                changeCredential(credentialIndex, {
                  name: changeEvent.target.value,
                })
              }
            />
            <Input
              aria-label={`Credential ${credentialIndex + 1} value`}
              className="col-span-4 row-start-2 font-mono text-xs sm:col-span-1 sm:row-start-auto"
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
      <ConfirmActionDialog
        isOpen={revealedName !== null}
        title={`Reveal ${revealedName ?? ""}?`}
        consequence="The secret is shown in plain text in this field until you close the sheet."
        confirmLabel="Reveal"
        onConfirm={() => {
          const credentialName = revealedName ?? "";
          revealCredential.mutate(
            { providerKey: providerInput.key, credentialName },
            {
              onSuccess: (revealedCredential) => {
                changeCredential(
                  credentials.findIndex(
                    (credential) => credential.name === credentialName,
                  ),
                  { value: revealedCredential.value },
                );
              },
              onError: () => toast.error("Could not reveal the secret"),
            },
          );
        }}
        onClose={() => setRevealedName(null)}
      />
    </fieldset>
  );
}

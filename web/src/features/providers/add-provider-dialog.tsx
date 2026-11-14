import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { providerAreaCopy } from "@/features/providers/provider-area-copy";
import { ApiError } from "@/lib/api/api-client";
import { useCreateMessageProvider } from "@/lib/api/hooks/use-message-provider-queries";
import type {
  MessageProviderArea,
  MessageProviderDefinition,
} from "@/lib/api/types";
import { toDefinitionKey } from "@/lib/payments/to-definition-key";
import {
  type MessageProviderFieldErrors,
  validateNewProvider,
} from "@/lib/providers/validate-message-provider";

const blankStart = "blank";

/** A new provider, blank or copied from another of the area (EM-18.2, SM-16.2). Mount when opening. */
export function AddProviderDialog({
  providerArea,
  messageProviders,
  onCreated,
  onClose,
}: {
  providerArea: MessageProviderArea;
  messageProviders: MessageProviderDefinition[];
  onCreated: (createdProvider: MessageProviderDefinition) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const createProvider = useCreateMessageProvider(providerArea);
  const [providerName, setProviderName] = React.useState("");
  const [typedKey, setTypedKey] = React.useState<string | null>(null);
  const [startFromKey, setStartFromKey] = React.useState(blankStart);
  const [errorMessages, setErrorMessages] =
    React.useState<MessageProviderFieldErrors>({});
  const providerKey = typedKey ?? toDefinitionKey(providerName);
  const areaCopy = providerAreaCopy[providerArea];

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            const validationErrors = validateNewProvider(
              providerKey,
              providerName,
              messageProviders,
            );
            setErrorMessages(validationErrors);
            if (Object.keys(validationErrors).length > 0) {
              return;
            }
            createProvider.mutate(
              {
                name: providerName.trim(),
                key: providerKey,
                start_from: startFromKey === blankStart ? null : startFromKey,
              },
              {
                onSuccess: onCreated,
                onError: (requestError) => {
                  setErrorMessages({
                    key:
                      requestError instanceof ApiError
                        ? requestError.message
                        : "Could not add the provider",
                  });
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a provider</DialogTitle>
            <DialogDescription>
              Answer a provider SendMock does not ship, from blank or from the
              closest {areaCopy.areaNoun} provider; you set its requests and
              responses next.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Name"
            fieldId={`${fieldIdPrefix}-name`}
            errorMessage={errorMessages.name}
          >
            <Input
              id={`${fieldIdPrefix}-name`}
              placeholder={areaCopy.namePlaceholder}
              value={providerName}
              aria-invalid={errorMessages.name !== undefined}
              onChange={(changeEvent) =>
                setProviderName(changeEvent.target.value)
              }
            />
          </FormField>
          <FormField
            label="Key"
            fieldId={`${fieldIdPrefix}-key`}
            hint="Its /providers/<key>/ path and the name stored on messages; fixed once added."
            errorMessage={errorMessages.key}
          >
            <Input
              id={`${fieldIdPrefix}-key`}
              className="font-mono text-sm"
              value={providerKey}
              aria-invalid={errorMessages.key !== undefined}
              onChange={(changeEvent) => setTypedKey(changeEvent.target.value)}
            />
          </FormField>
          <FormField label="Start from" fieldId={`${fieldIdPrefix}-start`}>
            <Select value={startFromKey} onValueChange={setStartFromKey}>
              <SelectTrigger id={`${fieldIdPrefix}-start`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={blankStart}>
                  Blank (one send request)
                </SelectItem>
                {messageProviders.map((messageProvider) => (
                  <SelectItem
                    key={messageProvider.key}
                    value={messageProvider.key}
                  >
                    A copy of {messageProvider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProvider.isPending}>
              Add provider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

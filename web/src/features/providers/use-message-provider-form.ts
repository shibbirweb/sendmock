import * as React from "react";
import { toast } from "sonner";

import { toProviderInput } from "@/features/providers/to-provider-input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError } from "@/lib/api/api-client";
import {
  useMessageProviderPreview,
  useSaveMessageProvider,
} from "@/lib/api/hooks/use-message-provider-queries";
import type {
  MessageProviderArea,
  MessageProviderDefinition,
  MessageProviderInput,
  ProviderSampleRequest,
} from "@/lib/api/types";
import { validateMessageProvider } from "@/lib/providers/validate-message-provider";

/**
 * State, validation, the live preview and saving for the provider sheet
 * (EM-18.2, EM-18.4, SM-16.2, SM-16.4). A save is refused while a template has
 * errors or a path clashes with another provider.
 */
export function useMessageProviderForm(
  providerArea: MessageProviderArea,
  messageProvider: MessageProviderDefinition,
  areaProviders: MessageProviderDefinition[],
  onSaved: () => void,
) {
  const saveProvider = useSaveMessageProvider(providerArea);
  // What the sheet opened with: "unsaved changes" are measured against it.
  const [openedInput] = React.useState(() =>
    structuredClone(toProviderInput(messageProvider)),
  );
  const [providerInput, setProviderInput] = React.useState(openedInput);
  const [sampleRequest, setSampleRequest] = React.useState<
    ProviderSampleRequest | undefined
  >(undefined);
  const [hasTriedSave, setTriedSave] = React.useState(false);
  const debouncedInput = useDebouncedValue(providerInput, 250);
  const debouncedSample = useDebouncedValue(sampleRequest, 250);
  const previewQuery = useMessageProviderPreview(providerArea, {
    provider: debouncedInput,
    ...(debouncedSample === undefined
      ? {}
      : { sample_request: debouncedSample }),
  });
  const validate = () => validateMessageProvider(providerInput, areaProviders);
  const fieldErrors = hasTriedSave ? validate() : {};
  const templateErrors = (previewQuery.data?.problems ?? []).filter(
    (problem) => problem.severity === "error",
  );

  return {
    providerArea,
    providerInput,
    fieldErrors,
    previewQuery,
    templateErrors,
    sampleRequest,
    isDirty: JSON.stringify(providerInput) !== JSON.stringify(openedInput),
    isSaving: saveProvider.isPending,
    updateInput: (changedFields: Partial<MessageProviderInput>) => {
      setProviderInput((previousInput) => ({
        ...previousInput,
        ...changedFields,
      }));
    },
    /** An edited sample request, or undefined for the provider's default send. */
    changeSampleRequest: setSampleRequest,
    save: () => {
      setTriedSave(true);
      const firstError = Object.values(validate())[0];
      if (firstError !== undefined) {
        toast.error(firstError);
        return;
      }
      saveProvider.mutate(providerInput, {
        onSuccess: () => {
          toast(`${providerInput.name} saved`);
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the provider",
          );
        },
      });
    },
  };
}

export type MessageProviderForm = ReturnType<typeof useMessageProviderForm>;

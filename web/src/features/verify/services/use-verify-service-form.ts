import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import {
  useCreateVerifyService,
  useUpdateVerifyService,
} from "@/lib/api/hooks/use-verify-queries";
import type { VerifyService, VerifyServiceInput } from "@/lib/api/types";
import {
  type VerifyServiceFieldErrors,
  validateVerifyServiceInput,
} from "@/lib/verify/validate-verify-service";

export type VerifyServiceFormValues = {
  friendlyName: string;
  codeLength: number;
  fixedCode: string;
  ttlMinutes: string;
};

const newServiceValues: VerifyServiceFormValues = {
  friendlyName: "",
  codeLength: 6,
  fixedCode: "",
  ttlMinutes: "10",
};

function toFormValues(verifyService: VerifyService): VerifyServiceFormValues {
  return {
    friendlyName: verifyService.friendly_name,
    codeLength: verifyService.code_length,
    fixedCode: verifyService.fixed_code ?? "",
    ttlMinutes: String(verifyService.ttl_seconds / 60),
  };
}

function toServiceInput(
  formValues: VerifyServiceFormValues,
): VerifyServiceInput {
  const fixedCode = formValues.fixedCode.trim();

  return {
    friendly_name: formValues.friendlyName,
    code_length: formValues.codeLength,
    fixed_code: fixedCode === "" ? null : fixedCode,
    ttl_seconds: Math.round(Number(formValues.ttlMinutes) * 60),
  };
}

/** State, validation and saving for the create / edit service dialog. */
export function useVerifyServiceForm({
  editedService,
  onSaved,
}: {
  editedService: VerifyService | null;
  onSaved: () => void;
}) {
  const createVerifyService = useCreateVerifyService();
  const updateVerifyService = useUpdateVerifyService();
  const [formValues, setFormValues] = React.useState(() =>
    editedService === null ? newServiceValues : toFormValues(editedService),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<VerifyServiceFieldErrors>({});
  const isSaving =
    createVerifyService.isPending || updateVerifyService.isPending;

  const updateFormValues = (
    changedValues: Partial<VerifyServiceFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const saveService = () => {
    const serviceInput = toServiceInput(formValues);
    const validationErrors = validateVerifyServiceInput(serviceInput);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const mutationCallbacks = {
      onSuccess: () => {
        toast(editedService === null ? "Service created" : "Service saved");
        onSaved();
      },
      onError: (requestError: unknown) => {
        toast.error(
          requestError instanceof ApiError
            ? requestError.message
            : "Could not save the service",
        );
      },
    };

    if (editedService === null) {
      createVerifyService.mutate(serviceInput, mutationCallbacks);
      return;
    }

    updateVerifyService.mutate(
      { serviceSid: editedService.sid, serviceInput },
      mutationCallbacks,
    );
  };

  return { formValues, updateFormValues, fieldErrors, isSaving, saveService };
}

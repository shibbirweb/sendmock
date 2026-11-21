import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSaveTwilioSubaccount } from "@/lib/api/hooks/use-twilio-account-queries";
import type {
  TwilioAccountStatus,
  TwilioSubaccount,
  TwilioSubaccountInput,
} from "@/lib/api/types";

export type TwilioSubaccountFormValues = {
  accountSid: string;
  friendlyName: string;
  status: TwilioAccountStatus;
  authToken: string;
  debuggerUrl: string;
};

export type TwilioSubaccountFieldErrors = Partial<
  Record<"account_sid" | "friendly_name" | "debugger_url", string>
>;

const accountSidPattern = /^AC[0-9a-fA-F]{32}$/;

function toFormValues(
  editedSubaccount: TwilioSubaccount | null,
): TwilioSubaccountFormValues {
  return {
    accountSid: editedSubaccount?.account_sid ?? "",
    friendlyName: editedSubaccount?.friendly_name ?? "",
    status: editedSubaccount?.status ?? "active",
    authToken: editedSubaccount?.auth_token ?? "",
    debuggerUrl: editedSubaccount?.debugger_url ?? "",
  };
}

export function validateTwilioSubaccount(
  formValues: TwilioSubaccountFormValues,
  isNew: boolean,
): TwilioSubaccountFieldErrors {
  const fieldErrors: TwilioSubaccountFieldErrors = {};
  const accountSid = formValues.accountSid.trim();
  if (isNew && accountSid !== "" && !accountSidPattern.test(accountSid)) {
    fieldErrors.account_sid = "An account SID is AC and 32 hex digits";
  }
  if (formValues.friendlyName.trim() === "") {
    fieldErrors.friendly_name = "Enter a name";
  }
  const debuggerUrl = formValues.debuggerUrl.trim();
  if (debuggerUrl !== "" && !/^https?:\/\/\S+$/i.test(debuggerUrl)) {
    fieldErrors.debugger_url = "Enter an http or https URL";
  }
  return fieldErrors;
}

function toSubaccountInput(
  formValues: TwilioSubaccountFormValues,
): TwilioSubaccountInput {
  const toNullable = (fieldText: string) =>
    fieldText.trim() === "" ? null : fieldText.trim();

  return {
    account_sid: toNullable(formValues.accountSid),
    friendly_name: formValues.friendlyName.trim(),
    status: formValues.status,
    // Empty or still masked keeps the stored token; empty on a new one generates it.
    auth_token: toNullable(formValues.authToken),
    debugger_url: toNullable(formValues.debuggerUrl),
  };
}

/** State, validation and saving for the subaccount dialog (SM-19.4). */
export function useTwilioSubaccountForm({
  editedSubaccount,
  onSaved,
}: {
  editedSubaccount: TwilioSubaccount | null;
  onSaved: () => void;
}) {
  const saveSubaccount = useSaveTwilioSubaccount();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedSubaccount),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<TwilioSubaccountFieldErrors>({});
  const isNew = editedSubaccount === null;

  const updateFormValues = (
    changedValues: Partial<TwilioSubaccountFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const save = () => {
    const validationErrors = validateTwilioSubaccount(formValues, isNew);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    saveSubaccount.mutate(
      {
        accountSid: editedSubaccount?.account_sid ?? null,
        subaccountInput: toSubaccountInput(formValues),
      },
      {
        onSuccess: () => {
          toast(isNew ? "Subaccount added" : "Subaccount saved");
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the subaccount",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    isNew,
    isSaving: saveSubaccount.isPending,
    save,
  };
}

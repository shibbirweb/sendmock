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
import { useTwilioSubaccountForm } from "@/features/providers/twilio-accounts/use-twilio-subaccount-form";
import type { TwilioAccountStatus, TwilioSubaccount } from "@/lib/api/types";

export const twilioAccountStatusLabels: Record<TwilioAccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
};

function TwilioSubaccountForm({
  editedSubaccount,
  onDone,
}: {
  editedSubaccount: TwilioSubaccount | null;
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const { formValues, updateFormValues, fieldErrors, isNew, isSaving, save } =
    useTwilioSubaccountForm({ editedSubaccount, onSaved: onDone });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(submitEvent) => {
        // The provider sheet around this dialog is a form too; React bubbles through portals.
        submitEvent.preventDefault();
        submitEvent.stopPropagation();
        save();
      }}
    >
      {isNew && (
        <FormField
          label="Account SID"
          fieldId={`${fieldIdPrefix}-sid`}
          hint="Leave empty for a new AC SID, or paste the SID your app is configured with."
          errorMessage={fieldErrors.account_sid}
        >
          <Input
            id={`${fieldIdPrefix}-sid`}
            className="font-mono text-xs"
            placeholder="AC22222222222222222222222222222222"
            value={formValues.accountSid}
            aria-invalid={fieldErrors.account_sid !== undefined}
            onChange={(changeEvent) => {
              updateFormValues({ accountSid: changeEvent.target.value });
            }}
          />
        </FormField>
      )}
      <FormField
        label="Name"
        fieldId={`${fieldIdPrefix}-name`}
        errorMessage={fieldErrors.friendly_name}
      >
        <Input
          id={`${fieldIdPrefix}-name`}
          placeholder="Acme Clinic"
          value={formValues.friendlyName}
          aria-invalid={fieldErrors.friendly_name !== undefined}
          onChange={(changeEvent) => {
            updateFormValues({ friendlyName: changeEvent.target.value });
          }}
        />
      </FormField>
      <FormField
        label="Status"
        fieldId={`${fieldIdPrefix}-status`}
        hint="A send under a suspended or closed subaccount is refused, as Twilio does."
      >
        <Select
          value={formValues.status}
          onValueChange={(selectedStatus) => {
            updateFormValues({ status: selectedStatus as TwilioAccountStatus });
          }}
        >
          <SelectTrigger id={`${fieldIdPrefix}-status`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(twilioAccountStatusLabels).map(
              ([status, statusLabel]) => (
                <SelectItem key={status} value={status}>
                  {statusLabel}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        label="Auth token"
        fieldId={`${fieldIdPrefix}-token`}
        hint={
          isNew
            ? "Leave empty for a generated token."
            : "Leave it masked to keep the token; type a new one to change it."
        }
      >
        <Input
          id={`${fieldIdPrefix}-token`}
          className="font-mono text-xs"
          autoComplete="off"
          value={formValues.authToken}
          onChange={(changeEvent) => {
            updateFormValues({ authToken: changeEvent.target.value });
          }}
        />
      </FormField>
      <FormField
        label="Debugger webhook URL"
        fieldId={`${fieldIdPrefix}-debugger`}
        hint="Optional. Where Twilio Debugger events for this subaccount go."
        errorMessage={fieldErrors.debugger_url}
      >
        <Input
          id={`${fieldIdPrefix}-debugger`}
          placeholder="http://localhost:8000/twilio/debugger"
          value={formValues.debuggerUrl}
          aria-invalid={fieldErrors.debugger_url !== undefined}
          onChange={(changeEvent) => {
            updateFormValues({ debuggerUrl: changeEvent.target.value });
          }}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isNew ? "Add subaccount" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Add or edit a subaccount of the Twilio provider's main account (SM-19.4). */
export function TwilioSubaccountDialog({
  isOpen,
  editedSubaccount,
  onOpenChange,
}: {
  isOpen: boolean;
  editedSubaccount: TwilioSubaccount | null;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editedSubaccount === null ? "Add subaccount" : "Edit subaccount"}
          </DialogTitle>
          <DialogDescription>
            Messages sent under its SID are signed with its own auth token.
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <TwilioSubaccountForm
            key={editedSubaccount?.account_sid ?? "new"}
            editedSubaccount={editedSubaccount}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

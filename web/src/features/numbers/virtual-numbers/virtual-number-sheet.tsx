import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  numberChannelLabels,
  numberChannels,
} from "@/features/numbers/numbers-labels";
import {
  noMessagingService,
  useVirtualNumberForm,
} from "@/features/numbers/virtual-numbers/use-virtual-number-form";
import { VirtualNumberInboundFields } from "@/features/numbers/virtual-numbers/virtual-number-inbound-fields";
import { useMessagingServices } from "@/lib/api/hooks/use-numbers-queries";
import type { VirtualNumber } from "@/lib/api/types";

function VirtualNumberForm({
  editedNumber,
  registeredNumbers,
  onDone,
}: {
  editedNumber: VirtualNumber | null;
  registeredNumbers: string[];
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const messagingServicesQuery = useMessagingServices();
  const {
    formValues,
    updateFormValues,
    toggleChannel,
    fieldErrors,
    isSaving,
    saveNumber,
  } = useVirtualNumberForm({
    editedNumber,
    registeredNumbers,
    onSaved: onDone,
  });

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveNumber();
      }}
    >
      <div className="grid gap-4 overflow-y-auto px-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Number"
            fieldId={`${fieldIdPrefix}-number`}
            errorMessage={fieldErrors.number}
          >
            <Input
              id={`${fieldIdPrefix}-number`}
              inputMode="tel"
              placeholder="+15550001111"
              className="font-mono"
              value={formValues.number}
              aria-invalid={fieldErrors.number !== undefined}
              onChange={(changeEvent) => {
                updateFormValues({ number: changeEvent.target.value });
              }}
            />
          </FormField>
          <FormField
            label="Label"
            fieldId={`${fieldIdPrefix}-label`}
            errorMessage={fieldErrors.label}
          >
            <Input
              id={`${fieldIdPrefix}-label`}
              placeholder="Support line"
              value={formValues.label}
              aria-invalid={fieldErrors.label !== undefined}
              onChange={(changeEvent) => {
                updateFormValues({ label: changeEvent.target.value });
              }}
            />
          </FormField>
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Channels</legend>
          <div className="flex gap-4">
            {numberChannels.map((numberChannel) => (
              <div key={numberChannel} className="flex items-center gap-2">
                <Checkbox
                  id={`${fieldIdPrefix}-${numberChannel}`}
                  checked={formValues.channels.includes(numberChannel)}
                  onCheckedChange={(checkedState) => {
                    toggleChannel(numberChannel, checkedState === true);
                  }}
                />
                <Label
                  htmlFor={`${fieldIdPrefix}-${numberChannel}`}
                  className="font-normal"
                >
                  {numberChannelLabels[numberChannel]}
                </Label>
              </div>
            ))}
          </div>
          <FormFieldError errorMessage={fieldErrors.channels} />
        </fieldset>
        <VirtualNumberInboundFields
          formValues={formValues}
          fieldErrors={fieldErrors}
          onChange={updateFormValues}
        />
        <FormField
          label="Default status callback"
          fieldId={`${fieldIdPrefix}-callback`}
          hint="Used when a send from this number has no StatusCallback."
          errorMessage={fieldErrors.status_callback_url}
        >
          <Input
            id={`${fieldIdPrefix}-callback`}
            placeholder="Optional"
            value={formValues.statusCallbackUrl}
            aria-invalid={fieldErrors.status_callback_url !== undefined}
            onChange={(changeEvent) => {
              updateFormValues({ statusCallbackUrl: changeEvent.target.value });
            }}
          />
        </FormField>
        <FormField
          label="Messaging Service"
          fieldId={`${fieldIdPrefix}-service`}
        >
          <Select
            value={formValues.messagingServiceSid}
            onValueChange={(selectedServiceSid) => {
              updateFormValues({ messagingServiceSid: selectedServiceSid });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-service`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={noMessagingService}>None</SelectItem>
              {(messagingServicesQuery.data ?? []).map((messagingService) => (
                <SelectItem
                  key={messagingService.sid}
                  value={messagingService.sid}
                >
                  {messagingService.friendly_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editedNumber === null ? "Add number" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Side sheet to add or edit a virtual number (SM-12.1). */
export function VirtualNumberSheet({
  isOpen,
  editedNumber,
  registeredNumbers,
  onOpenChange,
}: {
  isOpen: boolean;
  editedNumber: VirtualNumber | null;
  registeredNumbers: string[];
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {editedNumber === null ? "Add a number" : "Edit number"}
          </SheetTitle>
          <SheetDescription>
            A fake number your app owns, set up like a provider console.
          </SheetDescription>
        </SheetHeader>
        {isOpen && (
          <VirtualNumberForm
            key={editedNumber?.id ?? "new"}
            editedNumber={editedNumber}
            registeredNumbers={registeredNumbers}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

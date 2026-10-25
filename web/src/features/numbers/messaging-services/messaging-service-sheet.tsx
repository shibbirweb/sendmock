import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MessagingServicePoolField } from "@/features/numbers/messaging-services/messaging-service-pool-field";
import { useMessagingServiceForm } from "@/features/numbers/messaging-services/use-messaging-service-form";
import {
  inboundModeDescriptions,
  inboundModeLabels,
  inboundModes,
} from "@/features/numbers/numbers-labels";
import type { MessagingService } from "@/lib/api/types";

function MessagingServiceForm({
  editedService,
  messagingServices,
  onDone,
}: {
  editedService: MessagingService | null;
  messagingServices: MessagingService[];
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const {
    formValues,
    updateFormValues,
    togglePoolNumber,
    fieldErrors,
    isSaving,
    saveService,
  } = useMessagingServiceForm({ editedService, onSaved: onDone });

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveService();
      }}
    >
      <div className="grid gap-4 overflow-y-auto px-4 pb-4">
        <FormField
          label="Name"
          fieldId={`${fieldIdPrefix}-name`}
          errorMessage={fieldErrors.friendly_name}
        >
          <Input
            id={`${fieldIdPrefix}-name`}
            placeholder="Acme notifications"
            value={formValues.friendlyName}
            aria-invalid={fieldErrors.friendly_name !== undefined}
            onChange={(changeEvent) => {
              updateFormValues({ friendlyName: changeEvent.target.value });
            }}
          />
        </FormField>
        <MessagingServicePoolField
          fieldIdPrefix={fieldIdPrefix}
          editedServiceSid={editedService?.sid ?? null}
          selectedNumberIds={formValues.numberIds}
          messagingServices={messagingServices}
          onToggle={togglePoolNumber}
        />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Inbound messages</legend>
          {inboundModes.map((inboundMode) => {
            const optionId = `${fieldIdPrefix}-mode-${inboundMode}`;

            return (
              <label
                key={inboundMode}
                htmlFor={optionId}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm has-checked:border-primary"
              >
                <input
                  id={optionId}
                  type="radio"
                  name={`${fieldIdPrefix}-inbound-mode`}
                  className="mt-0.5 accent-primary"
                  checked={formValues.inboundMode === inboundMode}
                  onChange={() => {
                    updateFormValues({ inboundMode });
                  }}
                />
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {inboundModeLabels[inboundMode]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {inboundModeDescriptions[inboundMode]}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        {formValues.inboundMode === "webhook" && (
          <div className="grid gap-3">
            <FormField
              label="Request URL"
              fieldId={`${fieldIdPrefix}-url`}
              errorMessage={fieldErrors.inbound_url}
            >
              <Input
                id={`${fieldIdPrefix}-url`}
                placeholder="http://localhost:8000/sms/inbound"
                value={formValues.inboundUrl}
                aria-invalid={fieldErrors.inbound_url !== undefined}
                onChange={(changeEvent) => {
                  updateFormValues({ inboundUrl: changeEvent.target.value });
                }}
              />
            </FormField>
            <FormField
              label="Fallback URL"
              fieldId={`${fieldIdPrefix}-fallback`}
              errorMessage={fieldErrors.inbound_fallback_url}
            >
              <Input
                id={`${fieldIdPrefix}-fallback`}
                placeholder="Optional"
                value={formValues.inboundFallbackUrl}
                aria-invalid={fieldErrors.inbound_fallback_url !== undefined}
                onChange={(changeEvent) => {
                  updateFormValues({
                    inboundFallbackUrl: changeEvent.target.value,
                  });
                }}
              />
            </FormField>
          </div>
        )}
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editedService === null ? "Create service" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Create or edit a Twilio-style Messaging Service (SM-03.4). */
export function MessagingServiceSheet({
  isOpen,
  editedService,
  messagingServices,
  onOpenChange,
}: {
  isOpen: boolean;
  editedService: MessagingService | null;
  messagingServices: MessagingService[];
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {editedService === null
              ? "New Messaging Service"
              : "Edit Messaging Service"}
          </SheetTitle>
          <SheetDescription>
            Apps send with MessagingServiceSid and SendMock picks a sender from
            the pool.
          </SheetDescription>
        </SheetHeader>
        {isOpen && (
          <MessagingServiceForm
            key={editedService?.sid ?? "new"}
            editedService={editedService}
            messagingServices={messagingServices}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MockResponseFields } from "@/features/http/responses/mock-response-fields";
import {
  toMockResponse,
  toMockResponseFormValues,
} from "@/features/http/responses/use-response-rule-form";
import { useUpdateDefaultResponse } from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpBin } from "@/lib/api/types";

/** The reply when no rule matches (HC-02.1). Mount when opening. */
export function DefaultReplySheet({
  httpBin,
  onClose,
}: {
  httpBin: HttpBin;
  onClose: () => void;
}) {
  const updateDefaultResponse = useUpdateDefaultResponse();
  const [formValues, setFormValues] = React.useState(() =>
    toMockResponseFormValues(httpBin.default_response),
  );
  const [statusCodeError, setStatusCodeError] = React.useState<
    string | undefined
  >();

  return (
    <Sheet
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Default reply of {httpBin.name}</SheetTitle>
          <SheetDescription>Sent when no rule matches.</SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            const defaultResponse = toMockResponse(formValues);
            const isStatusValid =
              Number.isInteger(defaultResponse.status_code) &&
              defaultResponse.status_code >= 100 &&
              defaultResponse.status_code <= 599;
            setStatusCodeError(
              isStatusValid ? undefined : "Use a status code from 100 to 599",
            );
            if (!isStatusValid) {
              return;
            }
            updateDefaultResponse.mutate(
              { binId: httpBin.id, defaultResponse },
              {
                onSuccess: () => {
                  toast("Default reply saved");
                  onClose();
                },
              },
            );
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <MockResponseFields
              formValues={formValues}
              statusCodeError={statusCodeError}
              onChange={(changedValues) => {
                setFormValues((previousValues) => ({
                  ...previousValues,
                  ...changedValues,
                }));
              }}
            />
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateDefaultResponse.isPending}>
              Save reply
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

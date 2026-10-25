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
import { RouteActionsEditor } from "@/features/webhooks/inbound-routes/route-actions-editor";
import { RouteFilterFields } from "@/features/webhooks/inbound-routes/route-filter-fields";
import { RouteMatchPreview } from "@/features/webhooks/inbound-routes/route-match-preview";
import { useInboundRouteForm } from "@/features/webhooks/inbound-routes/use-inbound-route-form";
import type { InboundRoute } from "@/lib/api/types";

/** Add or edit a route with a live match preview (WH-12.7). Mount when opening. */
export function InboundRouteSheet({
  inboundRoute,
  onClose,
}: {
  inboundRoute: InboundRoute | null;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const routeForm = useInboundRouteForm(inboundRoute, onClose);
  const { routeInput, fieldErrors, updateInput } = routeForm;

  return (
    <Sheet open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>
            {inboundRoute === null ? "Add route" : "Edit route"}
          </SheetTitle>
          <SheetDescription>
            Which incoming emails it takes, and what it does with them, in
            Mailgun&apos;s route syntax.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            routeForm.save();
          }}
        >
          <div className="grid min-h-0 flex-1 items-start gap-6 overflow-y-auto px-4 pb-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <FormField
                  label="Priority"
                  fieldId={`${fieldIdPrefix}-priority`}
                  hint="Lower runs first."
                  errorMessage={fieldErrors.priority}
                >
                  <Input
                    id={`${fieldIdPrefix}-priority`}
                    inputMode="numeric"
                    value={String(routeInput.priority)}
                    onChange={(changeEvent) =>
                      updateInput({
                        priority: Number(changeEvent.target.value),
                      })
                    }
                  />
                </FormField>
                <FormField
                  label="Description"
                  fieldId={`${fieldIdPrefix}-description`}
                  errorMessage={fieldErrors.description}
                >
                  <Input
                    id={`${fieldIdPrefix}-description`}
                    placeholder="Ticket replies to Laravel"
                    value={routeInput.description}
                    onChange={(changeEvent) =>
                      updateInput({ description: changeEvent.target.value })
                    }
                  />
                </FormField>
              </div>
              <RouteFilterFields routeForm={routeForm} />
              <RouteActionsEditor routeForm={routeForm} />
            </div>
            <RouteMatchPreview testResult={routeForm.testResult} />
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={routeForm.isSaving}>
              {inboundRoute === null ? "Add route" : "Save route"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

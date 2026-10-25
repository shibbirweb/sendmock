import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { RuleEventsPicker } from "@/features/webhooks/rules/editor/rule-events-picker";
import { RulePreviewPanel } from "@/features/webhooks/rules/editor/rule-preview-panel";
import {
  toRuleInput,
  useWebhookRuleForm,
} from "@/features/webhooks/rules/editor/use-webhook-rule-form";
import { FilterBuilder } from "@/features/webhooks/rules/filter-builder/filter-builder";
import type { WebhookEndpoint, WebhookRule } from "@/lib/api/types";
import type { BuilderGroup } from "@/lib/webhooks/rule-filter/builder-tree";
import { listFieldsForEvents } from "@/lib/webhooks/rule-filter/rule-fields";
import { findFirstFilterError } from "@/lib/webhooks/rule-filter/validate-rule-filter";

function WebhookRuleForm({
  editedRule,
  webhookEndpoints,
  defaultEndpointId,
  onDone,
}: {
  editedRule: WebhookRule | null;
  webhookEndpoints: WebhookEndpoint[];
  defaultEndpointId: string;
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const {
    formValues,
    updateFormValues,
    fieldErrors,
    hasTriedSaving,
    isSaving,
    saveRule,
  } = useWebhookRuleForm({ editedRule, defaultEndpointId, onSaved: onDone });
  const ruleFilter = toRuleInput(formValues).filter;
  const fieldDefinitions = listFieldsForEvents(formValues.events);
  const handleRootGroupChange = React.useCallback(
    (rootGroup: BuilderGroup) => {
      updateFormValues({ rootGroup });
    },
    [updateFormValues],
  );

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveRule();
      }}
    >
      <div className="grid gap-5 overflow-y-auto px-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Name"
            fieldId={`${fieldIdPrefix}-name`}
            errorMessage={fieldErrors.name}
          >
            <Input
              id={`${fieldIdPrefix}-name`}
              placeholder="Support inbox to Laravel"
              value={formValues.name}
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(changeEvent) => {
                updateFormValues({ name: changeEvent.target.value });
              }}
            />
          </FormField>
          <FormField
            label="Endpoint"
            fieldId={`${fieldIdPrefix}-endpoint`}
            errorMessage={fieldErrors.endpoint_id}
          >
            <Select
              value={formValues.endpointId}
              onValueChange={(endpointId) => {
                updateFormValues({ endpointId });
              }}
            >
              <SelectTrigger
                id={`${fieldIdPrefix}-endpoint`}
                aria-invalid={fieldErrors.endpoint_id !== undefined}
                className="w-full"
              >
                <SelectValue placeholder="Pick an endpoint" />
              </SelectTrigger>
              <SelectContent>
                {webhookEndpoints.map((webhookEndpoint) => (
                  <SelectItem
                    key={webhookEndpoint.id}
                    value={webhookEndpoint.id}
                  >
                    {webhookEndpoint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Events</h3>
          <RuleEventsPicker
            pickerId={`${fieldIdPrefix}-events`}
            selectedEvents={formValues.events}
            onChange={(events) => {
              updateFormValues({ events });
            }}
          />
          <FormFieldError errorMessage={fieldErrors.events} />
        </section>
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Filter</h3>
          {fieldDefinitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The selected events have no filter fields, so every one of them
              fires.
            </p>
          ) : (
            <FilterBuilder
              rootGroup={formValues.rootGroup}
              fieldDefinitions={fieldDefinitions}
              isShowingErrors={hasTriedSaving}
              onChange={handleRootGroupChange}
            />
          )}
        </section>
        <section className="grid gap-2 rounded-md border p-3">
          <h3 className="text-sm font-medium">Preview</h3>
          <RulePreviewPanel
            previewRequest={{ events: formValues.events, filter: ruleFilter }}
            isFilterComplete={findFirstFilterError(ruleFilter) === undefined}
          />
        </section>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editedRule === null ? "Add rule" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Side sheet to add or edit a rule with the visual filter builder (WH-02). */
export function WebhookRuleSheet({
  isOpen,
  editedRule,
  webhookEndpoints,
  defaultEndpointId,
  onOpenChange,
}: {
  isOpen: boolean;
  editedRule: WebhookRule | null;
  webhookEndpoints: WebhookEndpoint[];
  defaultEndpointId: string;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {editedRule === null ? "Add a rule" : editedRule.name}
          </SheetTitle>
          <SheetDescription>
            Which events go to the endpoint, and only when the filter matches.
          </SheetDescription>
        </SheetHeader>
        {isOpen && (
          <WebhookRuleForm
            key={editedRule?.id ?? "new"}
            editedRule={editedRule}
            webhookEndpoints={webhookEndpoints}
            defaultEndpointId={defaultEndpointId}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isSuggestionPopupOpen } from "@/features/webhooks/templates/reference/template-text-field";
import {
  globalScopeValue,
  useVariableForm,
} from "@/features/webhooks/variables/sheet/use-variable-form";
import { VariableResolvesTo } from "@/features/webhooks/variables/sheet/variable-resolves-to";
import { VariableValueFields } from "@/features/webhooks/variables/sheet/variable-value-fields";
import { variableKindOptions } from "@/features/webhooks/variables/variable-kinds";
import { useTemplateReference } from "@/lib/api/hooks/use-webhook-template-queries";
import { useVariablePreview } from "@/lib/api/hooks/use-webhook-variable-queries";
import type {
  VariableKind,
  WebhookEndpoint,
  WebhookVariable,
} from "@/lib/api/types";

function VariableForm({
  editedVariable,
  defaultScopeValue,
  otherVariables,
  webhookEndpoints,
  onDone,
}: {
  editedVariable: WebhookVariable | null;
  defaultScopeValue: string;
  otherVariables: WebhookVariable[];
  webhookEndpoints: WebhookEndpoint[];
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const { formValues, updateFormValues, fieldErrors, isSaving, saveVariable } =
    useVariableForm({
      editedVariable,
      defaultScopeValue,
      otherVariables,
      onSaved: onDone,
    });
  const templateReference = useTemplateReference(["email.received"]).data;
  const debouncedValue = useDebouncedValue(formValues.value, 300);
  const previewResult = useVariablePreview({
    kind: formValues.kind,
    value: debouncedValue,
  }).data;

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveVariable(previewResult?.errors ?? []);
      }}
    >
      <div className="grid gap-4 overflow-y-auto px-4 pb-4">
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <FormField
            label="Name"
            fieldId={`${fieldIdPrefix}-name`}
            hint="Used as {{ vars.name }}."
            errorMessage={fieldErrors.name}
          >
            <Input
              id={`${fieldIdPrefix}-name`}
              placeholder="tenant_id"
              className="font-mono text-xs"
              value={formValues.name}
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(changeEvent) => {
                updateFormValues({ name: changeEvent.target.value });
              }}
            />
          </FormField>
          <FormField label="Scope" fieldId={`${fieldIdPrefix}-scope`}>
            <Select
              value={formValues.scopeValue}
              onValueChange={(scopeValue) => {
                updateFormValues({ scopeValue });
              }}
            >
              <SelectTrigger id={`${fieldIdPrefix}-scope`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={globalScopeValue}>
                  Global (every endpoint)
                </SelectItem>
                {webhookEndpoints.map((webhookEndpoint) => (
                  <SelectItem
                    key={webhookEndpoint.id}
                    value={webhookEndpoint.id}
                  >
                    Only {webhookEndpoint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <RadioCardGroup<VariableKind>
          legend="Kind"
          className="sm:grid-cols-3"
          selectedValue={formValues.kind}
          options={variableKindOptions}
          onSelect={(kind) => {
            updateFormValues({ kind });
          }}
        />
        <VariableValueFields
          fieldId={`${fieldIdPrefix}-value`}
          formValues={formValues}
          fieldErrors={fieldErrors}
          templateReference={templateReference}
          isEditingSecret={editedVariable?.kind === "secret"}
          onChange={updateFormValues}
        />
        <VariableResolvesTo previewResult={previewResult} />
        <FormField label="Description" fieldId={`${fieldIdPrefix}-description`}>
          <Input
            id={`${fieldIdPrefix}-description`}
            placeholder="What it is for"
            value={formValues.description}
            onChange={(changeEvent) => {
              updateFormValues({ description: changeEvent.target.value });
            }}
          />
        </FormField>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editedVariable === null ? "Add variable" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Side sheet to add or edit a variable of any kind (WH-07.12). */
export function VariableSheet({
  isOpen,
  editedVariable,
  defaultScopeValue,
  allVariables,
  webhookEndpoints,
  onOpenChange,
}: {
  isOpen: boolean;
  editedVariable: WebhookVariable | null;
  defaultScopeValue: string;
  allVariables: WebhookVariable[];
  webhookEndpoints: WebhookEndpoint[];
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 data-[side=right]:sm:max-w-2xl"
        onEscapeKeyDown={(escapeEvent) => {
          if (isSuggestionPopupOpen()) {
            escapeEvent.preventDefault();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {editedVariable === null
              ? "Add a variable"
              : `vars.${editedVariable.name}`}
          </SheetTitle>
          <SheetDescription>
            A value templates read as {"{{ vars.name }}"}.
          </SheetDescription>
        </SheetHeader>
        {isOpen && (
          <VariableForm
            key={editedVariable?.id ?? "new"}
            editedVariable={editedVariable}
            defaultScopeValue={defaultScopeValue}
            otherVariables={allVariables.filter(
              (webhookVariable) => webhookVariable.id !== editedVariable?.id,
            )}
            webhookEndpoints={webhookEndpoints}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

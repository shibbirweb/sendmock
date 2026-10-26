import * as React from "react";

import { ChipListInput } from "@/components/common/chip-list-input";
import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { messageRuleLabels } from "@/features/settings/message-rules/message-rule-labels";
import { useMessageRuleForm } from "@/features/settings/message-rules/use-message-rule-form";
import { RulePreviewPanel } from "@/features/webhooks/rules/editor/rule-preview-panel";
import { FilterBuilder } from "@/features/webhooks/rules/filter-builder/filter-builder";
import type {
  MessageRuleKind,
  MessageRuleTypes,
} from "@/lib/api/hooks/use-message-rule-queries";
import {
  type BuilderGroup,
  toRuleFilter,
} from "@/lib/webhooks/rule-filter/builder-tree";
import { listFieldsForEvents } from "@/lib/webhooks/rule-filter/rule-fields";
import { findFirstFilterError } from "@/lib/webhooks/rule-filter/validate-rule-filter";

type StoredRule = MessageRuleTypes[MessageRuleKind]["rule"];

const emailFieldDefinitions = listFieldsForEvents(["email.received"]);

function MessageRuleForm({
  ruleKind,
  editedRule,
  onDone,
}: {
  ruleKind: MessageRuleKind;
  editedRule: StoredRule | null;
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
  } = useMessageRuleForm({ ruleKind, editedRule, onSaved: onDone });
  const ruleFilter = toRuleFilter(formValues.rootGroup);
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
              value={formValues.name}
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(changeEvent) => {
                updateFormValues({ name: changeEvent.target.value });
              }}
            />
          </FormField>
          {ruleKind === "tag-rules" ? (
            <FormField
              label="Tag"
              fieldId={`${fieldIdPrefix}-tag`}
              errorMessage={fieldErrors.tag}
            >
              <Input
                id={`${fieldIdPrefix}-tag`}
                placeholder="billing"
                value={formValues.tag}
                aria-invalid={fieldErrors.tag !== undefined}
                onChange={(changeEvent) => {
                  updateFormValues({ tag: changeEvent.target.value });
                }}
              />
            </FormField>
          ) : (
            <FormField
              label="Forward to"
              fieldId={`${fieldIdPrefix}-to`}
              errorMessage={fieldErrors.forwardAddresses}
            >
              <ChipListInput
                inputId={`${fieldIdPrefix}-to`}
                values={formValues.forwardAddresses}
                placeholder="qa-team@company.com"
                isInvalid={fieldErrors.forwardAddresses !== undefined}
                onChange={(forwardAddresses) => {
                  updateFormValues({ forwardAddresses });
                }}
              />
            </FormField>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`${fieldIdPrefix}-enabled`}
            checked={formValues.isEnabled}
            onCheckedChange={(isEnabled) => {
              updateFormValues({ isEnabled });
            }}
          />
          <Label htmlFor={`${fieldIdPrefix}-enabled`}>Enabled</Label>
        </div>
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Filter</h3>
          <p className="text-sm text-muted-foreground">
            No conditions matches every arriving email.
          </p>
          <FilterBuilder
            rootGroup={formValues.rootGroup}
            fieldDefinitions={emailFieldDefinitions}
            isShowingErrors={hasTriedSaving}
            onChange={handleRootGroupChange}
          />
          <FormFieldError errorMessage={fieldErrors.filter} />
        </section>
        <section className="grid gap-2 rounded-md border p-3">
          <h3 className="text-sm font-medium">Preview</h3>
          <RulePreviewPanel
            previewRequest={{ events: ["email.received"], filter: ruleFilter }}
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

/** Side sheet to add or edit a tag or auto-forward rule with the filter builder. */
export function MessageRuleSheet({
  ruleKind,
  isOpen,
  editedRule,
  onOpenChange,
}: {
  ruleKind: MessageRuleKind;
  isOpen: boolean;
  editedRule: StoredRule | null;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const ruleLabels = messageRuleLabels[ruleKind];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {editedRule === null ? ruleLabels.sheetTitle : editedRule.name}
          </SheetTitle>
          <SheetDescription>{ruleLabels.sheetDescription}</SheetDescription>
        </SheetHeader>
        {isOpen && (
          <MessageRuleForm
            key={editedRule?.id ?? "new"}
            ruleKind={ruleKind}
            editedRule={editedRule}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MockResponseFields } from "@/features/http/responses/mock-response-fields";
import { ResponseRuleMatchFields } from "@/features/http/responses/response-rule-match-fields";
import { ResponseRulePreview } from "@/features/http/responses/response-rule-preview";
import { ResponseRuleTimingFields } from "@/features/http/responses/response-rule-timing-fields";
import {
  toResponseRule,
  useResponseRuleForm,
} from "@/features/http/responses/use-response-rule-form";
import type { HttpResponseRule } from "@/lib/api/types";

/** Add or edit a response rule, with a live preview (HC-02.4). Mount when opening. */
export function ResponseRuleSheet({
  binId,
  editedRule,
  isSaving,
  onSave,
  onClose,
}: {
  binId: string;
  editedRule: HttpResponseRule | null;
  isSaving: boolean;
  onSave: (savedRule: HttpResponseRule) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const ruleForm = useResponseRuleForm(editedRule);
  const { formValues, fieldErrors, updateFormValues } = ruleForm;

  return (
    <Sheet
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {editedRule === null ? "Add a rule" : editedRule.name}
          </SheetTitle>
          <SheetDescription>
            Rules are checked in order; the first match answers.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            const validRule = ruleForm.validateForSave();
            if (validRule !== null) {
              onSave(validRule);
            }
          }}
        >
          <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-4 pb-4">
            <FormField
              label="Name"
              fieldId={`${fieldIdPrefix}-name`}
              errorMessage={fieldErrors.name}
            >
              <Input
                id={`${fieldIdPrefix}-name`}
                placeholder="Rate limited in test mode"
                value={formValues.name}
                aria-invalid={fieldErrors.name !== undefined}
                onChange={(changeEvent) => {
                  updateFormValues({ name: changeEvent.target.value });
                }}
              />
            </FormField>
            <div className="grid gap-1">
              <ResponseRuleMatchFields
                formValues={formValues}
                fieldErrors={fieldErrors}
                hasTriedSaving={ruleForm.hasTriedSaving}
                onChange={updateFormValues}
              />
              <FormFieldError errorMessage={fieldErrors.filter} />
            </div>
            <fieldset className="grid gap-4">
              <legend className="mb-1 text-sm font-semibold">Response</legend>
              <MockResponseFields
                formValues={formValues}
                statusCodeError={fieldErrors.status_code}
                onChange={updateFormValues}
              />
            </fieldset>
            <ResponseRuleTimingFields
              formValues={formValues}
              fieldErrors={fieldErrors}
              onChange={updateFormValues}
            />
            <Separator />
            <ResponseRulePreview
              binId={binId}
              draftRule={toResponseRule(formValues, ruleForm.ruleId)}
            />
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {editedRule === null ? "Add rule" : "Save rule"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

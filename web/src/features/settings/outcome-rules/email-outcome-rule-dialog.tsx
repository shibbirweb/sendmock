import * as React from "react";
import { toast } from "sonner";

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
import { emailOutcomeLabels } from "@/features/settings/outcome-rules/outcome-rule-labels";
import { ApiError } from "@/lib/api/api-client";
import { useSaveOutcomeRule } from "@/lib/api/hooks/use-outcome-rule-queries";
import type {
  EmailOutcomeKind,
  EmailOutcomeRule,
  EmailOutcomeRuleInput,
} from "@/lib/api/types";
import {
  type EmailOutcomeRuleFieldErrors,
  validateEmailOutcomeRuleInput,
} from "@/lib/outcomes/validate-outcome-rules";

const outcomeKinds = Object.keys(emailOutcomeLabels) as EmailOutcomeKind[];
const outcomesWithSmtpCode = new Set<EmailOutcomeKind>([
  "hard_bounce",
  "soft_bounce",
  "reject",
]);
const defaultSmtpCodes: Partial<Record<EmailOutcomeKind, string>> = {
  hard_bounce: "550 5.1.1",
  soft_bounce: "450 4.2.2",
  reject: "550 5.7.1",
};

function toRuleInput(
  outcomeRule: EmailOutcomeRule | null,
): EmailOutcomeRuleInput {
  return {
    pattern: outcomeRule?.pattern ?? "",
    outcome: outcomeRule?.outcome ?? "hard_bounce",
    smtp_code: outcomeRule?.smtp_code ?? defaultSmtpCodes.hard_bounce ?? null,
    diagnostic: outcomeRule?.diagnostic ?? null,
    note: outcomeRule?.note ?? "",
    is_enabled: outcomeRule?.is_enabled ?? true,
  };
}

function EmailOutcomeRuleForm({
  editedRule,
  onDone,
}: {
  editedRule: EmailOutcomeRule | null;
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const saveOutcomeRule = useSaveOutcomeRule("email");
  const [ruleInput, setRuleInput] = React.useState(() =>
    toRuleInput(editedRule),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<EmailOutcomeRuleFieldErrors>({});
  const usesSmtpCode = outcomesWithSmtpCode.has(ruleInput.outcome);
  const updateRuleInput = (changedFields: Partial<EmailOutcomeRuleInput>) =>
    setRuleInput((previousInput) => ({ ...previousInput, ...changedFields }));

  const saveRule = () => {
    const cleanedInput: EmailOutcomeRuleInput = {
      ...ruleInput,
      pattern: ruleInput.pattern.trim(),
      smtp_code: usesSmtpCode ? ruleInput.smtp_code?.trim() || null : null,
      diagnostic: usesSmtpCode ? ruleInput.diagnostic?.trim() || null : null,
    };
    const validationErrors = validateEmailOutcomeRuleInput(cleanedInput);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    saveOutcomeRule.mutate(
      { ruleId: editedRule?.id ?? null, ruleInput: cleanedInput },
      {
        onSuccess: () => {
          toast(editedRule === null ? "Rule added" : "Rule saved");
          onDone();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the rule",
          );
        },
      },
    );
  };

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveRule();
      }}
    >
      <FormField
        label="Address or pattern"
        fieldId={`${fieldIdPrefix}-pattern`}
        hint="Use * as a wildcard, for example *@bounce.qa.test."
        errorMessage={fieldErrors.pattern}
      >
        <Input
          id={`${fieldIdPrefix}-pattern`}
          className="font-mono"
          placeholder="*@bounce.qa.test"
          value={ruleInput.pattern}
          aria-invalid={fieldErrors.pattern !== undefined}
          onChange={(changeEvent) =>
            updateRuleInput({ pattern: changeEvent.target.value })
          }
        />
      </FormField>
      <FormField label="Outcome" fieldId={`${fieldIdPrefix}-outcome`}>
        <Select
          value={ruleInput.outcome}
          onValueChange={(outcomeKind) =>
            updateRuleInput({
              outcome: outcomeKind as EmailOutcomeKind,
              smtp_code:
                defaultSmtpCodes[outcomeKind as EmailOutcomeKind] ?? null,
            })
          }
        >
          <SelectTrigger id={`${fieldIdPrefix}-outcome`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {outcomeKinds.map((outcomeKind) => (
              <SelectItem key={outcomeKind} value={outcomeKind}>
                {emailOutcomeLabels[outcomeKind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {usesSmtpCode && (
        <div className="grid items-start gap-4 sm:grid-cols-[10rem_1fr]">
          <FormField
            label="SMTP code"
            fieldId={`${fieldIdPrefix}-code`}
            errorMessage={fieldErrors.smtp_code}
          >
            <Input
              id={`${fieldIdPrefix}-code`}
              className="font-mono"
              value={ruleInput.smtp_code ?? ""}
              aria-invalid={fieldErrors.smtp_code !== undefined}
              onChange={(changeEvent) =>
                updateRuleInput({ smtp_code: changeEvent.target.value })
              }
            />
          </FormField>
          <FormField
            label="Diagnostic text (optional)"
            fieldId={`${fieldIdPrefix}-diagnostic`}
          >
            <Input
              id={`${fieldIdPrefix}-diagnostic`}
              placeholder="User unknown"
              value={ruleInput.diagnostic ?? ""}
              onChange={(changeEvent) =>
                updateRuleInput({ diagnostic: changeEvent.target.value })
              }
            />
          </FormField>
        </div>
      )}
      <FormField
        label="Note (optional)"
        fieldId={`${fieldIdPrefix}-note`}
        errorMessage={fieldErrors.note}
      >
        <Input
          id={`${fieldIdPrefix}-note`}
          placeholder="Bounce handling tests"
          value={ruleInput.note}
          onChange={(changeEvent) =>
            updateRuleInput({ note: changeEvent.target.value })
          }
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveOutcomeRule.isPending}>
          {editedRule === null ? "Add rule" : "Save rule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Add or edit a custom outcome address (EM-10.5). */
export function EmailOutcomeRuleDialog({
  isOpen,
  editedRule,
  onOpenChange,
}: {
  isOpen: boolean;
  editedRule: EmailOutcomeRule | null;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editedRule === null
              ? "New outcome address"
              : "Edit outcome address"}
          </DialogTitle>
          <DialogDescription>
            Matching recipients get this outcome instead of the magic addresses
            and the profile.
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <EmailOutcomeRuleForm
            key={editedRule?.id ?? "new"}
            editedRule={editedRule}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

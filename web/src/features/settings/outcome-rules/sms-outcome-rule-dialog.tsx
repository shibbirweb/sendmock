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
import { smsOutcomeLabels } from "@/lib/outcomes/outcome-rule-labels";
import { ApiError } from "@/lib/api/api-client";
import { useSaveOutcomeRule } from "@/lib/api/hooks/use-outcome-rule-queries";
import type {
  SmsOutcomeKind,
  SmsOutcomeRule,
  SmsOutcomeRuleInput,
} from "@/lib/api/types";
import {
  type SmsOutcomeRuleFieldErrors,
  validateSmsOutcomeRuleInput,
} from "@/lib/outcomes/validate-outcome-rules";

const outcomeKinds = Object.keys(smsOutcomeLabels) as SmsOutcomeKind[];
const outcomesNeedingCode = new Set<SmsOutcomeKind>([
  "reject",
  "undelivered",
  "failed",
]);

function toRuleInput(outcomeRule: SmsOutcomeRule | null): SmsOutcomeRuleInput {
  return {
    match_field: outcomeRule?.match_field ?? "to",
    pattern: outcomeRule?.pattern ?? "",
    outcome: outcomeRule?.outcome ?? "undelivered",
    error_code: outcomeRule?.error_code ?? "30007",
    delay_seconds: outcomeRule?.delay_seconds ?? 10,
    note: outcomeRule?.note ?? "",
    is_enabled: outcomeRule?.is_enabled ?? true,
  };
}

/** Only the fields the chosen outcome uses are sent. */
function trimUnusedFields(ruleInput: SmsOutcomeRuleInput): SmsOutcomeRuleInput {
  return {
    ...ruleInput,
    pattern: ruleInput.pattern.trim(),
    error_code: outcomesNeedingCode.has(ruleInput.outcome)
      ? ruleInput.error_code
      : null,
    delay_seconds:
      ruleInput.outcome === "delayed_delivery" ? ruleInput.delay_seconds : null,
  };
}

function SmsOutcomeRuleForm({
  editedRule,
  onDone,
}: {
  editedRule: SmsOutcomeRule | null;
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const saveOutcomeRule = useSaveOutcomeRule("sms");
  const [ruleInput, setRuleInput] = React.useState(() =>
    toRuleInput(editedRule),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<SmsOutcomeRuleFieldErrors>({});
  const updateRuleInput = (changedFields: Partial<SmsOutcomeRuleInput>) =>
    setRuleInput((previousInput) => ({ ...previousInput, ...changedFields }));

  const saveRule = () => {
    const cleanedInput = trimUnusedFields(ruleInput);
    const validationErrors = validateSmsOutcomeRuleInput(cleanedInput);
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
      <div className="grid items-start gap-4 sm:grid-cols-[8rem_1fr]">
        <FormField label="Match" fieldId={`${fieldIdPrefix}-match`}>
          <Select
            value={ruleInput.match_field}
            onValueChange={(matchField) =>
              updateRuleInput({ match_field: matchField as "to" | "from" })
            }
          >
            <SelectTrigger id={`${fieldIdPrefix}-match`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="to">To number</SelectItem>
              <SelectItem value="from">From number</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Number or pattern"
          fieldId={`${fieldIdPrefix}-pattern`}
          hint="Use * for any digits, for example +1555777*."
          errorMessage={fieldErrors.pattern}
        >
          <Input
            id={`${fieldIdPrefix}-pattern`}
            className="font-mono"
            placeholder="+15559990000"
            value={ruleInput.pattern}
            aria-invalid={fieldErrors.pattern !== undefined}
            onChange={(changeEvent) =>
              updateRuleInput({ pattern: changeEvent.target.value })
            }
          />
        </FormField>
      </div>
      <FormField label="Outcome" fieldId={`${fieldIdPrefix}-outcome`}>
        <Select
          value={ruleInput.outcome}
          onValueChange={(outcomeKind) =>
            updateRuleInput({ outcome: outcomeKind as SmsOutcomeKind })
          }
        >
          <SelectTrigger id={`${fieldIdPrefix}-outcome`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {outcomeKinds.map((outcomeKind) => (
              <SelectItem key={outcomeKind} value={outcomeKind}>
                {smsOutcomeLabels[outcomeKind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {outcomesNeedingCode.has(ruleInput.outcome) && (
        <FormField
          label="Error code"
          fieldId={`${fieldIdPrefix}-code`}
          hint={
            ruleInput.outcome === "reject"
              ? "Returned on send, like 21211 or 21610."
              : "Sent with the status, like 30003 or 30007."
          }
          errorMessage={fieldErrors.error_code}
        >
          <Input
            id={`${fieldIdPrefix}-code`}
            inputMode="numeric"
            className="w-36 font-mono"
            value={ruleInput.error_code ?? ""}
            aria-invalid={fieldErrors.error_code !== undefined}
            onChange={(changeEvent) =>
              updateRuleInput({ error_code: changeEvent.target.value.trim() })
            }
          />
        </FormField>
      )}
      {ruleInput.outcome === "delayed_delivery" && (
        <FormField
          label="Delay (seconds)"
          fieldId={`${fieldIdPrefix}-delay`}
          errorMessage={fieldErrors.delay_seconds}
        >
          <Input
            id={`${fieldIdPrefix}-delay`}
            type="number"
            className="w-36"
            value={ruleInput.delay_seconds ?? ""}
            aria-invalid={fieldErrors.delay_seconds !== undefined}
            onChange={(changeEvent) =>
              updateRuleInput({
                delay_seconds:
                  changeEvent.target.value === ""
                    ? null
                    : Number(changeEvent.target.value),
              })
            }
          />
        </FormField>
      )}
      <FormField
        label="Note (optional)"
        fieldId={`${fieldIdPrefix}-note`}
        errorMessage={fieldErrors.note}
      >
        <Input
          id={`${fieldIdPrefix}-note`}
          placeholder="QA phone: carrier filter"
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

/** Add or edit a custom outcome number (SM-07.7). */
export function SmsOutcomeRuleDialog({
  isOpen,
  editedRule,
  onOpenChange,
}: {
  isOpen: boolean;
  editedRule: SmsOutcomeRule | null;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editedRule === null ? "New outcome number" : "Edit outcome number"}
          </DialogTitle>
          <DialogDescription>
            Matching messages get this outcome instead of the magic numbers and
            the profile.
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <SmsOutcomeRuleForm
            key={editedRule?.id ?? "new"}
            editedRule={editedRule}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

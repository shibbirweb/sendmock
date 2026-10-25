import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  SettingsNumberField,
  SettingsSwitchRow,
} from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings, ChaosSmtpRejectCode } from "@/lib/api/types";
import { chaosSmtpRejectCodes } from "@/lib/settings/validate-app-settings";

const chaosKeys = [
  "chaos_smtp_reject_next_count",
  "chaos_smtp_reject_code",
  "chaos_smtp_reject_recipient_pattern",
  "chaos_smtp_command_latency_ms",
  "is_chaos_smtp_drop_during_data_enabled",
] as const;

const rejectCodeDescriptions: Record<ChaosSmtpRejectCode, string> = {
  421: "421 Service not available (temporary)",
  450: "450 Mailbox busy (temporary)",
  550: "550 Mailbox unavailable (permanent)",
  552: "552 Exceeded storage allocation",
};

/** SMTP failures on purpose, to test the app's error handling. */
export function ChaosSection({ appSettings }: { appSettings: AppSettings }) {
  const fieldIdPrefix = React.useId();
  const sectionForm = useSettingsSectionForm(appSettings, chaosKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;

  return (
    <SettingsSectionCard
      title="Chaos"
      description="Make SMTP fail on purpose to test retries and error handling. SMS failures use the failure rate in SMS settings."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsNumberField
          label="Reject the next"
          unitLabel="messages"
          hint="Counts down as messages arrive. 0 turns it off."
          value={draftValues.chaos_smtp_reject_next_count}
          errorMessage={fieldErrors.chaos_smtp_reject_next_count}
          onValueChange={(rejectCount) => {
            updateDraft({ chaos_smtp_reject_next_count: rejectCount ?? 0 });
          }}
        />
        <FormField label="With code" fieldId={`${fieldIdPrefix}-code`}>
          <Select
            value={String(draftValues.chaos_smtp_reject_code)}
            onValueChange={(rejectCode) => {
              updateDraft({
                chaos_smtp_reject_code: Number(
                  rejectCode,
                ) as ChaosSmtpRejectCode,
              });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-code`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chaosSmtpRejectCodes.map((rejectCode) => (
                <SelectItem key={rejectCode} value={String(rejectCode)}>
                  {rejectCodeDescriptions[rejectCode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField
        label="Reject recipients matching"
        fieldId={`${fieldIdPrefix}-pattern`}
        hint="Glob; matching recipients get 550 No such user. Leave empty to turn it off."
        errorMessage={fieldErrors.chaos_smtp_reject_recipient_pattern}
      >
        <Input
          id={`${fieldIdPrefix}-pattern`}
          placeholder="*@reject.test"
          value={draftValues.chaos_smtp_reject_recipient_pattern ?? ""}
          onChange={(changeEvent) => {
            const enteredPattern = changeEvent.target.value.trim();
            updateDraft({
              chaos_smtp_reject_recipient_pattern:
                enteredPattern === "" ? null : enteredPattern,
            });
          }}
        />
      </FormField>
      <SettingsNumberField
        label="Latency per SMTP command"
        unitLabel="ms"
        value={draftValues.chaos_smtp_command_latency_ms}
        errorMessage={fieldErrors.chaos_smtp_command_latency_ms}
        onValueChange={(latencyMs) => {
          updateDraft({ chaos_smtp_command_latency_ms: latencyMs ?? 0 });
        }}
      />
      <SettingsSwitchRow
        label="Drop the connection during DATA"
        description="The client sees the connection close mid-message and nothing is stored."
        isChecked={draftValues.is_chaos_smtp_drop_during_data_enabled}
        onCheckedChange={(isEnabled) => {
          updateDraft({ is_chaos_smtp_drop_during_data_enabled: isEnabled });
        }}
      />
    </SettingsSectionCard>
  );
}

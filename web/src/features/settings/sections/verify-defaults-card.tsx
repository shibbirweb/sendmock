import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { SettingsNumberField } from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings } from "@/lib/api/types";

const verifyDefaultKeys = [
  "verify_default_code_length",
  "verify_default_ttl_seconds",
  "verify_fixed_code",
] as const;

/** Code rules for every Verify service that does not set its own (VF-01.2). */
export function VerifyDefaultsCard({
  appSettings,
}: {
  appSettings: AppSettings;
}) {
  const sectionForm = useSettingsSectionForm(appSettings, verifyDefaultKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;
  const fixedCodeFieldId = React.useId();

  return (
    <SettingsSectionCard
      title="Verify defaults"
      description="New Verify services start with this code length and lifetime. A fixed code here is sent by every service that has none of its own."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsNumberField
          label="Code length"
          unitLabel="digits"
          value={draftValues.verify_default_code_length}
          errorMessage={fieldErrors.verify_default_code_length}
          onValueChange={(codeLength) => {
            updateDraft({ verify_default_code_length: codeLength ?? 0 });
          }}
        />
        <SettingsNumberField
          label="Code lifetime"
          unitLabel="seconds"
          value={draftValues.verify_default_ttl_seconds}
          errorMessage={fieldErrors.verify_default_ttl_seconds}
          onValueChange={(ttlSeconds) => {
            updateDraft({ verify_default_ttl_seconds: ttlSeconds ?? 0 });
          }}
        />
      </div>
      <FormField
        label="Fixed code for every service"
        fieldId={fixedCodeFieldId}
        hint="Leave it empty for random codes."
        errorMessage={fieldErrors.verify_fixed_code}
      >
        <Input
          id={fixedCodeFieldId}
          inputMode="numeric"
          className="w-36"
          placeholder="Random"
          value={draftValues.verify_fixed_code ?? ""}
          aria-invalid={fieldErrors.verify_fixed_code !== undefined}
          onChange={(changeEvent) => {
            const enteredCode = changeEvent.target.value.trim();
            updateDraft({
              verify_fixed_code: enteredCode === "" ? null : enteredCode,
            });
          }}
        />
      </FormField>
    </SettingsSectionCard>
  );
}

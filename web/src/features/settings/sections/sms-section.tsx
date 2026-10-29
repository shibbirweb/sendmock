import { RadioCardGroup } from "@/components/common/radio-card-group";
import { FeatureAvailabilityGate } from "@/features/availability/feature-availability-gate";
import { Slider } from "@/components/ui/slider";
import {
  sendmockAfterSendNumbers,
  twilioFromNumbers,
  twilioToNumbers,
} from "@/lib/outcomes/magic-reference-data";
import { MagicReferenceTable } from "@/features/settings/reference/magic-reference-table";
import { SmsOutcomeRulesCard } from "@/features/settings/outcome-rules/sms-outcome-rules-card";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { SettingsSwitchRow } from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings, SmsSimulationProfile } from "@/lib/api/types";
import { FormFieldError } from "@/components/common/form-field-error";
import { Label } from "@/components/ui/label";

const simulationKeys = [
  "sms_simulation_profile",
  "sms_failure_rate_percent",
  "is_strict_twilio_test_mode",
  "is_magic_numbers_enabled",
] as const;

const simulationProfileOptions: {
  value: SmsSimulationProfile;
  label: string;
  description: string;
}[] = [
  {
    value: "instant",
    label: "Instant",
    description: "Delivered as soon as it is sent.",
  },
  {
    value: "realistic",
    label: "Realistic",
    description: "Queued, sent after about 300 ms, delivered after 1 to 3 s.",
  },
  {
    value: "manual",
    label: "Manual",
    description: "Stays sent until you set a status in the message drawer.",
  },
];

/** SMS simulation options and the magic numbers reference. */
export function SmsSection({ appSettings }: { appSettings: AppSettings }) {
  const sectionForm = useSettingsSectionForm(appSettings, simulationKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;

  return (
    <div className="grid gap-4">
      <SettingsSectionCard
        title="Delivery simulation"
        isDirty={sectionForm.isDirty}
        isSaving={sectionForm.isSaving}
        onSave={sectionForm.saveChanges}
        onDiscard={sectionForm.discardChanges}
      >
        <RadioCardGroup
          legend="Simulation profile"
          options={simulationProfileOptions}
          selectedValue={draftValues.sms_simulation_profile}
          onSelect={(simulationProfile) => {
            updateDraft({ sms_simulation_profile: simulationProfile });
          }}
        />
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label id="failure-rate-label">Failure rate</Label>
            <span className="text-sm tabular-nums">
              {draftValues.sms_failure_rate_percent}%
            </span>
          </div>
          <Slider
            aria-labelledby="failure-rate-label"
            min={0}
            max={100}
            step={1}
            value={[draftValues.sms_failure_rate_percent]}
            onValueChange={([failureRate]) => {
              updateDraft({ sms_failure_rate_percent: failureRate ?? 0 });
            }}
          />
          <p className="text-xs text-muted-foreground">
            This share of sends ends undelivered or failed at random.
          </p>
          <FormFieldError errorMessage={fieldErrors.sms_failure_rate_percent} />
        </div>
        <SettingsSwitchRow
          label="Strict Twilio test mode"
          description="Reject From numbers that are not Twilio magic numbers with 21606, like real test credentials."
          isChecked={draftValues.is_strict_twilio_test_mode}
          onCheckedChange={(isStrict) => {
            updateDraft({ is_strict_twilio_test_mode: isStrict });
          }}
        />
        <SettingsSwitchRow
          label="Magic numbers"
          description="Off: the Twilio test numbers and SendMock outcome numbers below behave like any other number."
          isChecked={draftValues.is_magic_numbers_enabled}
          onCheckedChange={(isEnabled) => {
            updateDraft({ is_magic_numbers_enabled: isEnabled });
          }}
        />
      </SettingsSectionCard>
      <FeatureAvailabilityGate
        operationKey="GET /api/v1/outcome-rules/sms"
        featureName="Outcome numbers"
        description="Numbers that fail, stay queued or reply, to test how your app reacts."
      >
        <SmsOutcomeRulesCard appSettings={appSettings} />
      </FeatureAvailabilityGate>
      <SettingsSectionCard
        title="Magic numbers"
        description={
          appSettings.is_magic_numbers_enabled
            ? "Twilio's official test numbers, plus SendMock numbers for outcomes after sending. Built in and read-only."
            : "Switched off: these numbers currently behave like any other number."
        }
      >
        <MagicReferenceTable
          caption="To numbers (Twilio)"
          triggerHeading="To"
          referenceRows={twilioToNumbers}
        />
        <MagicReferenceTable
          caption="From numbers (Twilio)"
          triggerHeading="From"
          referenceRows={twilioFromNumbers}
        />
        <MagicReferenceTable
          caption="After-send outcomes (SendMock)"
          triggerHeading="To"
          referenceRows={sendmockAfterSendNumbers}
        />
      </SettingsSectionCard>
    </div>
  );
}

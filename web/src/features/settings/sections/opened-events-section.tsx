import { RadioCardGroup } from "@/components/common/radio-card-group";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { SettingsSwitchRow } from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings } from "@/lib/api/types";

const openedEventKeys = [
  "fire_opened_events_on_view",
  "opened_event_mode",
] as const;

/** When viewing a message stands in for the recipient opening it. */
export function OpenedEventsSection({
  appSettings,
}: {
  appSettings: AppSettings;
}) {
  const sectionForm = useSettingsSectionForm(appSettings, openedEventKeys);
  const { draftValues, updateDraft } = sectionForm;

  return (
    <SettingsSectionCard
      title="Opened events"
      description="email.opened and sms.opened stand in for the recipient reading the message."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <SettingsSwitchRow
        label="Fire opened events when I view messages"
        description="Opening an email or scrolling an SMS into view counts as the recipient reading it."
        isChecked={draftValues.fire_opened_events_on_view}
        onCheckedChange={(isEnabled) => {
          updateDraft({ fire_opened_events_on_view: isEnabled });
        }}
      />
      <RadioCardGroup
        legend="How often"
        options={[
          {
            value: "first_open",
            label: "First open only",
            description: "One event per message, like most providers report.",
          },
          {
            value: "every_open",
            label: "Every open",
            description: "An event each time, for testing open counters.",
          },
        ]}
        selectedValue={draftValues.opened_event_mode}
        onSelect={(openedEventMode) => {
          updateDraft({ opened_event_mode: openedEventMode });
        }}
      />
    </SettingsSectionCard>
  );
}

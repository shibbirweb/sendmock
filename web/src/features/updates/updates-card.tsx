import { RefreshCwIcon } from "lucide-react";

import {
  type RadioCardOption,
  RadioCardGroup,
} from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import { UpdateCheckResultView } from "@/features/updates/update-check-result-view";
import { ApiError } from "@/lib/api/api-client";
import {
  useCheckForUpdates,
  useDailyUpdateCheck,
} from "@/lib/api/hooks/use-system-queries";
import type { AppSettings, UpdateCheckMode } from "@/lib/api/types";

const updateCheckKeys = ["update_check_mode"] as const;

const updateCheckModeOptions: RadioCardOption<UpdateCheckMode>[] = [
  {
    value: "off",
    label: "Off",
    description: "SendMock never calls out.",
  },
  {
    value: "manual",
    label: "Manual",
    description: "Only when you press Check for updates.",
  },
  {
    value: "daily",
    label: "Daily",
    description:
      "On start and once a day; a new version shows in the notifications.",
  },
];

function describeUpdateCheckError(checkError: Error): string {
  return checkError instanceof ApiError && checkError.statusCode === 502
    ? "Could not check for updates. GitHub could not be reached; try again later."
    : checkError.message;
}

/** The opt-in update check in Settings > About (PL-05.6, PL-05.10 to PL-05.12). */
export function UpdatesCard({ appSettings }: { appSettings: AppSettings }) {
  const sectionForm = useSettingsSectionForm(appSettings, updateCheckKeys);
  // The check uses the saved mode, so it stays off until the mode is saved.
  const savedMode = appSettings.update_check_mode;
  const checkForUpdates = useCheckForUpdates();
  const dailyUpdateCheck = useDailyUpdateCheck({
    isEnabled: savedMode === "daily",
  });
  const updateCheckResult = dailyUpdateCheck.data;
  const checkError = checkForUpdates.error ?? dailyUpdateCheck.error;

  return (
    <SettingsSectionCard
      title="Updates"
      description="Off by default: SendMock never calls out unless you choose Manual or Daily. Stable installs are offered stable releases; beta installs betas and stables."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <RadioCardGroup
        legend="Check GitHub Releases for updates"
        options={updateCheckModeOptions}
        selectedValue={sectionForm.draftValues.update_check_mode}
        onSelect={(updateCheckMode) => {
          sectionForm.updateDraft({ update_check_mode: updateCheckMode });
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={savedMode === "off" || checkForUpdates.isPending}
          onClick={() => checkForUpdates.mutate()}
        >
          <RefreshCwIcon />
          Check for updates
        </Button>
        {checkError !== null && savedMode !== "off" && (
          <p role="alert" className="text-sm text-destructive">
            {describeUpdateCheckError(checkError)}
          </p>
        )}
      </div>
      {updateCheckResult !== undefined && savedMode !== "off" && (
        <UpdateCheckResultView updateCheckResult={updateCheckResult} />
      )}
    </SettingsSectionCard>
  );
}

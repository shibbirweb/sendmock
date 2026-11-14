import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useUpdateAppSettings } from "@/lib/api/hooks/use-system-queries";
import type { AppSettings, AppSettingsUpdate } from "@/lib/api/types";
import {
  type AppSettingsFieldErrors,
  validateAppSettingsUpdate,
} from "@/lib/settings/validate-app-settings";

type SectionValues<SectionKey extends keyof AppSettings> = Pick<
  AppSettings,
  SectionKey
>;

function pickSectionValues<SectionKey extends keyof AppSettings>(
  appSettings: AppSettings,
  sectionKeys: readonly SectionKey[],
): SectionValues<SectionKey> {
  return Object.fromEntries(
    sectionKeys.map((sectionKey) => [sectionKey, appSettings[sectionKey]]),
  ) as SectionValues<SectionKey>;
}

function listChangedKeys<SectionKey extends keyof AppSettings>(
  draftValues: SectionValues<SectionKey>,
  savedValues: SectionValues<SectionKey>,
  sectionKeys: readonly SectionKey[],
): SectionKey[] {
  return sectionKeys.filter(
    (sectionKey) =>
      JSON.stringify(draftValues[sectionKey]) !==
      JSON.stringify(savedValues[sectionKey]),
  );
}

/**
 * Draft, validation and saving for one Settings section (PL-05): only the
 * section's keys are edited, Save sends just the changed ones, and Discard
 * goes back to the saved values.
 */
export function useSettingsSectionForm<SectionKey extends keyof AppSettings>(
  appSettings: AppSettings,
  sectionKeys: readonly SectionKey[],
) {
  const updateAppSettings = useUpdateAppSettings();
  const savedValues = React.useMemo(
    () => pickSectionValues(appSettings, sectionKeys),
    [appSettings, sectionKeys],
  );
  const [draftValues, setDraftValues] = React.useState(savedValues);
  const [fieldErrors, setFieldErrors] = React.useState<AppSettingsFieldErrors>(
    {},
  );
  const changedKeys = listChangedKeys(draftValues, savedValues, sectionKeys);
  const isDirty = changedKeys.length > 0;

  const updateDraft = (changedValues: Partial<SectionValues<SectionKey>>) => {
    setDraftValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const discardChanges = () => {
    setDraftValues(savedValues);
    setFieldErrors({});
  };

  const saveChanges = () => {
    const settingsUpdate: AppSettingsUpdate = Object.fromEntries(
      changedKeys.map((changedKey) => [changedKey, draftValues[changedKey]]),
    );
    const validationErrors = validateAppSettingsUpdate(settingsUpdate);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    updateAppSettings.mutate(settingsUpdate, {
      onSuccess: (updatedSettings) => {
        setDraftValues(pickSectionValues(updatedSettings, sectionKeys));
        toast("Settings saved");
      },
      onError: (requestError) => {
        if (
          requestError instanceof ApiError &&
          requestError.fieldName !== null
        ) {
          setFieldErrors({
            [requestError.fieldName]: requestError.message,
          });
          return;
        }

        toast.error("Could not save the settings");
      },
    });
  };

  return {
    draftValues,
    updateDraft,
    fieldErrors,
    isDirty,
    isSaving: updateAppSettings.isPending,
    saveChanges,
    discardChanges,
  };
}

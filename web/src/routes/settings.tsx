import { createFileRoute } from "@tanstack/react-router";

import {
  type SettingsSectionId,
  settingsSectionIds,
} from "@/features/settings/settings-sections";
import { SettingsPage } from "@/features/settings/settings-page";

export type SettingsSearchParams = {
  /** Open section; General when left out. */
  section?: SettingsSectionId;
};

function isSettingsSectionId(
  searchValue: unknown,
): searchValue is SettingsSectionId {
  return settingsSectionIds.includes(searchValue as SettingsSectionId);
}

export const Route = createFileRoute("/settings")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): SettingsSearchParams => ({
    section: isSettingsSectionId(searchParams.section)
      ? searchParams.section
      : undefined,
  }),
  component: SettingsPage,
});

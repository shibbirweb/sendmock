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

/** Settings > Seed became Settings > Setup; old links still open it. */
const renamedSectionIds: Record<string, SettingsSectionId> = {
  seed: "setup",
};

export const Route = createFileRoute("/settings")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): SettingsSearchParams => ({
    section: isSettingsSectionId(searchParams.section)
      ? searchParams.section
      : renamedSectionIds[String(searchParams.section)],
  }),
  component: SettingsPage,
});

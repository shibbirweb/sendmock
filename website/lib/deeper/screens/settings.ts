import type { DeeperPage } from "../deeper-types";
import { settingsEmailEntries } from "./settings-email";
import {
  settingsGeneralEntries,
  settingsSeedEntries,
} from "./settings-general-email";
import {
  settingsBehaviourEntries,
  settingsConnectionAboutEntries,
} from "./settings-other";
import {
  settingsPaymentsEntries,
  settingsSmsEntries,
} from "./settings-sms-payments";

/** Settings: every section and the danger zone's confirmations. */
export const settingsPage: DeeperPage = {
  screen: "/settings",
  file: "settings.md",
  title: "Settings in depth",
  description: "Every control and text of every Settings section.",
  guidePage: "settings.md",
  guideTitle: "Settings",
  intro: "Settings changes how SendMock behaves, section by section; every change applies at once.",
  entries: [
    ...settingsGeneralEntries,
    {
      control: "button: Delete all emails",
      state: "Delete all emails dialog",
      does: "Deletes every email.",
      operationIds: ["deleteEmails"],
    },
    {
      control: "button: Delete all SMS",
      state: "Delete all SMS dialog",
      does: "Deletes every SMS.",
      operationIds: ["deleteSms"],
    },
    ...settingsSeedEntries,
    ...settingsEmailEntries,
    ...settingsSmsEntries,
    ...settingsPaymentsEntries,
    ...settingsBehaviourEntries,
    ...settingsConnectionAboutEntries,
  ],
};

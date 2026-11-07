import type { DeeperEntry } from "../deeper-types";

const sectionLinks: [string, string][] = [
  ["General", "Retention and the danger zone."],
  ["Seed", "The seed file: export, validate and apply."],
  ["Email", "Receiving, delivery outcomes, release, tag and forward rules, outcome addresses."],
  ["SMS", "Delivery simulation, Verify defaults, outcome numbers and magic numbers."],
  ["Payments", "The hosted checkout and the test values."],
  ["Notifications", "Pop-up toasts for new traffic."],
  ["Opened events", "When `email.opened` and `sms.opened` fire."],
  ["Chaos", "SMTP failures on purpose."],
  ["OTP patterns", "How one-time codes are found."],
  ["Connection", "Snippets for every language, provider base URLs and AI agents."],
  ["About", "Help links and the update check."],
];

/** Settings: the section list, General and the danger zone. */
export const settingsGeneralEntries: DeeperEntry[] = [
  { control: "heading: Settings", does: "Names the screen, in the header and above the sections." },
  {
    control: "link: Read the Settings guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Settings](../settings.md).",
  },
  {
    control: "paragraph: Changes apply at once, without a restart. Export them to the seed file to keep them across resets.",
    does: "Explains how settings apply and how to keep them.",
    operationIds: ["getSettings"],
  },
  ...sectionLinks.map(([sectionName, sectionContents]): DeeperEntry => ({
    control: `link: ${sectionName}`,
    does: `Opens the ${sectionName} section: ${sectionContents.charAt(0).toLowerCase()}${sectionContents.slice(1)}`,
  })),
  { control: "heading: Retention", does: "How much traffic is kept." },
  { control: "paragraph: Older traffic is pruned when a limit is reached. Configuration is never pruned.", does: "Explains retention: emails, SMS, requests and deliveries are pruned; endpoints, rules and other configuration never." },
  { control: "spinbutton: Keep at most", does: "The most emails kept (and the same limit for the other traffic)." },
  { control: "paragraph: Turn off to delete traffic after a number of days.", does: "Explains Keep forever." },
  { control: "switch: Keep forever", does: "When off, traffic older than the number of days you set is deleted too." },
  { control: "button: Discard", does: "Throws away the changes not saved yet." },
  {
    control: "button: Save changes",
    does: "Saves the section's changes; they apply at once.",
    operationIds: ["patchSettings"],
  },
  { control: "heading: Danger zone", does: "Actions that delete data." },
  { control: "paragraph: These cannot be undone. Each asks first.", does: "Warns that these cannot be undone." },
  { control: "button: Delete all emails", does: "Asks first, then deletes every email.", operationIds: ["deleteEmails"] },
  { control: "button: Delete all SMS", does: "Asks first, then deletes every SMS.", operationIds: ["deleteSms"] },
  { control: "button: Reset to seed", does: "Asks first, then wipes all traffic and puts the configuration back to the seed file.", operationIds: ["postReset"] },
  { control: "heading: Delete all emails?", does: "The confirmation before deleting every email." },
  { control: "paragraph: Every captured email, its attachments and its SMTP session link are removed. Configuration stays.", does: "Says what is deleted." },
  { control: "heading: Delete all SMS?", does: "The confirmation before deleting every SMS." },
  { control: "paragraph: Every captured SMS and WhatsApp message is removed. Numbers and services stay.", does: "Says what is deleted." },
  { control: "heading: Reset to seed?", does: "The confirmation before a reset." },
  { control: "paragraph: All traffic is wiped and the configuration goes back to the seed file. Changes not exported to the seed are lost.", does: "Says what a reset does." },
  { control: "button: Cancel", does: "Closes the confirmation without doing anything." },
  { control: "button: Reset", does: "Resets to the seed file.", operationIds: ["postReset"] },
  {
    control: "alert: Could not load the settings. Try again",
    does: "Shown when the settings could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  { control: "paragraph: Could not load the settings.", does: "The message inside the alert." },
  { control: "button: Try again", does: "Loads the settings again.", operationIds: ["getSettings"] },
];

/** Settings > Seed. */
export const settingsSeedEntries: DeeperEntry[] = [
  { control: "heading: Seed file", does: "The seed file SendMock starts from and resets to.", operationIds: ["getSeedStatus"] },
  { control: "paragraph: The configuration SendMock starts from and resets to, kept in your repository.", does: "Explains the seed file.", links: "[Advanced: seed file](../advanced/seed-file.md)." },
  { control: "paragraph: ./sendmock.seed.toml applied Month #, #, #:#", does: "Which seed file was applied, and when." },
  { control: "paragraph: # items are not in the seed file yet. Export to keep them after a reset.", does: "How much configuration a reset would lose." },
  { control: "button: Export sendmock.seed.toml", does: "Downloads the current configuration as a seed file; secrets are written as `${ENV}` references.", operationIds: ["getSeedExport"] },
  { control: "heading: Apply a seed file", does: "Loads a seed file into the running SendMock." },
  { control: "paragraph: Validate first; applying upserts every item in the file by name or SID.", does: "Explains applying." },
  { control: "button: Upload file", does: "Reads a seed file from your computer." },
  { control: "textbox: Seed file (TOML)", does: "The seed file's text." },
  { control: "button: Validate", does: "Checks the file without applying it and lists errors with their line.", operationIds: ["postSeedValidate"] },
  { control: "button: Apply", does: "Applies the file: every item in it is added or updated.", operationIds: ["postSeedApply"] },
];

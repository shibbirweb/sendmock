import type { SetupFileFormat } from "@/lib/api/types";

export const setupFileFormats: {
  setupFormat: SetupFileFormat;
  label: string;
  contentType: string;
}[] = [
  {
    setupFormat: "toml",
    label: "TOML",
    contentType: "application/toml",
  },
  {
    setupFormat: "json",
    label: "JSON",
    contentType: "application/json",
  },
  {
    setupFormat: "yaml",
    label: "YAML",
    contentType: "application/yaml",
  },
];

/** The groups `only` takes, as the server names them, with the labels the screen shows. */
export const setupSectionGroups: { groupName: string; label: string }[] = [
  { groupName: "settings", label: "Settings" },
  { groupName: "projects", label: "Projects" },
  { groupName: "webhook", label: "Webhooks" },
  { groupName: "email", label: "Email" },
  { groupName: "sms", label: "SMS providers and outcome rules" },
  { groupName: "numbers", label: "Virtual numbers" },
  { groupName: "messaging_services", label: "Messaging Services" },
  { groupName: "verify", label: "Verify services" },
  { groupName: "payments", label: "Payments" },
  { groupName: "http", label: "HTTP Catcher bins" },
  { groupName: "scenarios", label: "Saved scenarios" },
];

export const minimumPassphraseLength = 8;

export function buildSetupFileName(setupFormat: SetupFileFormat): string {
  return `sendmock.setup.${setupFormat}`;
}

export function findSetupContentType(setupFormat: SetupFileFormat): string {
  return (
    setupFileFormats.find(
      (setupFileFormat) => setupFileFormat.setupFormat === setupFormat,
    )?.contentType ?? "text/plain"
  );
}

import type { MockDatabase } from "@/mocks/db/mock-database";

/** "Twilio STOP reply" to `custom.twilio_stop_reply`, unique among templates. */
export function buildCustomTemplateId(
  mockDatabase: MockDatabase,
  templateName: string,
): string {
  const slug = templateName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const baseId = `custom.${slug || "template"}`;
  const existingIds = new Set(
    mockDatabase.webhookTemplates.map((template) => template.id),
  );
  let candidateId = baseId;
  for (let suffix = 2; existingIds.has(candidateId); suffix += 1) {
    candidateId = `${baseId}_${suffix}`;
  }

  return candidateId;
}

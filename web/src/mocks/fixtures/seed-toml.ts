import type { SeedValidation, SeedValidationError } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";

type TomlValue = string | number | boolean | string[] | null;

function formatTomlValue(tomlValue: Exclude<TomlValue, null>): string {
  if (Array.isArray(tomlValue)) {
    return `[${tomlValue.map((arrayItem) => JSON.stringify(arrayItem)).join(", ")}]`;
  }

  return typeof tomlValue === "string"
    ? JSON.stringify(tomlValue)
    : String(tomlValue);
}

/** `key = value` lines, skipping nulls (TOML has no null). */
function formatTomlTable(
  tableHeader: string,
  tableEntries: Record<string, TomlValue>,
): string {
  const valueLines = Object.entries(tableEntries)
    .filter(([, tomlValue]) => tomlValue !== null)
    .map(
      ([tableKey, tomlValue]) =>
        `${tableKey} = ${formatTomlValue(tomlValue as Exclude<TomlValue, null>)}`,
    );

  return [tableHeader, ...valueLines].join("\n");
}

function toSecretReference(itemName: string): string {
  return `\${${itemName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_SECRET}`;
}

/**
 * The current configuration as `sendmock.seed.toml`. Secrets become
 * `${ENV_VAR}` references and are never written literally (PL-04.2).
 */
export function buildSeedToml(mockDatabase: MockDatabase): string {
  const { settings } = mockDatabase;
  const settingsTable = formatTomlTable("[settings]", {
    sms_simulation_profile: settings.sms_simulation_profile,
    sms_failure_rate_percent: settings.sms_failure_rate_percent,
    email_outcome_profile: settings.email_outcome_profile,
    fire_opened_events_on_view: settings.fire_opened_events_on_view,
    opened_event_mode: settings.opened_event_mode,
    otp_patterns: settings.otp_patterns,
  });
  const itemTables = [
    ...mockDatabase.webhookEndpoints.map((webhookEndpoint) =>
      formatTomlTable("[[webhook.endpoints]]", {
        name: webhookEndpoint.name,
        url: webhookEndpoint.url,
        template: webhookEndpoint.template_id,
        secret: toSecretReference(webhookEndpoint.name),
      }),
    ),
    ...mockDatabase.verifyServices.map((verifyService) =>
      formatTomlTable("[[verify.services]]", {
        sid: verifyService.sid,
        name: verifyService.friendly_name,
        code_length: verifyService.code_length,
        fixed_code: verifyService.fixed_code,
        ttl_seconds: verifyService.ttl_seconds,
      }),
    ),
    ...mockDatabase.virtualNumbers.map((virtualNumber) =>
      formatTomlTable("[[numbers]]", {
        number: virtualNumber.number,
        label: virtualNumber.label,
        channels: virtualNumber.channels,
        inbound_url: virtualNumber.inbound_url,
        inbound_template: virtualNumber.inbound_template_id,
        status_callback: virtualNumber.status_callback_url,
      }),
    ),
    ...mockDatabase.messagingServices.map((messagingService) =>
      formatTomlTable("[[messaging_services]]", {
        sid: messagingService.sid,
        name: messagingService.friendly_name,
        inbound_mode: messagingService.inbound_mode,
        inbound_url: messagingService.inbound_url,
      }),
    ),
    ...mockDatabase.httpBins.map((httpBin) =>
      formatTomlTable("[[http.bins]]", {
        name: httpBin.name,
        preset: httpBin.preset,
      }),
    ),
  ];

  return [
    "# SendMock seed file, exported from Settings > Seed.",
    "# Secrets are ${ENV_VAR} references: set them in the environment.",
    "",
    [settingsTable, ...itemTables].join("\n\n"),
    "",
  ].join("\n");
}

/** Seed sections and how the summary names them. */
const knownSeedSections: Record<string, string> = {
  "[settings]": "Settings",
  "[[webhook.endpoints]]": "Webhook endpoint",
  "[[webhook.rules]]": "Webhook rule",
  "[[webhook.templates]]": "Webhook template",
  "[[webhook.variables]]": "Webhook variable",
  "[[verify.services]]": "Verify service",
  "[[numbers]]": "Virtual number",
  "[[messaging_services]]": "Messaging Service",
  "[[http.bins]]": "HTTP bin",
  "[[email.tag_rules]]": "Tag rule",
  "[[email.forward_rules]]": "Forward rule",
};

const keyValuePattern = /^[A-Za-z0-9_.-]+\s*=\s*(.+)$/;

function checkTomlValue(valueText: string): string | null {
  const trimmedValue = valueText.trim();
  const isString = /^"(?:[^"\\]|\\.)*"$/.test(trimmedValue);
  const isNumber = /^-?\d+(\.\d+)?$/.test(trimmedValue);
  const isBoolean = trimmedValue === "true" || trimmedValue === "false";
  const isArray = trimmedValue.startsWith("[") && trimmedValue.endsWith("]");
  const isInlineTable =
    trimmedValue.startsWith("{") && trimmedValue.endsWith("}");

  if (isString || isNumber || isBoolean || isArray || isInlineTable) {
    return null;
  }

  return trimmedValue.startsWith('"')
    ? "A string is missing its closing quote"
    : "Put text values in double quotes";
}

/**
 * A line-by-line check of a seed file (PL-04.5): known sections, `key = value`
 * lines and value syntax, with a count of the items it would apply.
 */
export function validateSeedToml(seedToml: string): SeedValidation {
  const validationErrors: SeedValidationError[] = [];
  const itemCountsByKind = new Map<string, number>();

  for (const [lineIndex, rawLine] of seedToml.split("\n").entries()) {
    const seedLine = rawLine.trim();
    const lineNumber = lineIndex + 1;
    if (seedLine === "" || seedLine.startsWith("#")) {
      continue;
    }

    if (seedLine.startsWith("[")) {
      const itemKind = knownSeedSections[seedLine] ?? null;
      if (itemKind === null) {
        validationErrors.push({
          line: lineNumber,
          message: `Unknown section ${seedLine}`,
        });
      } else {
        itemCountsByKind.set(
          itemKind,
          (itemCountsByKind.get(itemKind) ?? 0) + 1,
        );
      }
      continue;
    }

    const keyValueMatch = seedLine.match(keyValuePattern);
    if (keyValueMatch === null) {
      validationErrors.push({
        line: lineNumber,
        message: "Expected key = value",
      });
      continue;
    }

    const valueError = checkTomlValue(keyValueMatch[1] ?? "");
    if (valueError !== null) {
      validationErrors.push({ line: lineNumber, message: valueError });
    }
  }

  return {
    is_valid: validationErrors.length === 0,
    errors: validationErrors,
    summary: [...itemCountsByKind.entries()].map(([itemKind, itemCount]) => ({
      item_kind: itemKind,
      item_count: itemCount,
    })),
  };
}

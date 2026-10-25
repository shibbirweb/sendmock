import { http, HttpResponse } from "msw";

import type {
  AppSettings,
  AppSettingsUpdate,
  SeedChangedItem,
  SeedFileRequest,
  SeedStatus,
  UpdateCheckResult,
} from "@/lib/api/types";
import { validateAppSettingsUpdate } from "@/lib/settings/validate-app-settings";
import { readMockConditions } from "@/mocks/conditions/mock-conditions";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { buildSeedToml, validateSeedToml } from "@/mocks/fixtures/seed-toml";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

const maskedPassword = "••••••••";
const seedSourcePath = "./sendmock.seed.toml";

/** `smtp://user:secret@host` to `smtp://user:••••••••@host`. */
function maskRelayUrl(relayUrl: string | null): string | null {
  return (
    relayUrl?.replace(/^(smtps?:\/\/[^:/@]+:)[^@]*@/, `$1${maskedPassword}@`) ??
    null
  );
}

function toSettingsResponse(appSettings: AppSettings): AppSettings {
  return {
    ...appSettings,
    relay_smtp_url: maskRelayUrl(appSettings.relay_smtp_url),
  };
}

/** A masked password sent back means "keep the stored one". */
function keepStoredRelayPassword(settingsUpdate: AppSettingsUpdate) {
  const storedUrl = mockDatabase.settings.relay_smtp_url;
  if (
    settingsUpdate.relay_smtp_url?.includes(maskedPassword) === true &&
    storedUrl !== null &&
    maskRelayUrl(storedUrl) === settingsUpdate.relay_smtp_url
  ) {
    settingsUpdate.relay_smtp_url = storedUrl;
  }
}

/** Configuration made outside the seed file, to export before it is lost. */
function listChangedItems(): SeedChangedItem[] {
  const configurationGroups = [
    {
      itemKind: "Virtual number",
      items: mockDatabase.virtualNumbers.map((virtualNumber) => ({
        name: virtualNumber.number,
        createdBy: virtualNumber.created_by,
      })),
    },
    {
      itemKind: "Messaging Service",
      items: mockDatabase.messagingServices.map((messagingService) => ({
        name: messagingService.friendly_name,
        createdBy: messagingService.created_by,
      })),
    },
    {
      itemKind: "Verify service",
      items: mockDatabase.verifyServices.map((verifyService) => ({
        name: verifyService.friendly_name,
        createdBy: verifyService.created_by,
      })),
    },
    {
      itemKind: "Webhook endpoint",
      items: mockDatabase.webhookEndpoints.map((webhookEndpoint) => ({
        name: webhookEndpoint.name,
        createdBy: webhookEndpoint.created_by,
      })),
    },
  ];

  return configurationGroups.flatMap(({ itemKind, items }) =>
    items
      .filter((configurationItem) => configurationItem.createdBy !== "seed")
      .map((configurationItem) => ({
        item_kind: itemKind,
        item_name: configurationItem.name,
        change: "added" as const,
      })),
  );
}

/** Settings, reset, delete-all and the seed file (PL-04, PL-05). */
export const settingsHandlers = [
  http.get("*/api/v1/settings", async () => {
    await applyMockConditions();

    return HttpResponse.json(toSettingsResponse(mockDatabase.settings));
  }),

  http.patch("*/api/v1/settings", async ({ request }) => {
    await applyMockConditions();
    const settingsUpdate = (await request.json()) as AppSettingsUpdate;
    const fieldErrors = validateAppSettingsUpdate(settingsUpdate);
    const [invalidField, fieldError] = Object.entries(fieldErrors)[0] ?? [];
    if (invalidField !== undefined) {
      return HttpResponse.json(
        {
          error: {
            code: "validation_failed",
            message: fieldError,
            field: invalidField,
          },
        },
        { status: 400 },
      );
    }

    keepStoredRelayPassword(settingsUpdate);
    mockDatabase.settings = { ...mockDatabase.settings, ...settingsUpdate };

    return HttpResponse.json(toSettingsResponse(mockDatabase.settings));
  }),

  http.post("*/api/v1/reset", async () => {
    await applyMockConditions();
    replaceMockDatabase(readMockConditions().dataSize);

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/v1/sms", async () => {
    await applyMockConditions();
    mockDatabase.smsMessages = [];
    publishMockEvent("sms.status", { id: null, status: "deleted" });

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/updates", async () => {
    await applyMockConditions();
    if (!mockDatabase.settings.is_update_check_enabled) {
      return createErrorResponse(
        409,
        "update_check_off",
        "Turn on the update check first",
      );
    }

    const updateCheckResult: UpdateCheckResult = {
      current_version: "0.0.0-dev",
      latest_version: "0.1.0-beta.1",
      is_update_available: true,
      release_url: "https://github.com/shibbirweb/sendmock/releases",
      checked_at: new Date().toISOString(),
    };

    return HttpResponse.json(updateCheckResult);
  }),

  http.get("*/api/v1/seed/status", async () => {
    await applyMockConditions();
    const seedStatus: SeedStatus = {
      source_path: seedSourcePath,
      applied_at: mockDatabase.seedAppliedAt,
      changed_items: listChangedItems(),
    };

    return HttpResponse.json(seedStatus);
  }),

  http.get("*/api/v1/seed/export", async () => {
    await applyMockConditions();

    return new HttpResponse(buildSeedToml(mockDatabase), {
      headers: {
        "Content-Type": "application/toml",
        "Content-Disposition": 'attachment; filename="sendmock.seed.toml"',
      },
    });
  }),

  http.post("*/api/v1/seed/validate", async ({ request }) => {
    await applyMockConditions();
    const { seed_toml: seedToml } = (await request.json()) as SeedFileRequest;

    return HttpResponse.json(validateSeedToml(seedToml));
  }),

  http.post("*/api/v1/seed/apply", async ({ request }) => {
    await applyMockConditions();
    const { seed_toml: seedToml } = (await request.json()) as SeedFileRequest;
    const seedValidation = validateSeedToml(seedToml);
    if (!seedValidation.is_valid) {
      return HttpResponse.json(seedValidation, { status: 422 });
    }

    // The demo keeps its configuration; it only records that a seed was applied.
    mockDatabase.seedAppliedAt = new Date().toISOString();

    return HttpResponse.json(seedValidation);
  }),
];

import { http, HttpResponse } from "msw";

import type {
  HttpBin,
  ProviderArea,
  ProviderBin,
  ProviderBinAttachment,
} from "@/lib/api/types";
import { readPresetDefaultResponse } from "@/lib/http/http-bin-presets";
import { validateHttpBinName } from "@/lib/http/validate-http-bin";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";

const providerAreas: ProviderArea[] = ["email", "sms", "push", "payments"];
const pushProviderKeys = ["fcm", "expo", "onesignal"];

function isProviderArea(area: unknown): area is ProviderArea {
  return providerAreas.includes(area as ProviderArea);
}

function hasProvider(area: ProviderArea, providerKey: string): boolean {
  switch (area) {
    case "email":
    case "sms":
      return mockDatabase.messageProviders.some(
        (provider) =>
          provider.area === area &&
          provider.key === providerKey &&
          !provider.is_removed,
      );
    case "push":
      return pushProviderKeys.includes(providerKey);
    case "payments":
      return mockDatabase.paymentGateways.some(
        (paymentGateway) => paymentGateway.key === providerKey,
      );
  }
}

/** The bin of that name, made without a preset when there is none, as the server does. */
function findOrCreateBin(binName: string): HttpBin {
  const existingBin = mockDatabase.httpBins.find(
    (httpBin) => httpBin.name === binName,
  );
  if (existingBin !== undefined) {
    return existingBin;
  }
  const createdBin: HttpBin = {
    id: createMockUlid(),
    name: binName,
    preset: null,
    request_count: 0,
    last_request_at: null,
    default_response: readPresetDefaultResponse(null),
  };
  mockDatabase.httpBins.push(createdBin);
  mockDatabase.httpResponseRules.set(createdBin.id, []);
  return createdBin;
}

/** HTTP Catcher bins attached to providers (PL-21). */
export const providerBinHandlers = [
  http.get("*/api/v1/provider-bins", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.providerBins);
  }),

  http.put(
    "*/api/v1/provider-bins/:area/:providerKey",
    async ({ params, request }) => {
      await applyMockConditions();
      const area = params.area;
      const providerKey = String(params.providerKey);
      const { bin_name: requestedName } =
        (await request.json()) as ProviderBinAttachment;
      const binName = requestedName.trim();
      const nameError = validateHttpBinName(
        { name: binName, preset: null },
        [],
      );
      if (!isProviderArea(area) || nameError !== null) {
        return createErrorResponse(
          400,
          "validation_failed",
          nameError ?? "Use email, sms, push or payments",
        );
      }
      if (!hasProvider(area, providerKey)) {
        return createErrorResponse(
          404,
          "not_found",
          `No ${area} provider with the key ${providerKey}`,
        );
      }
      const httpBin = findOrCreateBin(binName);
      const providerBin: ProviderBin = {
        area,
        provider_key: providerKey,
        bin_id: httpBin.id,
        bin_name: httpBin.name,
        attached_at: new Date().toISOString(),
      };
      mockDatabase.providerBins = [
        ...mockDatabase.providerBins.filter(
          (attached) =>
            attached.area !== area || attached.provider_key !== providerKey,
        ),
        providerBin,
      ];

      return HttpResponse.json(providerBin);
    },
  ),

  http.delete(
    "*/api/v1/provider-bins/:area/:providerKey",
    async ({ params }) => {
      await applyMockConditions();
      mockDatabase.providerBins = mockDatabase.providerBins.filter(
        (attached) =>
          attached.area !== params.area ||
          attached.provider_key !== params.providerKey,
      );

      return new HttpResponse(null, { status: 204 });
    },
  ),
];

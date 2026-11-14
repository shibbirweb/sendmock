import { http, HttpResponse } from "msw";

import type {
  MessageProviderArea,
  MessageProviderCreateRequest,
  MessageProviderInput,
  MessageProviderPreviewRequest,
} from "@/lib/api/types";
import {
  validateMessageProvider,
  validateNewProvider,
} from "@/lib/providers/validate-message-provider";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import {
  applyProviderInput,
  buildCustomProvider,
  findShippedProvider,
  listAreaProviders,
  presentMessageProvider,
} from "@/mocks/providers/message-provider-record";
import {
  findProviderTemplateErrors,
  previewMessageProvider,
} from "@/mocks/providers/preview-message-provider";

const notFoundLabel = "Provider";

function findProviderIndex(
  providerArea: MessageProviderArea,
  providerKey: unknown,
): number {
  return mockDatabase.messageProviders.findIndex(
    (providerRecord) =>
      providerRecord.area === providerArea &&
      providerRecord.key === providerKey,
  );
}

function presentProviderAt(providerIndex: number) {
  const providerRecord = mockDatabase.messageProviders[providerIndex];

  return providerRecord === undefined
    ? createNotFoundResponse(notFoundLabel)
    : HttpResponse.json(presentMessageProvider(mockDatabase, providerRecord));
}

/** The first field, route or template problem that refuses a save, or undefined. */
function findSaveProblem(
  providerArea: MessageProviderArea,
  providerInput: MessageProviderInput,
): string | undefined {
  const fieldError = Object.values(
    validateMessageProvider(
      providerInput,
      listAreaProviders(mockDatabase, providerArea),
    ),
  )[0];
  if (fieldError !== undefined) {
    return fieldError;
  }
  const templateError = findProviderTemplateErrors(providerInput)[0];

  return templateError === undefined
    ? undefined
    : `${templateError.part}: ${templateError.message}`;
}

/** The nine provider operations of one area (EM-18, SM-16; docs/plan/22). */
function buildProviderHandlers(
  providerArea: MessageProviderArea,
  basePath: string,
) {
  const providerPath = `*${basePath}/:providerKey`;

  return [
    http.get(`*${basePath}`, async () => {
      await applyMockConditions();

      return HttpResponse.json(
        listAreaProviders(mockDatabase, providerArea).map((providerRecord) =>
          presentMessageProvider(mockDatabase, providerRecord),
        ),
      );
    }),

    http.post(`*${basePath}`, async ({ request }) => {
      await applyMockConditions();
      const createRequest =
        (await request.json()) as MessageProviderCreateRequest;
      const areaProviders = listAreaProviders(mockDatabase, providerArea);
      const fieldErrors = validateNewProvider(
        createRequest.key,
        createRequest.name,
        areaProviders,
      );
      if (fieldErrors.key?.includes("already exists") === true) {
        return createErrorResponse(409, "provider_exists", fieldErrors.key);
      }
      const firstError = Object.values(fieldErrors)[0];
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }
      const providerRecord = buildCustomProvider(
        mockDatabase,
        providerArea,
        createRequest.key,
        createRequest.name.trim(),
        createRequest.start_from,
      );
      mockDatabase.messageProviders.push(providerRecord);

      return HttpResponse.json(
        presentMessageProvider(mockDatabase, providerRecord),
        { status: 201 },
      );
    }),

    http.get(providerPath, async ({ params }) => {
      await applyMockConditions();

      return presentProviderAt(
        findProviderIndex(providerArea, params.providerKey),
      );
    }),

    http.patch(providerPath, async ({ params, request }) => {
      await applyMockConditions();
      const providerIndex = findProviderIndex(providerArea, params.providerKey);
      const providerRecord = mockDatabase.messageProviders[providerIndex];
      if (providerRecord === undefined) {
        return createNotFoundResponse(notFoundLabel);
      }
      const providerInput = {
        ...((await request.json()) as MessageProviderInput),
        key: providerRecord.key,
      };
      const saveProblem = findSaveProblem(providerArea, providerInput);
      if (saveProblem !== undefined) {
        return createErrorResponse(400, "validation_failed", saveProblem);
      }
      mockDatabase.messageProviders[providerIndex] = applyProviderInput(
        providerRecord,
        providerInput,
      );

      return presentProviderAt(providerIndex);
    }),

    http.delete(providerPath, async ({ params }) => {
      await applyMockConditions();
      const providerIndex = findProviderIndex(providerArea, params.providerKey);
      const providerRecord = mockDatabase.messageProviders[providerIndex];
      if (providerRecord === undefined) {
        return createNotFoundResponse(notFoundLabel);
      }
      // A built-in is removed (restorable); a custom provider is deleted, its messages stay.
      if (providerRecord.is_builtin) {
        mockDatabase.messageProviders[providerIndex] = {
          ...providerRecord,
          is_removed: true,
        };
      } else {
        mockDatabase.messageProviders.splice(providerIndex, 1);
      }

      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${providerPath}/restore`, async ({ params }) => {
      await applyMockConditions();
      const providerIndex = findProviderIndex(providerArea, params.providerKey);
      const providerRecord = mockDatabase.messageProviders[providerIndex];
      if (providerRecord === undefined) {
        return createNotFoundResponse(notFoundLabel);
      }
      if (!providerRecord.is_removed) {
        return createErrorResponse(
          409,
          "not_removed",
          `${providerRecord.name} is not removed`,
        );
      }
      mockDatabase.messageProviders[providerIndex] = {
        ...providerRecord,
        is_removed: false,
      };

      return presentProviderAt(providerIndex);
    }),

    http.post(`${providerPath}/reset`, async ({ params }) => {
      await applyMockConditions();
      const providerIndex = findProviderIndex(providerArea, params.providerKey);
      const providerRecord = mockDatabase.messageProviders[providerIndex];
      if (providerRecord === undefined) {
        return createNotFoundResponse(notFoundLabel);
      }
      const shippedProvider = findShippedProvider(
        providerArea,
        providerRecord.key,
      );
      if (shippedProvider === undefined) {
        return createErrorResponse(
          409,
          "not_builtin",
          "Only built-in providers have a default to go back to",
        );
      }
      mockDatabase.messageProviders[providerIndex] = {
        ...shippedProvider,
        is_removed: providerRecord.is_removed,
      };

      return presentProviderAt(providerIndex);
    }),

    http.post(`${providerPath}/preview`, async ({ params, request }) => {
      await applyMockConditions();
      if (findProviderIndex(providerArea, params.providerKey) === -1) {
        return createNotFoundResponse(notFoundLabel);
      }
      const previewRequest =
        (await request.json()) as MessageProviderPreviewRequest;

      return HttpResponse.json(
        previewMessageProvider(
          mockDatabase,
          providerArea,
          { ...previewRequest.provider, key: String(params.providerKey) },
          previewRequest.sample_request,
        ),
      );
    }),

    http.get(
      `${providerPath}/credentials/:credentialName`,
      async ({ params }) => {
        await applyMockConditions();
        const credential = mockDatabase.messageProviders[
          findProviderIndex(providerArea, params.providerKey)
        ]?.credentials.find(
          (candidate) => candidate.name === params.credentialName,
        );

        return credential === undefined
          ? createNotFoundResponse("Credential")
          : HttpResponse.json({
              name: credential.name,
              value: credential.value,
            });
      },
    ),
  ];
}

/** Registered before `/emails/:emailId` and `/sms/:smsId`, which would match `providers`. */
export const messageProviderHandlers = [
  ...buildProviderHandlers("email", "/api/v1/emails/providers"),
  ...buildProviderHandlers("sms", "/api/v1/sms/providers"),
];

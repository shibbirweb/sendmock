import { http, HttpResponse } from "msw";

import type {
  MessagingService,
  MessagingServiceInput,
  VirtualNumber,
  VirtualNumberInput,
} from "@/lib/api/types";
import { validateMessagingServiceInput } from "@/lib/numbers/validate-messaging-service";
import { validateVirtualNumberInput } from "@/lib/numbers/validate-virtual-number";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  createMockUlid,
  createProviderId,
} from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

/**
 * Puts a number in one service's pool (or none) and keeps both sides in
 * sync: a number belongs to at most one Messaging Service (SM-03.4).
 */
function assignNumberToService(
  virtualNumber: VirtualNumber,
  serviceSid: string | null,
) {
  for (const messagingService of mockDatabase.messagingServices) {
    messagingService.number_ids = messagingService.number_ids.filter(
      (numberId) => numberId !== virtualNumber.id,
    );
    if (messagingService.sid === serviceSid) {
      messagingService.number_ids.push(virtualNumber.id);
    }
  }
  virtualNumber.messaging_service_sid = serviceSid;
}

function setServicePool(
  messagingService: MessagingService,
  numberIds: string[],
) {
  for (const virtualNumber of mockDatabase.virtualNumbers) {
    if (numberIds.includes(virtualNumber.id)) {
      assignNumberToService(virtualNumber, messagingService.sid);
    } else if (virtualNumber.messaging_service_sid === messagingService.sid) {
      assignNumberToService(virtualNumber, null);
    }
  }
}

function listRegisteredNumbers(exceptNumberId: string | null): string[] {
  return mockDatabase.virtualNumbers
    .filter((virtualNumber) => virtualNumber.id !== exceptNumberId)
    .map((virtualNumber) => virtualNumber.number);
}

function readFirstError(fieldErrors: Record<string, string | undefined>) {
  return Object.values(fieldErrors).find(
    (fieldError) => fieldError !== undefined,
  );
}

function findMessagingService(serviceSid: unknown) {
  return mockDatabase.messagingServices.find(
    (messagingService) => messagingService.sid === serviceSid,
  );
}

/** Virtual numbers and Messaging Services (SM-12, SM-03). */
export const numbersHandlers = [
  http.get("*/api/v1/numbers", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.virtualNumbers);
  }),

  http.post("*/api/v1/numbers", async ({ request }) => {
    await applyMockConditions();
    const numberInput = (await request.json()) as VirtualNumberInput;
    const firstError = readFirstError(
      validateVirtualNumberInput(numberInput, listRegisteredNumbers(null)),
    );
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }

    const virtualNumber: VirtualNumber = {
      ...numberInput,
      label: numberInput.label.trim(),
      messaging_service_sid: null,
      id: createMockUlid(),
      created_by: "ui",
    };
    mockDatabase.virtualNumbers.push(virtualNumber);
    assignNumberToService(virtualNumber, numberInput.messaging_service_sid);

    return HttpResponse.json(virtualNumber, { status: 201 });
  }),

  http.patch("*/api/v1/numbers/:numberId", async ({ params, request }) => {
    await applyMockConditions();
    const virtualNumber = mockDatabase.virtualNumbers.find(
      (existingNumber) => existingNumber.id === params.numberId,
    );
    if (virtualNumber === undefined) {
      return createNotFoundResponse("Number");
    }

    const numberInput = (await request.json()) as VirtualNumberInput;
    const firstError = readFirstError(
      validateVirtualNumberInput(
        numberInput,
        listRegisteredNumbers(virtualNumber.id),
      ),
    );
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }

    Object.assign(virtualNumber, numberInput, {
      label: numberInput.label.trim(),
    });
    assignNumberToService(virtualNumber, numberInput.messaging_service_sid);

    return HttpResponse.json(virtualNumber);
  }),

  http.delete("*/api/v1/numbers/:numberId", async ({ params }) => {
    await applyMockConditions();
    const virtualNumber = mockDatabase.virtualNumbers.find(
      (existingNumber) => existingNumber.id === params.numberId,
    );
    if (virtualNumber !== undefined) {
      assignNumberToService(virtualNumber, null);
    }
    mockDatabase.virtualNumbers = mockDatabase.virtualNumbers.filter(
      (existingNumber) => existingNumber.id !== params.numberId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/messaging-services", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.messagingServices);
  }),

  http.post("*/api/v1/messaging-services", async ({ request }) => {
    await applyMockConditions();
    const serviceInput = (await request.json()) as MessagingServiceInput;
    const firstError = readFirstError(
      validateMessagingServiceInput(serviceInput),
    );
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }

    const messagingService: MessagingService = {
      ...serviceInput,
      friendly_name: serviceInput.friendly_name.trim(),
      number_ids: [],
      sid: createProviderId("MG"),
      created_by: "ui",
    };
    mockDatabase.messagingServices.push(messagingService);
    setServicePool(messagingService, serviceInput.number_ids);

    return HttpResponse.json(messagingService, { status: 201 });
  }),

  http.patch(
    "*/api/v1/messaging-services/:serviceSid",
    async ({ params, request }) => {
      await applyMockConditions();
      const messagingService = findMessagingService(params.serviceSid);
      if (messagingService === undefined) {
        return createNotFoundResponse("Messaging Service");
      }

      const serviceInput = (await request.json()) as MessagingServiceInput;
      const firstError = readFirstError(
        validateMessagingServiceInput(serviceInput),
      );
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }

      Object.assign(messagingService, serviceInput, {
        friendly_name: serviceInput.friendly_name.trim(),
        number_ids: messagingService.number_ids,
      });
      setServicePool(messagingService, serviceInput.number_ids);

      return HttpResponse.json(messagingService);
    },
  ),

  http.delete("*/api/v1/messaging-services/:serviceSid", async ({ params }) => {
    await applyMockConditions();
    const messagingService = findMessagingService(params.serviceSid);
    if (messagingService !== undefined) {
      setServicePool(messagingService, []);
    }
    mockDatabase.messagingServices = mockDatabase.messagingServices.filter(
      (existingService) => existingService.sid !== params.serviceSid,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];

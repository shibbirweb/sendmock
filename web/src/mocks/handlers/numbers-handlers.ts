import { http, HttpResponse } from "msw";

import type {
  MessagingService,
  MessagingServiceCreateInput,
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

function readMainAccountSid(): string {
  const twilioProvider = mockDatabase.messageProviders.find(
    (messageProvider) =>
      messageProvider.area === "sms" && messageProvider.key === "twilio",
  );

  return (
    twilioProvider?.credentials.find(
      (credential) => credential.name === "account_sid",
    )?.value ?? ""
  );
}

/** The stored owner: a known subaccount's SID, null for the main account, undefined if unknown. */
function readKnownAccountSid(
  accountSid: string | null | undefined,
): string | null | undefined {
  const trimmedSid = accountSid?.trim() ?? "";
  if (trimmedSid === "" || trimmedSid === readMainAccountSid()) {
    return null;
  }

  return mockDatabase.twilioSubaccounts.some(
    (subaccount) => subaccount.account_sid === trimmedSid,
  )
    ? trimmedSid
    : undefined;
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

    const accountSid = readKnownAccountSid(numberInput.account_sid);
    if (accountSid === undefined) {
      return createErrorResponse(
        400,
        "validation_failed",
        "No Twilio account or subaccount with this SID",
      );
    }

    const virtualNumber: VirtualNumber = {
      ...numberInput,
      inbound_method: numberInput.inbound_method ?? "POST",
      opt_out_keywords: numberInput.opt_out_keywords ?? true,
      label: numberInput.label.trim(),
      messaging_service_sid: null,
      phone_number_sid: createProviderId("PN"),
      account_sid: accountSid,
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

    const accountSid = readKnownAccountSid(
      numberInput.account_sid ?? virtualNumber.account_sid,
    );
    if (accountSid === undefined) {
      return createErrorResponse(
        400,
        "validation_failed",
        "No Twilio account or subaccount with this SID",
      );
    }

    Object.assign(virtualNumber, numberInput, {
      inbound_method:
        numberInput.inbound_method ?? virtualNumber.inbound_method,
      label: numberInput.label.trim(),
      account_sid: accountSid,
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
    const { sid: chosenSid, ...serviceInput } =
      (await request.json()) as MessagingServiceCreateInput;
    const firstError = readFirstError(
      validateMessagingServiceInput(serviceInput),
    );
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }
    const trimmedSid = chosenSid?.trim() ?? "";
    if (trimmedSid !== "" && !/^MG[0-9a-fA-F]{32}$/.test(trimmedSid)) {
      return createErrorResponse(
        400,
        "validation_failed",
        "sid must be MG and 32 hex digits",
      );
    }
    const accountSid = readKnownAccountSid(serviceInput.account_sid);
    if (accountSid === undefined) {
      return createErrorResponse(
        400,
        "validation_failed",
        "No Twilio account or subaccount with this SID",
      );
    }
    if (findMessagingService(trimmedSid) !== undefined) {
      return createErrorResponse(
        409,
        "messaging_service_exists",
        `A Messaging Service with SID ${trimmedSid} already exists`,
      );
    }

    const messagingService: MessagingService = {
      ...serviceInput,
      inbound_mode: serviceInput.inbound_mode ?? "defer_to_sender",
      inbound_url: serviceInput.inbound_url ?? null,
      inbound_fallback_url: serviceInput.inbound_fallback_url ?? null,
      opt_out_keywords: serviceInput.opt_out_keywords ?? true,
      account_sid: accountSid,
      friendly_name: serviceInput.friendly_name.trim(),
      number_ids: [],
      sid: trimmedSid === "" ? createProviderId("MG") : trimmedSid,
      created_by: "ui",
    };
    mockDatabase.messagingServices.push(messagingService);
    setServicePool(messagingService, serviceInput.number_ids ?? []);

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

      const accountSid = readKnownAccountSid(
        serviceInput.account_sid === undefined
          ? messagingService.account_sid
          : serviceInput.account_sid,
      );
      if (accountSid === undefined) {
        return createErrorResponse(
          400,
          "validation_failed",
          "No Twilio account or subaccount with this SID",
        );
      }

      Object.assign(messagingService, serviceInput, {
        friendly_name: serviceInput.friendly_name.trim(),
        number_ids: messagingService.number_ids,
        account_sid: accountSid,
      });
      setServicePool(
        messagingService,
        serviceInput.number_ids ?? messagingService.number_ids,
      );

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

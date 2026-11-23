import { http, HttpResponse } from "msw";

import type { SmsMessageDetail } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

const stopKeywords = [
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
];
const startKeywords = ["START", "YES", "UNSTOP"];

function isTwilioOptOutOn(): boolean {
  const twilioProvider = mockDatabase.messageProviders.find(
    (messageProvider) =>
      messageProvider.area === "sms" && messageProvider.key === "twilio",
  );

  return twilioProvider?.opt_out_keywords ?? false;
}

/** STOP records an opt-out and START lifts it, as the server does for inbound texts (SM-23.1). */
export function applyMockOptOutKeyword(inboundMessage: SmsMessageDetail) {
  const keyword = inboundMessage.body.trim().toUpperCase();
  if (!isTwilioOptOutOn()) {
    return;
  }
  const appNumber = inboundMessage.to_number;
  const contactNumber = inboundMessage.from_number;
  const receivingNumber = mockDatabase.virtualNumbers.find(
    (virtualNumber) => virtualNumber.number === appNumber,
  );
  const serviceSid = receivingNumber?.messaging_service_sid ?? null;
  if (stopKeywords.includes(keyword)) {
    const sender = serviceSid ?? appNumber;
    mockDatabase.smsOptOuts = [
      {
        sender,
        contact_number: contactNumber,
        keyword: inboundMessage.body.trim(),
        created_at: new Date().toISOString(),
      },
      ...mockDatabase.smsOptOuts.filter(
        (optOut) =>
          !(
            optOut.sender === sender && optOut.contact_number === contactNumber
          ),
      ),
    ];
  }
  if (startKeywords.includes(keyword)) {
    mockDatabase.smsOptOuts = mockDatabase.smsOptOuts.filter(
      (optOut) =>
        optOut.contact_number !== contactNumber ||
        (optOut.sender !== appNumber && optOut.sender !== serviceSid),
    );
  }
}

/** Opt-outs: list, lift one, lift all (SM-23.3). */
export const smsOptOutHandlers = [
  http.get("*/api/v1/sms/opt-outs", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.smsOptOuts);
  }),

  http.delete(
    "*/api/v1/sms/opt-outs/:sender/:contactNumber",
    async ({ params }) => {
      await applyMockConditions();
      const remainingOptOuts = mockDatabase.smsOptOuts.filter(
        (optOut) =>
          !(
            optOut.sender === params.sender &&
            optOut.contact_number === params.contactNumber
          ),
      );
      if (remainingOptOuts.length === mockDatabase.smsOptOuts.length) {
        return createNotFoundResponse("Opt-out");
      }
      mockDatabase.smsOptOuts = remainingOptOuts;

      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.delete("*/api/v1/sms/opt-outs", async () => {
    await applyMockConditions();
    mockDatabase.smsOptOuts = [];

    return new HttpResponse(null, { status: 204 });
  }),
];

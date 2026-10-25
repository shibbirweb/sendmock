import { faker } from "@faker-js/faker/locale/en";

import type { VerificationDetail, VerifyService } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createProviderId } from "@/mocks/fixtures/fixture-helpers";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { sendOutboundSmsSample } from "@/mocks/samples/create-sample-sms";

const sampleRecipient = "+14155550100";
const verifySenderNumber = "+15550002222";

/** The first Verify service, or a new "Sample" service when there is none. */
function findOrCreateVerifyService(): VerifyService {
  const firstService = mockDatabase.verifyServices[0];
  if (firstService !== undefined) {
    return firstService;
  }

  const sampleService: VerifyService = {
    sid: createProviderId("VA"),
    friendly_name: "Sample",
    code_length: 6,
    fixed_code: null,
    ttl_seconds: 600,
    created_by: "ui",
  };
  mockDatabase.verifyServices.push(sampleService);

  return sampleService;
}

/**
 * Starts a pending verification and sends its code by SMS, like an app
 * calling the Twilio Verify API (UI-04.2).
 */
export function createSampleVerification(): string {
  const verifyService = findOrCreateVerifyService();
  const code =
    verifyService.fixed_code ?? faker.string.numeric(verifyService.code_length);
  const createdAt = new Date().toISOString();
  const codeMessage = sendOutboundSmsSample({
    fromNumber: verifySenderNumber,
    toNumber: sampleRecipient,
    body: `Your ${verifyService.friendly_name} verification code is: ${code}`,
  });
  const verification: VerificationDetail = {
    sid: createProviderId("VE"),
    service_sid: verifyService.sid,
    service_name: verifyService.friendly_name,
    to: sampleRecipient,
    channel: "sms",
    code,
    status: "pending",
    check_attempts: 0,
    send_attempts: 1,
    expires_at: new Date(
      Date.parse(createdAt) + verifyService.ttl_seconds * 1000,
    ).toISOString(),
    created_at: createdAt,
    linked_message_id: codeMessage.id,
    linked_thread_id: `${verifySenderNumber}|${sampleRecipient}`,
    timeline: [
      {
        kind: "started",
        at: createdAt,
        detail: `Started for ${sampleRecipient} by ${verifyService.friendly_name}`,
      },
      { kind: "code_sent", at: createdAt, detail: "Code sent as an SMS" },
    ],
  };

  mockDatabase.verifications.unshift(verification);
  publishMockEvent("verify.started", {
    sid: verification.sid,
    to: verification.to,
  });

  return verification.sid;
}

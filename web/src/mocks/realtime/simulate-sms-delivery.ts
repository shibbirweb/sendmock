import type { SmsMessageDetail, SmsStatus } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildSmsCallbackAttempt } from "@/mocks/fixtures/sms-callback-builder";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/** Delay before each step of the `realistic` profile, from the moment of sending. */
const realisticStepDelaysMs: { status: SmsStatus; delayMs: number }[] = [
  { status: "sent", delayMs: 700 },
  { status: "delivered", delayMs: 1800 },
];

/**
 * Records a status change in the message and its history, calls the status
 * callback URL when there is one (SM-08.1) and announces the change.
 */
export function applySmsStatus(
  smsMessage: SmsMessageDetail,
  smsStatus: SmsStatus,
  errorCode: string | null = null,
) {
  const statusChange = {
    status: smsStatus,
    at: new Date().toISOString(),
    error_code: errorCode,
  };
  smsMessage.status = smsStatus;
  smsMessage.error_code = errorCode;
  smsMessage.updated_at = statusChange.at;
  smsMessage.status_history.push(statusChange);
  if (smsMessage.status_callback_url !== null) {
    smsMessage.callback_attempts.push(
      buildSmsCallbackAttempt(
        smsMessage,
        smsMessage.status_callback_url,
        statusChange,
      ),
    );
  }
  publishMockEvent("sms.status", {
    id: smsMessage.id,
    status: smsStatus,
  });
}

function applyStatusIfStillStored(
  smsMessage: SmsMessageDetail,
  smsStatus: SmsStatus,
) {
  // The message may be deleted, or the database reset, before the step fires.
  if (!mockDatabase.smsMessages.includes(smsMessage)) {
    return;
  }

  applySmsStatus(smsMessage, smsStatus);
}

/**
 * Moves a new outbound message through queued, sent and delivered following
 * the SMS simulation profile in Settings (SM-07.1): `manual` stops at sent
 * until a status is set from the message drawer.
 */
export function simulateSmsDelivery(smsMessage: SmsMessageDetail) {
  const simulationProfile = mockDatabase.settings.sms_simulation_profile;

  if (simulationProfile === "manual") {
    applyStatusIfStillStored(smsMessage, "sent");
    return;
  }

  for (const deliveryStep of realisticStepDelaysMs) {
    if (simulationProfile === "instant") {
      applyStatusIfStillStored(smsMessage, deliveryStep.status);
      continue;
    }

    setTimeout(() => {
      applyStatusIfStillStored(smsMessage, deliveryStep.status);
    }, deliveryStep.delayMs);
  }
}

import type { SmsMessageDetail, SmsStatus } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/** Delay before each step of the `realistic` profile, from the moment of sending. */
const realisticStepDelaysMs: { status: SmsStatus; delayMs: number }[] = [
  { status: "sent", delayMs: 700 },
  { status: "delivered", delayMs: 1800 },
];

/** Records a status change in the message and its history and announces it. */
export function applySmsStatus(
  smsMessage: SmsMessageDetail,
  smsStatus: SmsStatus,
  errorCode: string | null = null,
) {
  const changedAt = new Date().toISOString();
  smsMessage.status = smsStatus;
  smsMessage.error_code = errorCode;
  smsMessage.updated_at = changedAt;
  smsMessage.status_history.push({
    status: smsStatus,
    at: changedAt,
    error_code: errorCode,
  });
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
 * the SMS simulation profile in Settings (SM-07.1): `manual` leaves it queued.
 */
export function simulateSmsDelivery(smsMessage: SmsMessageDetail) {
  const simulationProfile = mockDatabase.settings.sms_simulation_profile;

  if (simulationProfile === "manual") {
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

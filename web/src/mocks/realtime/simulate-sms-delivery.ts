import type { SmsMessageDetail, SmsStatus } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildSmsCallbackAttempt } from "@/mocks/fixtures/sms-callback-builder";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import type { SmsOutcomePlan } from "@/mocks/realtime/outcome-plans";

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

function isStillStored(smsMessage: SmsMessageDetail): boolean {
  // The message may be deleted, or the database reset, before a step fires.
  return mockDatabase.smsMessages.includes(smsMessage);
}

function applyStatusIfStillStored(
  smsMessage: SmsMessageDetail,
  smsStatus: SmsStatus,
  errorCode: string | null = null,
) {
  if (isStillStored(smsMessage)) {
    applySmsStatus(smsMessage, smsStatus, errorCode);
  }
}

function markReadIfStillStored(smsMessage: SmsMessageDetail) {
  if (!isStillStored(smsMessage)) {
    return;
  }

  smsMessage.open_count += 1;
  smsMessage.opened_at = smsMessage.opened_at ?? new Date().toISOString();
  publishMockEvent("sms.opened", { id: smsMessage.id });
}

/** Runs `step` now for the instant profile, after `delayMs` otherwise. */
function scheduleStep(isInstant: boolean, delayMs: number, step: () => void) {
  if (isInstant) {
    step();
    return;
  }

  setTimeout(step, delayMs);
}

/**
 * Plays a custom rule or magic number outcome (SM-07.8) after the message is
 * sent: a failure status with its code, a late delivery, or delivered then read.
 */
function playOutcomePlan(
  smsMessage: SmsMessageDetail,
  outcomePlan: SmsOutcomePlan,
) {
  const isInstant = mockDatabase.settings.sms_simulation_profile === "instant";
  const sentDelayMs = realisticStepDelaysMs[0]?.delayMs ?? 0;
  const finalDelayMs = realisticStepDelaysMs[1]?.delayMs ?? 0;

  scheduleStep(isInstant, sentDelayMs, () =>
    applyStatusIfStillStored(smsMessage, "sent"),
  );
  if (
    outcomePlan.outcome === "undelivered" ||
    outcomePlan.outcome === "failed"
  ) {
    scheduleStep(isInstant, finalDelayMs, () =>
      applyStatusIfStillStored(
        smsMessage,
        outcomePlan.outcome as SmsStatus,
        outcomePlan.errorCode,
      ),
    );
  } else if (outcomePlan.outcome === "delayed_delivery") {
    // The delay is the point of this outcome, so it applies in every profile.
    setTimeout(
      () => applyStatusIfStillStored(smsMessage, "delivered"),
      (outcomePlan.delaySeconds ?? 0) * 1000,
    );
  } else if (outcomePlan.outcome === "read") {
    scheduleStep(isInstant, finalDelayMs, () => {
      applyStatusIfStillStored(smsMessage, "delivered");
      markReadIfStillStored(smsMessage);
    });
  }
}

/**
 * Moves a new outbound message through queued, sent and delivered following
 * the SMS simulation profile in Settings (SM-07.1): `manual` stops at sent
 * until a status is set from the message drawer. An outcome plan from a
 * custom rule or magic number replaces the profile.
 */
export function simulateSmsDelivery(
  smsMessage: SmsMessageDetail,
  outcomePlan: SmsOutcomePlan | null = null,
) {
  if (outcomePlan !== null) {
    playOutcomePlan(smsMessage, outcomePlan);
    return;
  }

  const simulationProfile = mockDatabase.settings.sms_simulation_profile;
  if (simulationProfile === "manual") {
    applyStatusIfStillStored(smsMessage, "sent");
    return;
  }

  for (const deliveryStep of realisticStepDelaysMs) {
    scheduleStep(simulationProfile === "instant", deliveryStep.delayMs, () =>
      applyStatusIfStillStored(smsMessage, deliveryStep.status),
    );
  }
}

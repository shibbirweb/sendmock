import type {
  SmsMessageDetail,
  Verification,
  VerificationDetail,
  VerificationTimelineEntry,
  VerifyChannel,
  VerifyService,
} from "@/lib/api/types";
import { createProviderId, minutesAgo } from "@/mocks/fixtures/fixture-helpers";

export function buildVerifyServiceFixtures(): VerifyService[] {
  return [
    {
      sid: "VA00000000000000000000000000000001",
      friendly_name: "Acme Login",
      code_length: 6,
      fixed_code: null,
      ttl_seconds: 600,
      created_by: "seed",
    },
    {
      sid: "VA00000000000000000000000000000002",
      friendly_name: "Acme Checkout (fixed code)",
      code_length: 6,
      fixed_code: "123456",
      ttl_seconds: 600,
      created_by: "seed",
    },
  ];
}

type VerificationSpec = Pick<
  Verification,
  "to" | "channel" | "code" | "status" | "check_attempts"
> & { minutesAgo: number; serviceIndex: 0 | 1 };

const verificationSpecs: VerificationSpec[] = [
  {
    minutesAgo: 0.5,
    serviceIndex: 0,
    to: "+8801700000000",
    channel: "sms",
    code: "482913",
    status: "pending",
    check_attempts: 0,
  },
  {
    minutesAgo: 8,
    serviceIndex: 0,
    to: "+14155550123",
    channel: "sms",
    code: "550199",
    status: "approved",
    check_attempts: 1,
  },
  {
    minutesAgo: 25,
    serviceIndex: 1,
    to: "rahim@example.com",
    channel: "email",
    code: "123456",
    status: "approved",
    check_attempts: 2,
  },
  {
    minutesAgo: 35,
    serviceIndex: 0,
    to: "whatsapp:+8801722222222",
    channel: "whatsapp",
    code: "901273",
    status: "expired",
    check_attempts: 0,
  },
  {
    minutesAgo: 48,
    serviceIndex: 0,
    to: "+447700900123",
    channel: "sms",
    code: "377410",
    status: "max_attempts_reached",
    check_attempts: 5,
  },
  {
    minutesAgo: 55,
    serviceIndex: 0,
    to: "+61400000000",
    channel: "call",
    code: "640022",
    status: "canceled",
    check_attempts: 0,
  },
];

const codeDeliveryDescriptions: Record<VerifyChannel, string> = {
  sms: "Code sent as an SMS",
  whatsapp: "Code sent as a WhatsApp message",
  email: "Code sent as an email",
  call: "Code read out in a voice call (no audio is stored)",
};

function minutesAfter(isoTimestamp: string, minutes: number): string {
  return new Date(Date.parse(isoTimestamp) + minutes * 60_000).toISOString();
}

function buildFailedChecks(
  createdAt: string,
  failedCheckCount: number,
): VerificationTimelineEntry[] {
  return Array.from({ length: failedCheckCount }, (_, checkIndex) => ({
    kind: "check_failed" as const,
    at: minutesAfter(createdAt, 0.5 + checkIndex * 0.25),
    detail: `Wrong code entered (attempt ${checkIndex + 1})`,
  }));
}

/** What happened to a verification, derived from its final status. */
function buildVerificationTimeline(
  verification: Verification,
): VerificationTimelineEntry[] {
  const createdAt = verification.created_at;
  const timeline: VerificationTimelineEntry[] = [
    {
      kind: "started",
      at: createdAt,
      detail: `Started for ${verification.to} by ${verification.service_name}`,
    },
    {
      kind: "code_sent",
      at: minutesAfter(createdAt, 0.02),
      detail: codeDeliveryDescriptions[verification.channel],
    },
  ];

  if (verification.status === "approved") {
    timeline.push(
      ...buildFailedChecks(createdAt, verification.check_attempts - 1),
      {
        kind: "approved",
        at: minutesAfter(createdAt, 0.5 + verification.check_attempts * 0.25),
        detail: "Correct code entered",
      },
    );
  } else if (verification.status === "max_attempts_reached") {
    timeline.push(
      ...buildFailedChecks(createdAt, verification.check_attempts),
      {
        kind: "max_attempts_reached",
        at: minutesAfter(createdAt, 2),
        detail: "Too many wrong codes (Twilio error 60202)",
      },
    );
  } else if (verification.status === "expired") {
    timeline.push({
      kind: "expired",
      at: verification.expires_at,
      detail: "Not checked before the code expired",
    });
  } else if (verification.status === "canceled") {
    timeline.push({
      kind: "canceled",
      at: minutesAfter(createdAt, 1),
      detail: "Canceled by the app",
    });
  }

  return timeline;
}

export function buildVerificationFixtures(
  verifyServices: VerifyService[],
): VerificationDetail[] {
  return verificationSpecs.map((verificationSpec) => {
    const verifyService = verifyServices[verificationSpec.serviceIndex];
    const verification: Verification = {
      sid: createProviderId("VE"),
      service_sid: verifyService?.sid ?? "",
      service_name: verifyService?.friendly_name ?? "",
      to: verificationSpec.to,
      channel: verificationSpec.channel,
      code: verificationSpec.code,
      status: verificationSpec.status,
      check_attempts: verificationSpec.check_attempts,
      send_attempts: 1,
      expires_at: minutesAgo(verificationSpec.minutesAgo - 10),
      created_at: minutesAgo(verificationSpec.minutesAgo),
      linked_message_id: null,
      linked_thread_id: null,
    };

    return {
      ...verification,
      timeline: buildVerificationTimeline(verification),
    };
  });
}

/** Links each verification to the captured SMS that carried its code. */
export function linkVerificationMessages(
  verifications: VerificationDetail[],
  smsMessages: SmsMessageDetail[],
): VerificationDetail[] {
  return verifications.map((verification) => {
    const codeMessage = smsMessages.find(
      (smsMessage) =>
        smsMessage.to_number === verification.to &&
        smsMessage.body.includes(verification.code),
    );
    if (codeMessage === undefined) {
      return verification;
    }

    return {
      ...verification,
      linked_message_id: codeMessage.id,
      linked_thread_id: `${codeMessage.from_number}|${codeMessage.to_number}`,
    };
  });
}

import type {
  MessagingService,
  Verification,
  VerifyService,
  VirtualNumber,
} from "@/lib/api/types";
import {
  createMockUlid,
  createProviderId,
  minutesAgo,
} from "@/mocks/fixtures/fixture-helpers";

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

export function buildVerificationFixtures(
  verifyServices: VerifyService[],
): Verification[] {
  return verificationSpecs.map((verificationSpec) => {
    const verifyService = verifyServices[verificationSpec.serviceIndex];

    return {
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
    };
  });
}

export function buildVirtualNumberFixtures(): VirtualNumber[] {
  return [
    {
      id: createMockUlid(),
      number: "+15550001111",
      label: "Support line",
      channels: ["sms"],
      inbound_url: "http://localhost:8000/sms/inbound",
      inbound_template_id: "twilio.inbound_sms",
      status_callback_url: "http://localhost:8000/sms/status",
      messaging_service_sid: "MG00000000000000000000000000000001",
      created_by: "seed",
    },
    {
      id: createMockUlid(),
      number: "+15550002222",
      label: "Alerts",
      channels: ["sms"],
      inbound_url: null,
      inbound_template_id: null,
      status_callback_url: null,
      messaging_service_sid: "MG00000000000000000000000000000001",
      created_by: "ui",
    },
    {
      id: createMockUlid(),
      number: "+15550003333",
      label: "WhatsApp support",
      channels: ["whatsapp"],
      inbound_url: "http://localhost:8000/whatsapp/inbound",
      inbound_template_id: "twilio.inbound_sms",
      status_callback_url: null,
      messaging_service_sid: null,
      created_by: "mcp",
    },
  ];
}

export function buildMessagingServiceFixtures(
  virtualNumbers: VirtualNumber[],
): MessagingService[] {
  return [
    {
      sid: "MG00000000000000000000000000000001",
      friendly_name: "Acme notifications",
      number_ids: virtualNumbers
        .filter((virtualNumber) => virtualNumber.messaging_service_sid !== null)
        .map((virtualNumber) => virtualNumber.id),
      created_by: "seed",
    },
  ];
}

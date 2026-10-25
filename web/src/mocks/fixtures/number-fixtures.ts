import type { MessagingService, VirtualNumber } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

const notificationsServiceSid = "MG00000000000000000000000000000001";
const whatsappServiceSid = "MG00000000000000000000000000000002";

export function buildVirtualNumberFixtures(): VirtualNumber[] {
  return [
    {
      id: createMockUlid(),
      number: "+15550001111",
      label: "Support line",
      channels: ["sms"],
      inbound_url: "http://localhost:8000/sms/inbound",
      inbound_method: "POST",
      inbound_fallback_url: null,
      inbound_template_id: "twilio.inbound_sms",
      status_callback_url: "http://localhost:8000/sms/status",
      messaging_service_sid: notificationsServiceSid,
      created_by: "seed",
    },
    {
      id: createMockUlid(),
      number: "+15550002222",
      label: "Alerts",
      channels: ["sms"],
      inbound_url: null,
      inbound_method: "POST",
      inbound_fallback_url: null,
      inbound_template_id: null,
      status_callback_url: null,
      messaging_service_sid: notificationsServiceSid,
      created_by: "ui",
    },
    {
      id: createMockUlid(),
      number: "+15550003333",
      label: "WhatsApp support",
      channels: ["whatsapp"],
      inbound_url: "http://localhost:8000/whatsapp/inbound",
      inbound_method: "POST",
      inbound_fallback_url: "http://localhost:8000/whatsapp/fallback",
      inbound_template_id: "twilio.inbound_sms",
      status_callback_url: null,
      messaging_service_sid: whatsappServiceSid,
      created_by: "mcp",
    },
  ];
}

export function buildMessagingServiceFixtures(
  virtualNumbers: VirtualNumber[],
): MessagingService[] {
  const listPoolNumberIds = (serviceSid: string) =>
    virtualNumbers
      .filter(
        (virtualNumber) => virtualNumber.messaging_service_sid === serviceSid,
      )
      .map((virtualNumber) => virtualNumber.id);

  return [
    {
      sid: notificationsServiceSid,
      friendly_name: "Acme notifications",
      number_ids: listPoolNumberIds(notificationsServiceSid),
      inbound_mode: "defer_to_sender",
      inbound_url: null,
      inbound_fallback_url: null,
      created_by: "seed",
    },
    {
      sid: whatsappServiceSid,
      friendly_name: "Acme WhatsApp",
      number_ids: listPoolNumberIds(whatsappServiceSid),
      inbound_mode: "webhook",
      inbound_url: "http://localhost:8000/whatsapp/service-inbound",
      inbound_fallback_url: null,
      created_by: "ui",
    },
  ];
}

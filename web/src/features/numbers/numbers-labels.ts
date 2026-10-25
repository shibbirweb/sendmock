import type {
  MessagingServiceInboundMode,
  NumberChannel,
} from "@/lib/api/types";

export const numberChannelLabels: Record<NumberChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export const numberChannels: NumberChannel[] = ["sms", "whatsapp"];

export const inboundModeLabels: Record<MessagingServiceInboundMode, string> = {
  webhook: "Send a webhook",
  defer_to_sender: "Defer to sender's webhook",
  drop: "Drop the message",
};

export const inboundModeDescriptions: Record<
  MessagingServiceInboundMode,
  string
> = {
  webhook: "Inbound messages to any number in the pool go to one request URL.",
  defer_to_sender: "Each number uses its own inbound URL from the Numbers tab.",
  drop: "Inbound messages are stored but no webhook is sent.",
};

export const inboundModes: MessagingServiceInboundMode[] = [
  "webhook",
  "defer_to_sender",
  "drop",
];

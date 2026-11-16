import type { SmsMessage } from "@/lib/api/types";

function keepUrlSafeCharacters(phoneAddress: string): string {
  return phoneAddress.replace(/[^a-zA-Z0-9]/g, "");
}

/** Your app's number and the contact's, the same for both directions of a conversation. */
export function readThreadParticipants(
  smsMessage: Pick<SmsMessage, "direction" | "from_number" | "to_number">,
) {
  const isOutbound = smsMessage.direction === "outbound";

  return {
    appNumber: isOutbound ? smsMessage.from_number : smsMessage.to_number,
    contactNumber: isOutbound ? smsMessage.to_number : smsMessage.from_number,
  };
}

/**
 * The conversation an SMS belongs to, built as the binary builds it
 * (`sms-15550001111-8801700000000`), so thread ids are URL safe in both modes.
 */
export function readSmsThreadId(
  smsMessage: Pick<
    SmsMessage,
    "channel" | "direction" | "from_number" | "to_number"
  >,
): string {
  const { appNumber, contactNumber } = readThreadParticipants(smsMessage);

  return [
    smsMessage.channel === "whatsapp" ? "whatsapp" : "sms",
    keepUrlSafeCharacters(appNumber),
    keepUrlSafeCharacters(contactNumber),
  ].join("-");
}

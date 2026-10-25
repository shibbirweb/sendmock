import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { buildNewSmsMessage } from "@/mocks/fixtures/sms-message-builder";
import { runReplyWebhook } from "@/mocks/sms-replies/run-reply-webhook";

function setUpInbound(toNumber: string, channel: "sms" | "whatsapp" = "sms") {
  const mockDatabase = createMockDatabase("empty");
  const inboundMessage = buildNewSmsMessage({
    direction: "inbound",
    channel,
    api: "twilio",
    fromNumber:
      channel === "whatsapp" ? "whatsapp:+8801711111111" : "+8801711111111",
    toNumber,
    body: "Hello",
  });
  mockDatabase.smsMessages.unshift(inboundMessage);

  return { mockDatabase, inboundMessage };
}

describe("runReplyWebhook", () => {
  test("SM-09.7 the number's URL gets Twilio's fields and its TwiML becomes a reply", () => {
    const { mockDatabase, inboundMessage } = setUpInbound("+15550001111");
    const replies = runReplyWebhook(mockDatabase, inboundMessage);

    const [attempt] = inboundMessage.reply_webhook_attempts;
    const sentFields = new URLSearchParams(attempt?.request.body);
    expect(sentFields.get("From")).toBe("+8801711111111");
    expect(sentFields.get("Body")).toBe("Hello");
    expect(sentFields.get("MessagingServiceSid")).toBe(
      "MG00000000000000000000000000000001",
    );
    expect(attempt?.request.headers["x-twilio-signature"]).toMatch(/=$/);
    expect(inboundMessage.reply_webhook).toEqual({
      target: "number",
      outcome: "succeeded",
      status_code: 200,
      error_code: null,
      used_fallback: false,
      reply_count: 1,
    });
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({
      direction: "outbound",
      from_number: "+15550001111",
      to_number: "+8801711111111",
      in_reply_to_sms_id: inboundMessage.id,
    });
    expect(mockDatabase.smsMessages[0]).toBe(replies[0]);
  });

  test("SM-09.7 a refused connection gives 11205, then the fallback answers with ErrorCode and ErrorUrl", () => {
    const { mockDatabase, inboundMessage } = setUpInbound(
      "whatsapp:+15550003333",
      "whatsapp",
    );
    runReplyWebhook(mockDatabase, inboundMessage);

    const [primaryAttempt, fallbackAttempt] =
      inboundMessage.reply_webhook_attempts;
    expect(primaryAttempt).toMatchObject({
      is_fallback: false,
      error_code: "11205",
      response: null,
    });
    expect(fallbackAttempt?.is_fallback).toBe(true);
    const fallbackFields = new URLSearchParams(fallbackAttempt?.request.body);
    expect(fallbackFields.get("ErrorCode")).toBe("11205");
    expect(fallbackFields.get("ErrorUrl")).toBe(
      "http://app.internal:8000/whatsapp/inbound",
    );
    expect(fallbackFields.get("WaId")).toBe("8801711111111");
    expect(inboundMessage.reply_webhook).toMatchObject({
      target: "messaging_service",
      outcome: "succeeded",
      error_code: "11205",
      used_fallback: true,
      reply_count: 0,
    });
  });

  test("SM-09.7 a number without an inbound URL only reaches webhook rules", () => {
    const { mockDatabase, inboundMessage } = setUpInbound("+15550002222");

    expect(runReplyWebhook(mockDatabase, inboundMessage)).toEqual([]);
    expect(inboundMessage.reply_webhook).toBeNull();
    expect(inboundMessage.reply_webhook_attempts).toEqual([]);
  });

  test("SM-09.7 a 500 without a fallback fails with 11200", () => {
    const { mockDatabase, inboundMessage } = setUpInbound("+15550002222");
    const alertsNumber = mockDatabase.virtualNumbers.find(
      (virtualNumber) => virtualNumber.number === "+15550002222",
    );
    if (alertsNumber === undefined) {
      throw new Error("The fixtures need the Alerts number.");
    }
    alertsNumber.inbound_url = "http://localhost:8000/sms/error";
    runReplyWebhook(mockDatabase, inboundMessage);

    expect(inboundMessage.reply_webhook).toMatchObject({
      outcome: "failed",
      status_code: 500,
      error_code: "11200",
      used_fallback: false,
    });
  });
});

import { describe, expect, test } from "vitest";

import { describeReplyWebhook } from "@/lib/sms/describe-reply-webhook";

const succeeded = {
  target: "number" as const,
  outcome: "succeeded" as const,
  status_code: 200,
  error_code: null,
  used_fallback: false,
  reply_count: 1,
};

describe("describeReplyWebhook", () => {
  test("SM-09.7 names the status, replies, fallback and Twilio errors", () => {
    expect(describeReplyWebhook(succeeded)).toBe(
      "Reply webhook 200, 1 TwiML reply",
    );
    expect(describeReplyWebhook({ ...succeeded, reply_count: 0 })).toBe(
      "Reply webhook 200",
    );
    expect(
      describeReplyWebhook({
        ...succeeded,
        error_code: "11205",
        used_fallback: true,
        reply_count: 2,
      }),
    ).toBe("Fallback 200 after 11205, 2 TwiML replies");
    expect(
      describeReplyWebhook({
        ...succeeded,
        outcome: "failed",
        status_code: null,
        error_code: "11205",
        reply_count: 0,
      }),
    ).toBe("Reply webhook failed: 11205 HTTP connection failure");
    expect(describeReplyWebhook(null)).toBe("Rules only");
  });
});

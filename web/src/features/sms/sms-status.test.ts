import { describe, expect, test } from "vitest";

import { describeSmsErrorCode } from "@/features/sms/sms-labels";
import { readDisplayedSmsStatus } from "@/features/sms/sms-status-ticks";

describe("readDisplayedSmsStatus", () => {
  test("shows read once the message has been opened", () => {
    expect(
      readDisplayedSmsStatus({
        status: "delivered",
        opened_at: "2026-10-25T10:00:00Z",
      }),
    ).toBe("read");
  });

  test("keeps the delivery status while unopened", () => {
    expect(readDisplayedSmsStatus({ status: "sent", opened_at: null })).toBe(
      "sent",
    );
  });

  test("a failure wins over an open", () => {
    expect(
      readDisplayedSmsStatus({
        status: "undelivered",
        opened_at: "2026-10-25T10:00:00Z",
      }),
    ).toBe("undelivered");
  });
});

describe("describeSmsErrorCode", () => {
  test("adds Twilio's description to a known code", () => {
    expect(describeSmsErrorCode("30003")).toBe(
      "30003 Unreachable destination handset",
    );
  });

  test("falls back to the bare code when it is unknown", () => {
    expect(describeSmsErrorCode("99999")).toBe("Error 99999");
  });
});

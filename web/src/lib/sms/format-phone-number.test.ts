import { describe, expect, test } from "vitest";

import { stripChannelPrefix } from "@/lib/sms/format-phone-number";

describe("stripChannelPrefix", () => {
  test("removes the whatsapp: prefix", () => {
    expect(stripChannelPrefix("whatsapp:+8801722222222")).toBe(
      "+8801722222222",
    );
  });

  test("leaves a plain E.164 number unchanged", () => {
    expect(stripChannelPrefix("+15550001111")).toBe("+15550001111");
  });

  test("leaves an alphanumeric sender ID unchanged", () => {
    expect(stripChannelPrefix("ACME")).toBe("ACME");
  });
});

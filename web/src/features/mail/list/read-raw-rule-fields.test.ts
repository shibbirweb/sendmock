import { describe, expect, test } from "vitest";

import { readRawRuleFields } from "@/features/mail/list/read-raw-rule-fields";

describe("readRawRuleFields", () => {
  test("WH-13.1 reads the addresses and subject a rule filter checks, with folded lines", () => {
    const rawMessage = [
      "From: Sam <sam@example.test>",
      "To: support@inbound.app.test,",
      " Lee <lee@example.test>",
      "Subject: Re: Your",
      "  receipt",
      "",
      "Thanks",
    ].join("\r\n");

    expect(readRawRuleFields(rawMessage)).toEqual({
      from: ["sam@example.test"],
      to: ["support@inbound.app.test", "lee@example.test"],
      cc: [],
      subject: ["Re: Your receipt"],
    });
  });

  test("WH-13.1 a message without headers has empty fields", () => {
    expect(readRawRuleFields("")).toEqual({
      from: [],
      to: [],
      cc: [],
      subject: [""],
    });
  });
});

import { describe, expect, test } from "vitest";

import { defaultOtpPatterns } from "@/lib/settings/default-otp-patterns";
import { findOtpMatch } from "@/lib/settings/find-otp-match";
import { validateAppSettingsUpdate } from "@/lib/settings/validate-app-settings";

describe("validateAppSettingsUpdate", () => {
  test("PY-09.4 checks the merchant name, currency code and success rate", () => {
    expect(
      validateAppSettingsUpdate({
        payment_merchant_name: " ",
        payment_default_currency: "usd",
        payment_random_success_rate_percent: 101,
      }),
    ).toEqual({
      payment_merchant_name: "Use 1 to 60 characters",
      payment_default_currency: "Use a 3-letter currency code, e.g. USD",
      payment_random_success_rate_percent: "Choose 0 to 100",
    });
    expect(
      validateAppSettingsUpdate({
        payment_merchant_name: "Acme Shop",
        payment_default_currency: "BDT",
        payment_outcome_profile: "random",
        payment_random_success_rate_percent: 80,
      }),
    ).toEqual({});
  });

  test("PL-05.2 accepts valid values and checks only the keys sent", () => {
    expect(
      validateAppSettingsUpdate({
        max_emails: 500,
        max_age_days: null,
        sms_failure_rate_percent: 25,
        relay_smtp_url: "smtp://user:pass@smtp.example.com:587",
        spamassassin_address: "127.0.0.1:783",
        otp_patterns: defaultOtpPatterns,
      }),
    ).toEqual({});
  });

  test("PL-05.2 rejects out-of-range numbers per field", () => {
    expect(
      validateAppSettingsUpdate({
        max_emails: 0,
        max_age_days: 5000,
        sms_failure_rate_percent: 120,
        chaos_smtp_command_latency_ms: -1,
      }),
    ).toEqual({
      max_emails: "Choose 1 to 1,000,000",
      max_age_days: "Choose 1 to 3,650 days",
      sms_failure_rate_percent: "Choose 0 to 100%",
      chaos_smtp_command_latency_ms: "Choose 0 to 60,000 ms",
    });
  });

  test("PL-05.2 checks the relay URL, allowlist and SpamAssassin address", () => {
    const fieldErrors = validateAppSettingsUpdate({
      relay_smtp_url: "http://example.com",
      relay_recipient_allowlist: ["*@qa.test", "bad pattern"],
      spamassassin_address: "localhost",
    });

    expect(Object.keys(fieldErrors).sort()).toEqual([
      "relay_recipient_allowlist",
      "relay_smtp_url",
      "spamassassin_address",
    ]);
  });

  test("EM-05.5 flags invalid patterns and patterns without a capture group", () => {
    expect(
      validateAppSettingsUpdate({ otp_patterns: ["(\\d{6})", "([0-9"] })
        .otp_patterns,
    ).toBe("Pattern 2 is not a valid regular expression");
    expect(
      validateAppSettingsUpdate({ otp_patterns: ["\\d{6}"] }).otp_patterns,
    ).toBe("Pattern 1 needs a capture group around the code");
  });
});

describe("findOtpMatch", () => {
  test("EM-05.5 returns the first matching pattern and its code", () => {
    expect(
      findOtpMatch(
        defaultOtpPatterns,
        "Your Acme verification code is 482913.",
      ),
    ).toEqual({ patternIndex: 0, code: "482913" });
    expect(findOtpMatch(defaultOtpPatterns, "Use 739201 to sign in")).toEqual({
      patternIndex: 1,
      code: "739201",
    });
  });

  test("returns null when nothing matches and skips invalid patterns", () => {
    expect(findOtpMatch(["([0-9", "(\\d{4})"], "no digits here")).toBeNull();
    expect(findOtpMatch(["([0-9", "(\\d{4})"], "pin 1234")).toEqual({
      patternIndex: 1,
      code: "1234",
    });
  });
});

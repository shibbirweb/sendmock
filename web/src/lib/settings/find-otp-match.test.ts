import { describe, expect, test } from "vitest";

import { compileOtpPattern, findOtpMatch } from "@/lib/settings/find-otp-match";

/** The binary's default patterns, as `GET /api/v1/settings` answers them. */
const serverDefaultPatterns = [
  String.raw`(?i)(?:code|otp|verification|passcode|pin|one[- ]time)[^0-9\n]{0,40}?\b(\d{4,8})\b`,
  String.raw`(?i)\b(\d{4,8})\b[^0-9\n]{0,20}?is your (?:code|otp|verification|passcode|pin)`,
];

describe("compileOtpPattern", () => {
  test("EM-05.5 compiles the server's patterns, which start with a Rust inline flag", () => {
    for (const serverPattern of serverDefaultPatterns) {
      expect(compileOtpPattern(serverPattern)).not.toBeNull();
    }
  });

  test("EM-05.5 turns leading inline flags into RegExp flags and stays case-insensitive", () => {
    expect(compileOtpPattern("(?s)a.b")?.flags).toBe("is");
    expect(compileOtpPattern("(\\d{6})")?.flags).toBe("i");
  });

  test("EM-05.5 an invalid pattern compiles to null", () => {
    expect(compileOtpPattern("(?i)([0-9")).toBeNull();
  });
});

describe("findOtpMatch", () => {
  test("EM-05.5 the server's default patterns find a code in a message", () => {
    expect(
      findOtpMatch(serverDefaultPatterns, "Your verification CODE is 482913."),
    ).toEqual({ patternIndex: 0, code: "482913" });
  });
});

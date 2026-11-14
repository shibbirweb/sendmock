import { describe, expect, test } from "vitest";

import { parseSmtpTranscript } from "@/features/logs/smtp/parse-smtp-transcript";

describe("parseSmtpTranscript", () => {
  test("EM-09.4 tells client commands from server replies and reads reply codes", () => {
    const transcriptLines = parseSmtpTranscript(
      [
        "S: 220 sendmock ESMTP ready",
        "C: EHLO laravel.local",
        "S: 250-PIPELINING",
        "S: 354 End data with <CR><LF>.<CR><LF>",
        "S: 535 5.7.8 Authentication credentials invalid",
      ].join("\n"),
    );

    expect(
      transcriptLines.map((transcriptLine) => [
        transcriptLine.speaker,
        transcriptLine.replyCode,
        transcriptLine.replyClass,
      ]),
    ).toEqual([
      ["server", 220, "2xx"],
      ["client", null, null],
      ["server", 250, "2xx"],
      ["server", 354, "3xx"],
      ["server", 535, "5xx"],
    ]);
    expect(transcriptLines[1]?.text).toBe("EHLO laravel.local");
  });

  test("EM-09.2 marks the DATA placeholder so it can link to the email", () => {
    const [placeholderLine] = parseSmtpTranscript(
      "C: [message 2,148 bytes, stored as email]",
    );

    expect(placeholderLine?.isMessagePlaceholder).toBe(true);
  });

  test("keeps other lines as notes and skips empty ones", () => {
    expect(
      parseSmtpTranscript("S: 220 ready\n\n[connection closed by client]"),
    ).toEqual([
      expect.objectContaining({ speaker: "server" }),
      expect.objectContaining({
        speaker: "note",
        text: "[connection closed by client]",
      }),
    ]);
  });
});

import { describe, expect, test } from "vitest";

import {
  guessContentType,
  parseNativeAttachments,
} from "@/mocks/fixtures/native-attachments";

describe("parseNativeAttachments", () => {
  test("EM-07.4 decodes files and guesses missing content types", () => {
    const result = parseNativeAttachments([
      { filename: "invoice.pdf", content: btoa("%PDF-1.4 demo") },
      {
        filename: "logo.png",
        content: btoa("png-bytes"),
        content_type: "image/png",
        content_id: "logo",
      },
    ]);

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }
    expect(
      result.attachments.map((attachment) => attachment.content_type),
    ).toEqual(["application/pdf", "image/png"]);
    expect(result.attachments[0]?.size_bytes).toBe(13);
    expect(result.attachments[1]).toMatchObject({
      content_id: "logo",
      is_inline: true,
    });
  });

  test("EM-07.4 ignores line breaks and missing padding in the base64", () => {
    const result = parseNativeAttachments([
      { filename: "note.txt", content: "SGVs\nbG8" },
    ]);

    expect(
      result.isValid &&
        new TextDecoder().decode(result.attachments[0]?.fileBytes),
    ).toBe("Hello");
  });

  test("EM-07.5 names the attachment in each error", () => {
    expect(parseNativeAttachments([{ filename: " ", content: "" }])).toEqual({
      isValid: false,
      errorMessage: "attachments[0].filename is required",
    });
    expect(
      parseNativeAttachments([
        { filename: "a.txt", content: "YQ==" },
        { filename: "b.txt", content: "not base64!" },
      ]),
    ).toEqual({
      isValid: false,
      errorMessage: "attachments[1].content is not valid base64",
    });
  });

  test("no attachments is fine", () => {
    expect(parseNativeAttachments(undefined)).toEqual({
      isValid: true,
      attachments: [],
    });
  });
});

describe("guessContentType", () => {
  test("falls back to a generic binary type", () => {
    expect(guessContentType("photo.JPG")).toBe("image/jpeg");
    expect(guessContentType("data.bin")).toBe("application/octet-stream");
  });
});

import { describe, expect, test } from "vitest";

import { parseSmsMedia, toSmsMedia } from "@/mocks/fixtures/sms-media";

describe("parseSmsMedia", () => {
  test("SM-15.2 accepts URL and inline media together", () => {
    const mediaResult = parseSmsMedia({
      media_urls: ["https://cdn.example.com/photos/parcel.jpg"],
      media: [{ filename: "receipt.pdf", content: btoa("%PDF demo") }],
    });

    expect(mediaResult.isValid).toBe(true);
    if (!mediaResult.isValid) {
      return;
    }
    expect(
      mediaResult.media.map(({ mediaFields }) => [
        mediaFields.filename,
        mediaFields.content_type,
      ]),
    ).toEqual([
      ["parcel.jpg", "image/jpeg"],
      ["receipt.pdf", "application/pdf"],
    ]);
    expect(mediaResult.media[0]?.fileBytes).toBeNull();
    expect(toSmsMedia("SM1", mediaResult.media)[1]?.url).toBe(
      "/api/v1/sms/SM1/media/1",
    );
  });

  test("SM-15.3 enforces the 10 item limit across URLs and files", () => {
    expect(
      parseSmsMedia({
        media_urls: Array.from(
          { length: 8 },
          (_, urlIndex) => `https://cdn.example.com/${urlIndex}.png`,
        ),
        media: [
          { filename: "a.png", content: "YQ==" },
          { filename: "b.png", content: "YQ==" },
          { filename: "c.png", content: "YQ==" },
        ],
      }),
    ).toEqual({
      isValid: false,
      errorMessage: "A message can carry at most 10 media items",
    });
  });

  test("SM-15.3 names the item for bad base64, missing names and bad URLs", () => {
    expect(
      parseSmsMedia({ media: [{ filename: "photo.jpg", content: "!!" }] }),
    ).toEqual({
      isValid: false,
      errorMessage: "media[0].content is not valid base64",
    });
    expect(
      parseSmsMedia({ media: [{ filename: "", content: "YQ==" }] }),
    ).toEqual({
      isValid: false,
      errorMessage: "media[0].filename is required",
    });
    expect(parseSmsMedia({ media_urls: ["ftp://example.com/a.png"] })).toEqual({
      isValid: false,
      errorMessage: "media_urls[0] is not an http or https URL",
    });
  });
});

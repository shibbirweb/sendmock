import { describe, expect, test } from "vitest";

import {
  buildPreviewDocument,
  replaceContentIdReferences,
} from "@/features/mail/detail/preview/build-preview-document";
import type { EmailAttachment } from "@/lib/api/types";

const inlineImage: EmailAttachment = {
  index: 0,
  filename: "hero.png",
  content_type: "image/png",
  size_bytes: 1000,
  content_id: "hero-image",
  is_inline: true,
  download_url: "/api/v1/emails/01JB/attachments/0",
  thumbnail_url: null,
};

const resolveApiUrl = (apiPath: string) =>
  `http://sendmock.test/api/v1${apiPath}`;

describe("replaceContentIdReferences", () => {
  test("EM-04.4 points cid: images at their inline attachment", () => {
    expect(
      replaceContentIdReferences(
        '<img src="cid:hero-image">',
        [inlineImage],
        resolveApiUrl,
      ),
    ).toBe('<img src="http://sendmock.test/api/v1/emails/01JB/attachments/0">');
  });

  test("leaves unknown cid references untouched", () => {
    expect(
      replaceContentIdReferences('<img src="cid:missing">', [], resolveApiUrl),
    ).toBe('<img src="cid:missing">');
  });
});

describe("buildPreviewDocument", () => {
  const previewOptions = {
    htmlBody: "<p>Hello</p><script>alert(1)</script>",
    attachments: [],
    resolveApiUrl,
    appOrigin: "http://sendmock.test",
  };

  test("EM-04.1 the policy never allows scripts", () => {
    const previewDocument = buildPreviewDocument({
      ...previewOptions,
      isRemoteImagesAllowed: true,
    });

    expect(previewDocument).toContain("script-src 'none'");
    expect(previewDocument).toContain("default-src 'none'");
  });

  test("EM-04.2 remote images are blocked until allowed", () => {
    const blockedDocument = buildPreviewDocument({
      ...previewOptions,
      isRemoteImagesAllowed: false,
    });
    const allowedDocument = buildPreviewDocument({
      ...previewOptions,
      isRemoteImagesAllowed: true,
    });

    expect(blockedDocument).toContain(
      "img-src data: blob: http://sendmock.test;",
    );
    expect(allowedDocument).toContain(
      "img-src data: blob: http://sendmock.test https: http:;",
    );
  });
});

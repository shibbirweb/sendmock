import { describe, expect, test } from "bun:test";

import { buildPageMetadata } from "./page-metadata";

// A plain build (no NEXT_PUBLIC_BASE_PATH) is served at the domain root.
describe("a page's metadata", () => {
  test("WS-13.1 a page gets its title, description and an absolute canonical ending in a slash", () => {
    const pageMetadata = buildPageMetadata({
      title: "Install",
      description: "Install SendMock.",
      pagePath: "/docs/install",
    });

    expect(pageMetadata.title).toBe("Install");
    expect(pageMetadata.description).toBe("Install SendMock.");
    expect(pageMetadata.alternates?.canonical).toBe(
      "https://shibbir.me/docs/install/",
    );
    expect(pageMetadata.robots).toBeUndefined();
  });

  test("WS-13.4 a page gets Open Graph and large Twitter card tags with absolute image URLs", () => {
    const pageMetadata = buildPageMetadata({
      title: "Install",
      description: "Install SendMock.",
      pagePath: "/docs/install",
    });

    expect(pageMetadata.openGraph).toMatchObject({
      type: "website",
      siteName: "SendMock",
      url: "https://shibbir.me/docs/install/",
      title: "Install | SendMock",
      description: "Install SendMock.",
      images: [
        {
          url: "https://shibbir.me/social/sendmock-docs.png",
          width: 1200,
          height: 630,
        },
      ],
    });
    expect(pageMetadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Install | SendMock",
      images: [{ url: "https://shibbir.me/social/sendmock-docs.png" }],
    });
  });

  test("WS-13.4 the landing page uses its own image and its title as it is", () => {
    const pageMetadata = buildPageMetadata({
      title: "SendMock: local sandbox",
      description: "A local sandbox.",
      pagePath: "/",
      socialImage: "landing",
      isAbsoluteTitle: true,
    });

    expect(pageMetadata.title).toEqual({ absolute: "SendMock: local sandbox" });
    expect(pageMetadata.alternates?.canonical).toBe("https://shibbir.me/");
    expect(pageMetadata.openGraph?.title).toBe("SendMock: local sandbox");
    expect(pageMetadata.openGraph?.images).toMatchObject([
      { url: "https://shibbir.me/social/sendmock.png" },
    ]);
  });
});

import { describe, expect, test } from "bun:test";

import type { DocsVersionLink } from "@/lib/current-docs-version";

import {
  buildAbsoluteFileUrl,
  buildAbsolutePageUrl,
  resolveSiteRootPath,
} from "./site-url";

const publishedVersionLinks: DocsVersionLink[] = [
  {
    key: "stable",
    label: "Stable v1.1.0",
    kind: "stable",
    href: "/sendmock/",
  },
  { key: "next", label: "Beta (next)", kind: "next", href: "/sendmock/next/" },
  { key: "v1.0", label: "v1.0.0", kind: "older", href: "/sendmock/v1.0/" },
];

describe("site URLs", () => {
  test("WS-13.1 a page's address is absolute, under the base path and ends in a slash", () => {
    expect(
      buildAbsolutePageUrl("https://shibbir.me", "/sendmock", "/docs/install"),
    ).toBe("https://shibbir.me/sendmock/docs/install/");
    expect(
      buildAbsolutePageUrl("https://shibbir.me", "/sendmock", "docs/install/"),
    ).toBe("https://shibbir.me/sendmock/docs/install/");
    expect(buildAbsolutePageUrl("https://shibbir.me", "/sendmock", "/")).toBe(
      "https://shibbir.me/sendmock/",
    );
    expect(buildAbsolutePageUrl("https://shibbir.me", "", "/cli")).toBe(
      "https://shibbir.me/cli/",
    );
  });

  test("WS-13.1 a path made only of slashes, or with a long run of them, trims in linear time", () => {
    const manySlashes = "/".repeat(100_000);
    expect(buildAbsolutePageUrl("https://shibbir.me", "/sendmock", "///")).toBe(
      "https://shibbir.me/sendmock/",
    );
    expect(
      buildAbsolutePageUrl(
        "https://shibbir.me",
        "/sendmock",
        `${manySlashes}docs${manySlashes}x`,
      ),
    ).toBe(`https://shibbir.me/sendmock/docs${manySlashes}x/`);
  });

  test("WS-13.4 a file's address is absolute and has no trailing slash", () => {
    expect(
      buildAbsoluteFileUrl(
        "https://shibbir.me",
        "/sendmock",
        "/social/sendmock.png",
      ),
    ).toBe("https://shibbir.me/sendmock/social/sendmock.png");
  });

  test("WS-13.2 every docs version's links point at the site root, not at the version", () => {
    expect(resolveSiteRootPath(publishedVersionLinks, "/sendmock/v1.0")).toBe(
      "/sendmock",
    );
    expect(resolveSiteRootPath(publishedVersionLinks, "/sendmock/next")).toBe(
      "/sendmock",
    );
  });

  test("WS-13.2 before the first stable, the Preview at the root is the site root", () => {
    expect(
      resolveSiteRootPath(
        [
          {
            key: "preview",
            label: "Preview",
            kind: "preview",
            href: "/sendmock/",
          },
          {
            key: "next",
            label: "Beta (next)",
            kind: "next",
            href: "/sendmock/next/",
          },
        ],
        "/sendmock/next",
      ),
    ).toBe("/sendmock");
  });

  test("WS-13.1 without a version list, a plain build is its own root", () => {
    expect(resolveSiteRootPath([], "/sendmock/")).toBe("/sendmock");
    expect(resolveSiteRootPath([], "")).toBe("");
  });
});

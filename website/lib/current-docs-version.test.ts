import { describe, expect, test } from "bun:test";

import { parseDocsVersionLinks } from "./current-docs-version";

describe("parseDocsVersionLinks", () => {
  test("WS-03.6 a plain build lists the Preview and the beta docs under its base path", () => {
    expect(parseDocsVersionLinks(undefined, "/sendmock")).toEqual([
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
    ]);
  });

  test("WS-03.6 a versioned build lists what the build script wrote", () => {
    const versionLinks = [
      { key: "stable", label: "Stable v0.3.1", kind: "stable", href: "/" },
      { key: "next", label: "Beta (next)", kind: "next", href: "/next/" },
      { key: "v0.2", label: "v0.2.4", kind: "older", href: "/v0.2/" },
    ];

    expect(parseDocsVersionLinks(JSON.stringify(versionLinks), "")).toEqual(
      versionLinks,
    );
  });

  test("WS-03.6 a broken or empty list falls back to the plain build's list", () => {
    for (const versionsJson of ["not json", "[]", "{}"]) {
      expect(
        parseDocsVersionLinks(versionsJson, "").map(
          (versionLink) => versionLink.key,
        ),
      ).toEqual(["preview", "next"]);
    }
  });
});

import { describe, expect, test } from "bun:test";

import {
  resolveStaticSiteRequest,
  type StaticSitePathKind,
} from "./static-site-request";

const exportedSitePaths: Record<string, StaticSitePathKind> = {
  "index.html": "file",
  "404.html": "file",
  docs: "directory",
  "docs/index.html": "file",
  "llms.txt": "file",
  "openapi.html": "file",
  "sendmock/v1.0": "directory",
  "sendmock/v1.0/index.html": "file",
  "sendmock/v1.0/docs/index.html": "file",
};

function findExportedPathKind(relativePath: string): StaticSitePathKind {
  return exportedSitePaths[relativePath] ?? "missing";
}

describe("resolveStaticSiteRequest", () => {
  test("serves the root index page", () => {
    expect(resolveStaticSiteRequest("/", findExportedPathKind)).toEqual({
      kind: "file",
      relativeFilePath: "index.html",
    });
  });

  test("serves the index page of a folder whose name has a dot, like a docs version", () => {
    expect(
      resolveStaticSiteRequest("/sendmock/v1.0/", findExportedPathKind),
    ).toEqual({ kind: "file", relativeFilePath: "sendmock/v1.0/index.html" });
    expect(
      resolveStaticSiteRequest("/sendmock/v1.0/docs/", findExportedPathKind),
    ).toEqual({
      kind: "file",
      relativeFilePath: "sendmock/v1.0/docs/index.html",
    });
  });

  test("serves a file as it is", () => {
    expect(resolveStaticSiteRequest("/llms.txt", findExportedPathKind)).toEqual(
      {
        kind: "file",
        relativeFilePath: "llms.txt",
      },
    );
  });

  test("falls back to the page's .html file", () => {
    expect(resolveStaticSiteRequest("/openapi", findExportedPathKind)).toEqual({
      kind: "file",
      relativeFilePath: "openapi.html",
    });
  });

  test("redirects a folder asked for without its slash", () => {
    expect(
      resolveStaticSiteRequest("/sendmock/v1.0", findExportedPathKind),
    ).toEqual({ kind: "redirect", location: "/sendmock/v1.0/" });
  });

  test("answers not found for a missing page, a folder without an index and a path outside the site", () => {
    expect(resolveStaticSiteRequest("/missing/", findExportedPathKind)).toEqual(
      {
        kind: "not-found",
      },
    );
    expect(
      resolveStaticSiteRequest("/sendmock/", findExportedPathKind),
    ).toEqual({
      kind: "not-found",
    });
    expect(
      resolveStaticSiteRequest("/docs/../../secret", findExportedPathKind),
    ).toEqual({ kind: "not-found" });
    expect(resolveStaticSiteRequest("/%E0%A4%A", findExportedPathKind)).toEqual(
      {
        kind: "not-found",
      },
    );
  });
});

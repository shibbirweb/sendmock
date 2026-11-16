import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listBuiltPagePaths } from "./docs-version-pages";

let siteDirectory = "";

function writeBuiltPage(pagePath: string) {
  const pageDirectory = join(siteDirectory, pagePath);
  mkdirSync(pageDirectory, { recursive: true });
  writeFileSync(join(pageDirectory, "index.html"), "<html></html>");
}

beforeEach(() => {
  siteDirectory = mkdtempSync(join(tmpdir(), "sendmock-built-pages-"));
});

afterEach(() => {
  rmSync(siteDirectory, { recursive: true, force: true });
});

test("WS-13.2 lists every built page of the root version as a page path", () => {
  writeBuiltPage("");
  writeBuiltPage("docs");
  writeBuiltPage("docs/install");
  writeBuiltPage("api/mail");
  mkdirSync(join(siteDirectory, "_next/static"), { recursive: true });
  writeFileSync(join(siteDirectory, "sitemap.xml"), "<urlset></urlset>");

  expect(listBuiltPagePaths(siteDirectory, new Set())).toEqual([
    "/",
    "/api/mail",
    "/docs",
    "/docs/install",
  ]);
});

test("WS-13.2 leaves out the demo and the other versions copied inside the root", () => {
  writeBuiltPage("");
  writeBuiltPage("docs");
  writeBuiltPage("demo");
  writeBuiltPage("demo/mail");
  writeBuiltPage("next/docs");
  writeBuiltPage("v1.0/docs");

  expect(
    listBuiltPagePaths(siteDirectory, new Set(["demo", "next", "v1.0"])),
  ).toEqual(["/", "/docs"]);
});

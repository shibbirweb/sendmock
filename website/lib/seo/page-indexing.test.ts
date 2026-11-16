import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  normalizePagePath,
  readRootPagePaths,
  resolvePageIndexing,
} from "./page-indexing";

let temporaryDirectory = "";

afterEach(() => {
  if (temporaryDirectory !== "") {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = "";
  }
});

function writeRootPagePaths(fileContent: string): string {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "sendmock-root-pages-"));
  const rootPagePathsFile = join(temporaryDirectory, "root-page-paths.json");
  writeFileSync(rootPagePathsFile, fileContent);
  return rootPagePathsFile;
}

describe("which pages search engines index", () => {
  test("WS-13.2 page paths compare without their slashes", () => {
    expect(normalizePagePath("/docs/install/")).toBe("/docs/install");
    expect(normalizePagePath("docs/install")).toBe("/docs/install");
    expect(normalizePagePath("/")).toBe("/");
    expect(normalizePagePath("")).toBe("/");
  });

  test("WS-13.1 every page of the root build is canonical", () => {
    expect(resolvePageIndexing("/docs/install", null)).toBe("canonical");
    expect(readRootPagePaths(undefined)).toBeNull();
    expect(readRootPagePaths("")).toBeNull();
  });

  test("WS-13.2 a page of another version is canonical when the root has it, noindex when not", () => {
    const rootPagePaths = readRootPagePaths(
      writeRootPagePaths('["/", "/docs", "/docs/install"]'),
    );

    expect(resolvePageIndexing("/docs/install/", rootPagePaths)).toBe(
      "canonical",
    );
    expect(resolvePageIndexing("/", rootPagePaths)).toBe("canonical");
    expect(resolvePageIndexing("/docs/removed-page", rootPagePaths)).toBe(
      "noindex",
    );
  });

  test("WS-13.2 a missing or broken page list stops the build", () => {
    expect(() => readRootPagePaths("/no/such/root-page-paths.json")).toThrow(
      "does not exist",
    );
    expect(() =>
      readRootPagePaths(writeRootPagePaths('{"pages": []}')),
    ).toThrow("is not a list");
  });
});

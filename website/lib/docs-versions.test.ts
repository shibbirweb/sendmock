import { describe, expect, test } from "bun:test";

import { resolveDocsVersions } from "./docs-versions";

function summarise(tagNames: string[]) {
  return resolveDocsVersions(tagNames).map((docsVersion) => [
    docsVersion.key,
    docsVersion.label,
    docsVersion.path,
    docsVersion.gitRef,
  ]);
}

describe("resolveDocsVersions", () => {
  test("WS-03.4 with no stable tag, / is a Preview from develop and /next/ is the beta docs", () => {
    expect(summarise([])).toEqual([
      ["preview", "Preview", "", null],
      ["next", "Beta (next)", "/next", null],
    ]);
  });

  test("WS-03.4 beta tags get no docs of their own", () => {
    expect(summarise(["v0.1.0-beta.1", "v0.1.0-beta.2"])).toEqual([
      ["preview", "Preview", "", null],
      ["next", "Beta (next)", "/next", null],
    ]);
  });

  test("WS-03.4 the newest stable minor is at /, older minors at /vX.Y/ from their newest patch", () => {
    expect(
      summarise([
        "v0.1.0",
        "v0.2.0",
        "v0.1.3",
        "v0.3.0-beta.1",
        "v0.2.4",
        "v0.3.1",
        "v0.3.0",
        "v0.2.10",
      ]),
    ).toEqual([
      ["stable", "Stable v0.3.1", "", "v0.3.1"],
      ["next", "Beta (next)", "/next", null],
      ["v0.2", "v0.2.10", "/v0.2", "v0.2.10"],
      ["v0.1", "v0.1.3", "/v0.1", "v0.1.3"],
    ]);
  });

  test("WS-03.4 a new major sorts above every 0.x minor and other tags are ignored", () => {
    expect(summarise(["v0.9.2", "v1.0.0", "latest", "beta", "1.2.3"])).toEqual([
      ["stable", "Stable v1.0.0", "", "v1.0.0"],
      ["next", "Beta (next)", "/next", null],
      ["v0.9", "v0.9.2", "/v0.9", "v0.9.2"],
    ]);
  });
});

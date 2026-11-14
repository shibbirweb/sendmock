import { describe, expect, test } from "bun:test";

import {
  commentMarker,
  formatSize,
  readChecksumLine,
  renderTestBuildsReport,
  type TestBuild,
  testBuildTargets,
} from "./test-builds-report";

const commitSha = "c0ffee1234567890abcdef1234567890abcdef12";

function buildFor(targetTriple: string): TestBuild {
  const extension = targetTriple.includes("windows") ? "zip" : "tar.gz";
  return {
    targetTriple,
    archiveName: `sendmock-${targetTriple}.${extension}`,
    sizeBytes: 12_345_678,
    sha256: `${targetTriple.length}`.padStart(64, "a"),
    downloadUrl: `https://github.com/shibbirweb/sendmock/actions/runs/1/artifacts/${targetTriple.length}`,
  };
}

function renderWith(builds: TestBuild[]): string {
  return renderTestBuildsReport({
    builds,
    commitSha,
    version: "0.1.0-beta.4",
    runUrl: "https://github.com/shibbirweb/sendmock/actions/runs/1",
    retentionDays: 14,
  });
}

describe("Test builds report", () => {
  test("DS-11.4 lists every platform with its archive, size, SHA-256 and download link", () => {
    const builds = testBuildTargets.map(({ targetTriple }) =>
      buildFor(targetTriple),
    );

    const report = renderWith(builds);

    for (const build of builds) {
      expect(report).toContain(`[${build.archiveName}](${build.downloadUrl})`);
      expect(report).toContain(`\`${build.sha256}\``);
    }
    expect(report).toContain("| 12.3 MB |");
    expect(report).toContain("| Platform | Download | Size | SHA-256 |");
    expect(report).not.toContain("Not attached");
  });

  test("DS-11.4 names the commit, the dev channel and how long the downloads are kept", () => {
    const report = renderWith([buildFor("x86_64-unknown-linux-musl")]);

    expect(report).toContain("### Test builds of c0ffee1");
    expect(report).toContain(`built from ${commitSha}`);
    expect(report).toContain("SendMock 0.1.0-beta.4 on the `dev` channel");
    expect(report).toContain("kept 14 days");
    expect(report).toContain("install.md#try-a-build-that-is-not-released-yet");
  });

  test("DS-11.4 starts with the marker that finds the one comment to update", () => {
    expect(renderWith([]).startsWith(commentMarker)).toBe(true);
  });

  test("DS-11.4 says which platforms are not attached because their build or tests failed", () => {
    const report = renderWith([buildFor("x86_64-unknown-linux-musl")]);

    expect(report).toContain(
      "Not attached, since its build or tests did not pass: macOS, Apple silicon (`aarch64-apple-darwin`)",
    );
    expect(report).not.toContain(
      "Linux, x64 (static) (`x86_64-unknown-linux-musl`)",
    );
  });

  test("reads the checksum file package-archive.ts writes", () => {
    expect(
      readChecksumLine(
        `${"b".repeat(64)}  sendmock-x86_64-pc-windows-msvc.zip\n`,
      ),
    ).toEqual({
      sha256: "b".repeat(64),
      archiveName: "sendmock-x86_64-pc-windows-msvc.zip",
    });
    expect(formatSize(9_950_000)).toBe("10.0 MB");
  });
});

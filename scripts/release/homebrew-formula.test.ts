import { describe, expect, test } from "bun:test";

import {
  buildHomebrewFormula,
  parseChecksums,
  readFormulaName,
} from "./homebrew-formula";

const checksumsText = [
  "aa  sendmock-aarch64-apple-darwin.tar.gz",
  "bb  sendmock-x86_64-apple-darwin.tar.gz",
  "cc  sendmock-aarch64-unknown-linux-musl.tar.gz",
  "dd  sendmock-x86_64-unknown-linux-musl.tar.gz",
  "ee  sendmock-x86_64-pc-windows-msvc.zip",
].join("\n");

describe("Homebrew formula", () => {
  test("DS-03.1 the beta formula points at the release's archives with their checksums", () => {
    const formula = buildHomebrewFormula(
      "0.1.0-beta.1",
      "beta",
      parseChecksums(checksumsText),
    );

    expect(formula).toContain("class SendmockBeta < Formula");
    expect(formula).toContain('version "0.1.0-beta.1"');
    expect(formula).toContain(
      'url "https://github.com/shibbirweb/sendmock/releases/download/v0.1.0-beta.1/sendmock-aarch64-apple-darwin.tar.gz"\n      sha256 "aa"',
    );
    expect(formula).toContain(
      'sendmock-x86_64-unknown-linux-musl.tar.gz"\n      sha256 "dd"',
    );
    expect(formula).toContain('conflicts_with "sendmock"');
  });

  test("stable gets the plain name and conflicts with the beta", () => {
    const formula = buildHomebrewFormula(
      "0.1.0",
      "stable",
      parseChecksums(checksumsText),
    );

    expect(readFormulaName("stable")).toBe("sendmock");
    expect(formula).toContain("class Sendmock < Formula");
    expect(formula).toContain('conflicts_with "sendmock-beta"');
  });

  test("a missing archive stops the release instead of writing a broken formula", () => {
    expect(() =>
      buildHomebrewFormula(
        "0.1.0",
        "stable",
        parseChecksums("aa  sendmock-aarch64-apple-darwin.tar.gz"),
      ),
    ).toThrow("SHA256SUMS has no sendmock-x86_64-apple-darwin.tar.gz");
  });
});

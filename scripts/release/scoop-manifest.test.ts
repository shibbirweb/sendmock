import { describe, expect, test } from "bun:test";

import { parseChecksums } from "./homebrew-formula";
import { buildScoopManifest, readScoopManifestName } from "./scoop-manifest";

const checksums = parseChecksums(
  [
    "aa  sendmock-x86_64-pc-windows-msvc.zip",
    "bb  sendmock-aarch64-pc-windows-msvc.zip",
    "cc  sendmock-x86_64-unknown-linux-musl.tar.gz",
  ].join("\n"),
);

describe("Scoop manifest", () => {
  test("DS-03.1 the stable manifest installs the release's Windows archives with their hashes", () => {
    const scoopManifest = buildScoopManifest("1.2.0", "stable", checksums);

    expect(scoopManifest.version).toBe("1.2.0");
    expect(scoopManifest.bin).toBe("sendmock.exe");
    expect(scoopManifest.architecture).toEqual({
      "64bit": {
        url: "https://github.com/shibbirweb/sendmock/releases/download/v1.2.0/sendmock-x86_64-pc-windows-msvc.zip",
        hash: "aa",
      },
      arm64: {
        url: "https://github.com/shibbirweb/sendmock/releases/download/v1.2.0/sendmock-aarch64-pc-windows-msvc.zip",
        hash: "bb",
      },
    });
    expect(scoopManifest.checkver).toEqual({
      github: "https://github.com/shibbirweb/sendmock",
    });
  });

  test("DS-03.1 the beta manifest is sendmock-beta and leaves updates to Release build", () => {
    const scoopManifest = buildScoopManifest("1.3.0-beta.1", "beta", checksums);

    expect(readScoopManifestName("beta")).toBe("sendmock-beta");
    expect(readScoopManifestName("stable")).toBe("sendmock");
    expect(scoopManifest.checkver).toBeUndefined();
    expect(scoopManifest.autoupdate).toBeUndefined();
  });

  test("downloads from another address when given one", () => {
    const scoopManifest = buildScoopManifest(
      "1.2.0",
      "stable",
      checksums,
      "http://127.0.0.1:8765",
    );

    expect(
      (scoopManifest.architecture as Record<string, { url: string }>)["64bit"]
        .url,
    ).toBe("http://127.0.0.1:8765/sendmock-x86_64-pc-windows-msvc.zip");
  });

  test("refuses SHA256SUMS without a Windows archive", () => {
    expect(() =>
      buildScoopManifest("1.2.0", "stable", parseChecksums("cc  other.zip")),
    ).toThrow("SHA256SUMS has no sendmock-x86_64-pc-windows-msvc.zip");
  });
});

import { describe, expect, test } from "bun:test";

import { buildChocolateyFiles } from "./chocolatey-package";
import { parseChecksums } from "./homebrew-formula";
import { buildWingetManifests } from "./winget-manifests";

const checksums = parseChecksums(
  [
    "abcdef01  sendmock-x86_64-pc-windows-msvc.zip",
    "12345678  sendmock-aarch64-pc-windows-msvc.zip",
  ].join("\n"),
);

describe("WinGet manifests", () => {
  test("DS-03.4 shibbirweb.sendmock installs either Windows archive as a portable sendmock command", () => {
    const manifests = buildWingetManifests("1.0.0", checksums);
    const installerManifest =
      manifests.get("shibbirweb.sendmock.installer.yaml") ?? "";

    expect([...manifests.keys()].sort()).toEqual([
      "shibbirweb.sendmock.installer.yaml",
      "shibbirweb.sendmock.locale.en-US.yaml",
      "shibbirweb.sendmock.yaml",
    ]);
    expect(installerManifest).toContain("NestedInstallerType: portable");
    expect(installerManifest).toContain("PortableCommandAlias: sendmock");
    expect(installerManifest).toContain(
      "  - Architecture: x64\n    InstallerUrl: https://github.com/shibbirweb/sendmock/releases/download/v1.0.0/sendmock-x86_64-pc-windows-msvc.zip\n    InstallerSha256: ABCDEF01\n",
    );
    expect(installerManifest).toContain("  - Architecture: arm64\n");
    for (const manifestText of manifests.values()) {
      expect(manifestText).toContain(
        "PackageIdentifier: shibbirweb.sendmock\nPackageVersion: 1.0.0\n",
      );
    }
  });

  test("refuses SHA256SUMS without both Windows archives", () => {
    expect(() =>
      buildWingetManifests(
        "1.0.0",
        parseChecksums("abcdef01  sendmock-x86_64-pc-windows-msvc.zip"),
      ),
    ).toThrow("SHA256SUMS has no sendmock-aarch64-pc-windows-msvc.zip");
  });
});

describe("Chocolatey package", () => {
  test("DS-03.4 the sendmock package downloads the x64 archive and checks its SHA256", () => {
    const packageFiles = buildChocolateyFiles(
      "1.0.0",
      checksums,
      "http://127.0.0.1:8765",
    );

    expect(packageFiles.get("sendmock.nuspec")).toContain(
      "<version>1.0.0</version>",
    );
    expect(packageFiles.get("tools/chocolateyinstall.ps1")).toContain(
      'url64bit       = "http://127.0.0.1:8765/sendmock-x86_64-pc-windows-msvc.zip"',
    );
    expect(packageFiles.get("tools/chocolateyinstall.ps1")).toContain(
      'checksum64     = "abcdef01"',
    );
  });

  test("DS-03.4 the nuspec meets Chocolatey's guidelines: an icon, its source and no local URL in the description", () => {
    const nuspecText =
      buildChocolateyFiles("1.2.0", checksums).get("sendmock.nuspec") ?? "";
    const descriptionText =
      /<description>([^<]*)<\/description>/.exec(nuspecText)?.[1] ?? "";

    expect(nuspecText).toContain(
      "<projectUrl>https://shibbir.me/sendmock/</projectUrl>",
    );
    expect(nuspecText).toContain(
      "<iconUrl>https://cdn.jsdelivr.net/gh/shibbirweb/sendmock@v1.2.0/website/app/icon.svg</iconUrl>",
    );
    expect(nuspecText).toContain(
      "<packageSourceUrl>https://github.com/shibbirweb/sendmock/blob/v1.2.0/scripts/release/chocolatey-package.ts</packageSourceUrl>",
    );
    expect(descriptionText).not.toBe("");
    expect(descriptionText).not.toMatch(/https?:\/\//);
  });

  test("PL-19.6 the nuspec names the rights holder and links a license file of the release", () => {
    const nuspecText =
      buildChocolateyFiles("1.3.1", checksums).get("sendmock.nuspec") ?? "";

    expect(nuspecText).toContain(
      "<copyright>Copyright (c) 2026 MD. Shibbir Ahmed</copyright>",
    );
    expect(nuspecText).toContain(
      "<licenseUrl>https://github.com/shibbirweb/sendmock/blob/v1.3.1/LICENSE-APACHE</licenseUrl>",
    );
    expect(nuspecText).not.toContain("#licence");
  });
});
